import { createHmac } from "node:crypto";
import { ingestIntegrationEvent, markProviderError } from "./warroom-integration-store";
import { resolveAdapterByProvider, type ProviderName } from "./warroom-adapters";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import {
  listDueRetryEvents,
  readWebhookEvent,
  type WebhookEventRecord,
  upsertWebhookEvent,
} from "@/lib/persistence/war-room-ops-repository";

const MAX_RETRY_ATTEMPTS = WAR_ROOM_OPS_CONSTANTS.queue.webhook.maxRetryAttempts;

type ProcessWebhookInput = {
  provider: ProviderName;
  payload: Record<string, unknown>;
  eventId: string;
  rawBody: string;
  signature: string;
};

type ProcessWebhookResult =
  | { ok: true; duplicate: boolean; status: WebhookEventRecord["status"] }
  | { ok: false; statusCode: number; message: string };

function getProviderSecret(provider: ProviderName) {
  const envMap: Record<ProviderName, string | undefined> = {
    utmify: process.env.UTMIFY_WEBHOOK_SECRET,
    appmax: process.env.APPMAX_WEBHOOK_SECRET,
    kiwify: process.env.KIWIFY_WEBHOOK_SECRET,
    yampi: process.env.YAMPI_WEBHOOK_SECRET,
  };
  return envMap[provider];
}

function sanitizeSignature(signature: string) {
  const trimmed = signature.trim();
  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice(7);
  }
  return trimmed;
}

function verifyHmacSignature(provider: ProviderName, rawBody: string, incomingSignature: string) {
  const secret = getProviderSecret(provider);
  const requireHmacInProd = process.env.NODE_ENV === "production" && process.env.WAR_ROOM_REQUIRE_HMAC_IN_PROD !== "false";
  if (!secret) {
    if (requireHmacInProd) {
      return false;
    }
    return true;
  }
  if (!incomingSignature) {
    return false;
  }
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalizedIncoming = sanitizeSignature(incomingSignature).toLowerCase();
  return expectedHex.toLowerCase() === normalizedIncoming;
}

function computeNextRetryIso(attempts: number) {
  const base = WAR_ROOM_OPS_CONSTANTS.queue.webhook.retryBaseMinutes;
  const backoffMinutes = Math.min(
    WAR_ROOM_OPS_CONSTANTS.queue.webhook.maxBackoffMinutes,
    base ** Math.max(1, attempts - 1),
  );
  return new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
}

function buildRecordId(provider: ProviderName, eventId: string) {
  return `${provider}:${eventId}`;
}

async function saveFailureWithRetry(params: {
  provider: ProviderName;
  eventId: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  attempts: number;
  errorMessage: string;
}) {
  const status: WebhookEventRecord["status"] = params.attempts >= MAX_RETRY_ATTEMPTS ? "dead_letter" : "retry";
  const record: WebhookEventRecord = {
    id: buildRecordId(params.provider, params.eventId),
    provider: params.provider,
    eventId: params.eventId,
    status,
    attempts: params.attempts,
    receivedAt: new Date().toISOString(),
    processedAt: "",
    nextRetryAt: status === "retry" ? computeNextRetryIso(params.attempts) : "",
    lastError: params.errorMessage,
    signatureValid: params.signatureValid,
    payload: params.payload,
  };
  await upsertWebhookEvent(record);
  markProviderError(params.provider, params.errorMessage);
}

export async function processIncomingWebhook(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
  const adapter = resolveAdapterByProvider(input.provider);
  if (!adapter) {
    return { ok: false, statusCode: 400, message: "Adapter nao encontrado para provider." };
  }

  const signatureValid = verifyHmacSignature(input.provider, input.rawBody, input.signature);
  if (!signatureValid) {
    const rejected: WebhookEventRecord = {
      id: buildRecordId(input.provider, input.eventId),
      provider: input.provider,
      eventId: input.eventId,
      status: "rejected",
      attempts: 1,
      receivedAt: new Date().toISOString(),
      processedAt: "",
      nextRetryAt: "",
      lastError: "Assinatura HMAC invalida.",
      signatureValid: false,
      payload: input.payload,
    };
    await upsertWebhookEvent(rejected);
    return { ok: false, statusCode: 401, message: "Assinatura do webhook invalida." };
  }

  const existing = await readWebhookEvent(input.provider, input.eventId);
  if (existing && (existing.status === "processed" || existing.status === "duplicate")) {
    const duplicate: WebhookEventRecord = {
      ...existing,
      status: "duplicate",
      lastError: "",
      processedAt: existing.processedAt || new Date().toISOString(),
    };
    await upsertWebhookEvent(duplicate);
    return { ok: true, duplicate: true, status: duplicate.status };
  }

  const attempts = (existing?.attempts ?? 0) + 1;

  try {
    const normalized = adapter.adapt(input.payload);
    ingestIntegrationEvent(normalized);
    const processed: WebhookEventRecord = {
      id: buildRecordId(input.provider, input.eventId),
      provider: input.provider,
      eventId: input.eventId,
      status: "processed",
      attempts,
      receivedAt: existing?.receivedAt || new Date().toISOString(),
      processedAt: new Date().toISOString(),
      nextRetryAt: "",
      lastError: "",
      signatureValid: true,
      payload: input.payload,
    };
    await upsertWebhookEvent(processed);
    return { ok: true, duplicate: false, status: processed.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de processamento";
    await saveFailureWithRetry({
      provider: input.provider,
      eventId: input.eventId,
      payload: input.payload,
      signatureValid: true,
      attempts,
      errorMessage: message,
    });
    return {
      ok: false,
      statusCode: 500,
      message: attempts >= MAX_RETRY_ATTEMPTS ? "Evento enviado para DLQ." : "Falha processando webhook. Evento em retry.",
    };
  }
}

export async function processDueWebhookRetries(limit = 25) {
  const due = await listDueRetryEvents(limit);
  let processed = 0;
  let deadLettered = 0;

  for (const event of due) {
    const adapter = resolveAdapterByProvider(event.provider);
    if (!adapter) {
      await upsertWebhookEvent({
        ...event,
        status: "dead_letter",
        lastError: "Adapter nao encontrado durante retry.",
        nextRetryAt: "",
      });
      deadLettered += 1;
      continue;
    }

    try {
      const normalized = adapter.adapt(event.payload);
      ingestIntegrationEvent(normalized);
      await upsertWebhookEvent({
        ...event,
        status: "processed",
        processedAt: new Date().toISOString(),
        nextRetryAt: "",
        lastError: "",
      });
      processed += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const willDeadLetter = attempts >= MAX_RETRY_ATTEMPTS;
      await upsertWebhookEvent({
        ...event,
        attempts,
        status: willDeadLetter ? "dead_letter" : "retry",
        nextRetryAt: willDeadLetter ? "" : computeNextRetryIso(attempts),
        lastError: error instanceof Error ? error.message : "Falha no retry",
      });
      if (willDeadLetter) {
        deadLettered += 1;
      }
    }
  }

  return { processed, deadLettered, totalDue: due.length };
}
