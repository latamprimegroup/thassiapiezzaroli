import { NextResponse } from "next/server";

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
