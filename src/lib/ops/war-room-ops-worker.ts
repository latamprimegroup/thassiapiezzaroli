import { processIncomingWebhook, processDueWebhookRetries } from "@/lib/integrations/warroom-webhook-service";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import {
  claimDueOpsJobs,
  completeOpsJob,
  deadLetterOpsJob,
  failOpsJob,
  getOpsJobStats,
  type OpsJobRecord,
} from "@/lib/persistence/war-room-ops-repository";

type WebhookIngestPayload = {
  provider: "utmify" | "appmax" | "kiwify" | "yampi";
  eventId: string;
  payload: Record<string, unknown>;
  rawBody: string;
  signature: string;
};

function asWebhookPayload(job: OpsJobRecord): WebhookIngestPayload | null {
  if (job.type !== "webhook_ingest") {
    return null;
  }
  const payload = job.payload;
  const provider = payload.provider;
  if (provider !== "utmify" && provider !== "appmax" && provider !== "kiwify" && provider !== "yampi") {
    return null;
  }
  return {
    provider,
    eventId: typeof payload.eventId === "string" ? payload.eventId : "",
    payload: typeof payload.payload === "object" && payload.payload !== null ? (payload.payload as Record<string, unknown>) : {},
    rawBody: typeof payload.rawBody === "string" ? payload.rawBody : "",
    signature: typeof payload.signature === "string" ? payload.signature : "",
  };
}

export async function processOpsJobQueue(limit: number = WAR_ROOM_OPS_CONSTANTS.queue.worker.observabilityBatchSize) {
  const dueJobs = await claimDueOpsJobs(limit);
  let completed = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const job of dueJobs) {
    const webhookPayload = asWebhookPayload(job);
    if (!webhookPayload) {
      await deadLetterOpsJob(job.id, "Payload de job invalido para worker.");
      deadLettered += 1;
      continue;
    }

    const result = await processIncomingWebhook({
      provider: webhookPayload.provider,
      eventId: webhookPayload.eventId || job.id,
      payload: webhookPayload.payload,
      rawBody: webhookPayload.rawBody,
      signature: webhookPayload.signature,
    });

    if (result.ok) {
      await completeOpsJob(job.id);
      completed += 1;
      continue;
    }

    if (result.statusCode >= 500) {
      await failOpsJob(job.id, result.message);
      retried += 1;
      continue;
    }

    await deadLetterOpsJob(job.id, result.message);
    deadLettered += 1;
  }

  const webhookRetries = await processDueWebhookRetries(
    Math.max(WAR_ROOM_OPS_CONSTANTS.queue.worker.followupRetryBatchFloor, Math.floor(limit / 2)),
  );
  const stats = await getOpsJobStats();

  return {
    completed,
    retried,
    deadLettered,
    fetched: dueJobs.length,
    webhookRetries,
    stats,
  };
}
