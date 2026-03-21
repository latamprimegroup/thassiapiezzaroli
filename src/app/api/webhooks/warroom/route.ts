import { NextResponse } from "next/server";
import {
  resolveAdapterByPayload,
  resolveAdapterByProvider,
  type ProviderName,
} from "@/lib/integrations/warroom-adapters";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { listDeadLetterEvents } from "@/lib/persistence/war-room-ops-repository";
import { enqueueOpsJob, getOpsJobStats } from "@/lib/persistence/war-room-ops-repository";
import { processOpsJobQueue } from "@/lib/ops/war-room-ops-worker";
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

  const syncMode = process.env.WAR_ROOM_WEBHOOK_SYNC_MODE === "true";
  if (syncMode) {
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
      mode: "sync",
      duplicate: result.duplicate,
      provider: adapter.provider,
      eventId,
      status: result.status,
      normalizedFields: [
        "valor_bruto",
        "valor_liquido",
        "spend",
        "real_purchase_count",
        "meta_reported_purchase_count",
        "ltv_7d",
        "ltv_30d",
        "ltv_90d",
        "cart_abandonment_rate",
        "card_approval_rate",
        "upsell_take_rates",
      ],
    });
  }

  const jobId = `job:webhook:${adapter.provider}:${eventId}`;
  await enqueueOpsJob({
    id: jobId,
    type: "webhook_ingest",
    payload: {
      provider: adapter.provider,
      eventId,
      payload,
      rawBody,
      signature,
    },
  });
  const workerKick = await processOpsJobQueue(WAR_ROOM_OPS_CONSTANTS.queue.webhook.enqueueWorkerKickBatchSize);
  const stats = await getOpsJobStats();
  return NextResponse.json({
    ok: true,
    mode: "async",
    queued: true,
    jobId,
    provider: adapter.provider,
    eventId,
    workerKick,
    queue: stats,
    normalizedFields: [
      "valor_bruto",
      "valor_liquido",
      "spend",
      "real_purchase_count",
      "meta_reported_purchase_count",
      "ltv_7d",
      "ltv_30d",
      "ltv_90d",
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
  const retries = await processDueWebhookRetries(WAR_ROOM_OPS_CONSTANTS.queue.webhook.retryScanBatchSize);
  const worker = await processOpsJobQueue(WAR_ROOM_OPS_CONSTANTS.queue.worker.observabilityBatchSize);
  const deadLetters = await listDeadLetterEvents(WAR_ROOM_OPS_CONSTANTS.queue.webhook.deadLetterListBatchSize);
  return NextResponse.json({
    retries,
    worker,
    deadLetterSize: deadLetters.length,
    deadLetters,
  });
}
