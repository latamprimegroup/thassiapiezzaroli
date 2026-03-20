import { NextResponse } from "next/server";
import {
  resolveAdapterByPayload,
  resolveAdapterByProvider,
  type ProviderName,
} from "@/lib/integrations/warroom-adapters";
import { ingestIntegrationEvent, markProviderError } from "@/lib/integrations/warroom-integration-store";

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

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = parseProvider(request, payload);

  const adapter = provider ? resolveAdapterByProvider(provider) : resolveAdapterByPayload(payload);
  if (!adapter) {
    return NextResponse.json({ error: "Nao foi possivel identificar o provider do webhook." }, { status: 400 });
  }

  try {
    const normalized = adapter.adapt(payload);
    ingestIntegrationEvent(normalized);
    return NextResponse.json({
      ok: true,
      provider: normalized.provider,
      receivedAt: normalized.receivedAt,
      normalizedFields: [
        "valor_bruto",
        "valor_liquido",
        "spend",
        "cart_abandonment_rate",
        "card_approval_rate",
        "upsell_take_rates",
      ],
    });
  } catch (error) {
    markProviderError(adapter.provider, error instanceof Error ? error.message : "Falha no adapter.");
    return NextResponse.json({ error: "Falha ao adaptar payload do webhook." }, { status: 400 });
  }
}
