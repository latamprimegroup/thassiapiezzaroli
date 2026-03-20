import { NextResponse } from "next/server";
import {
  resolveAdapterByPayload,
  resolveAdapterByProvider,
  type ProviderName,
} from "@/lib/integrations/warroom-adapters";
import { listDeadLetterEvents } from "@/lib/persistence/war-room-ops-store";
import { processDueWebhookRetries, processIncomingWebhook } from "@/lib/integrations/warroom-webhook-service";

export const runtime = "nodejs";

function parseProvider(request: Request, payload: Record<string, unknown>): ProviderName | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("provider");
  const fromBody = typeof payload.provider === "string" ? payload.provider : null;
  const provider = (fromQuery ?? fromBody ?? "").toLowerCase();
  if (provider === "utmify" || provider === "appmax" || provider === "kiwify" || provider === "yampi") {
    return provider;
  }
  return null;
}

function isAuthorized(request: Request) {
  const expected = process.env.WAR_ROOM_WEBHOOK_API_KEY;
  if (!expected) {
    return true;
  }

  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return apiKey === expected || bearer === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const rawBody = await request.text();
  const payload = (() => {
    try {
      return (JSON.parse(rawBody || "{}") as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  })();
  const provider = parseProvider(request, payload);

  const adapter = provider ? resolveAdapterByProvider(provider) : resolveAdapterByPayload(payload);
  if (!adapter) {
    return NextResponse.json({ error: "Nao foi possivel identificar o provider do webhook." }, { status: 400 });
  }

  const signature =
    request.headers.get("x-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-hub-signature-256") ||
    "";
  const eventId =
    request.headers.get("x-event-id") ||
    request.headers.get("x-webhook-id") ||
    (typeof payload.event_id === "string" ? payload.event_id : "") ||
    (typeof payload.id === "string" ? payload.id : "") ||
    `auto-${Date.now()}`;

  const result = await processIncomingWebhook({
    provider: adapter.provider,
    payload,
    eventId,
    rawBody,
    signature,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.statusCode });
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    provider: adapter.provider,
    eventId,
    status: result.status,
    normalizedFields: [
      "valor_bruto",
      "valor_liquido",
      "spend",
      "cart_abandonment_rate",
      "card_approval_rate",
      "upsell_take_rates",
    ],
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const retries = await processDueWebhookRetries(50);
  const deadLetters = await listDeadLetterEvents(25);
  return NextResponse.json({
    retries,
    deadLetterSize: deadLetters.length,
    deadLetters,
  });
}
