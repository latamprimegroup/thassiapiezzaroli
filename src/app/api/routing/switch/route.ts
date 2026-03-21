import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getRoutingStatus, switchRoute } from "@/lib/routing/traffic-router";

export const runtime = "nodejs";

function canManageRouting(role: string) {
  return [
    "ceo",
    "headTraffic",
    "trafficSenior",
    "mediaBuyer",
    "techAdmin",
    "ctoDev",
  ].includes(role);
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const rules = await getRoutingStatus();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (!canManageRouting(session.role)) {
    return NextResponse.json({ error: "Sem permissao para trocar rotas." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    offerId?: string;
    targetUrl?: string;
    mode?: "primary" | "failover_manual" | "failover_auto";
    reason?: string;
  };
  const offerId = String(payload.offerId ?? "global").trim() || "global";
  const targetUrl = String(payload.targetUrl ?? "").trim();
  if (!targetUrl) {
    return NextResponse.json({ error: "targetUrl obrigatorio." }, { status: 400 });
  }
  const mode =
    payload.mode === "primary" || payload.mode === "failover_auto" || payload.mode === "failover_manual"
      ? payload.mode
      : "failover_manual";
  const updated = await switchRoute({
    offerId,
    targetUrl,
    mode,
    reason: String(payload.reason ?? "").trim() || `switch manual por ${session.role}`,
  });
  if (!updated) {
    return NextResponse.json({ error: "Rota nao encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rule: updated });
}
