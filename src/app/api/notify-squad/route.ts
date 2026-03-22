import { NextResponse } from "next/server";
import { isOpsAuthorized } from "@/app/api/ops/_auth";
import { getSessionFromCookies } from "@/lib/auth/session";
import { rolePermissions } from "@/lib/auth/rbac";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type DeliveryStatus = "idle" | "sent" | "simulated" | "failed";

async function deliverToWebhook(url: string | undefined, payload: unknown): Promise<DeliveryStatus> {
  if (!url) {
    return "simulated";
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  const hasSessionPermission = Boolean(
    session && (session.role === "ceo" || rolePermissions[session.role]?.canAlertSquad),
  );
  const hasApiAuthorization = hasSessionPermission
    ? false
    : await isOpsAuthorized(request, ["ceo", "techAdmin", "ctoDev", "headTraffic", "trafficSenior", "mediaBuyer"]);
  if (!hasSessionPermission && !hasApiAuthorization) {
    return NextResponse.json({ error: "Nao autorizado para notificar squad." }, { status: 401 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const rateKey = `notify-squad:${forwardedFor || realIp || "unknown"}`;
  const limiter = await checkRateLimit({
    key: rateKey,
    limit: 20,
    windowMs: 60_000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit excedido para notify squad.",
        reason: limiter.reason,
        resetMs: limiter.resetMs,
      },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Mensagem obrigatoria." }, { status: 400 });
  }

  const [slack, whatsapp] = await Promise.all([
    deliverToWebhook(process.env.SLACK_WEBHOOK_URL, { text: message }),
    deliverToWebhook(process.env.WHATSAPP_WEBHOOK_URL, { message }),
  ]);

  return NextResponse.json({
    slack,
    whatsapp,
    note:
      slack === "failed" || whatsapp === "failed"
        ? "Falha parcial no envio. Verifique os webhooks configurados."
        : "Diagnostico processado para canais externos.",
  });
}
