import * as fileStore from "@/lib/persistence/war-room-ops-store";
import * as dbStore from "@/lib/persistence/war-room-ops-db";

export type {
  OpsIncidentRecord,
  OpsIncidentSeverity,
  OpsIncidentSquad,
  OpsIncidentStatus,
  OpsJobRecord,
  OpsJobStatus,
  OpsJobType,
  TaskApprovalRecord,
  WebhookEventRecord,
  WebhookEventStatus,
} from "@/lib/persistence/war-room-ops-store";

function isDatabaseMode() {
  return process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
}

export async function readWebhookEvent(...args: Parameters<typeof fileStore.readWebhookEvent>) {
  return isDatabaseMode() ? dbStore.readWebhookEvent(...args) : fileStore.readWebhookEvent(...args);
}

export async function upsertWebhookEvent(...args: Parameters<typeof fileStore.upsertWebhookEvent>) {
  return isDatabaseMode() ? dbStore.upsertWebhookEvent(...args) : fileStore.upsertWebhookEvent(...args);
}

export async function listDueRetryEvents(...args: Parameters<typeof fileStore.listDueRetryEvents>) {
  return isDatabaseMode() ? dbStore.listDueRetryEvents(...args) : fileStore.listDueRetryEvents(...args);
}

export async function listDeadLetterEvents(...args: Parameters<typeof fileStore.listDeadLetterEvents>) {
  return isDatabaseMode() ? dbStore.listDeadLetterEvents(...args) : fileStore.listDeadLetterEvents(...args);
}

export async function readPersistedCommandCenterTasks(...args: Parameters<typeof fileStore.readPersistedCommandCenterTasks>) {
  return isDatabaseMode() ? dbStore.readPersistedCommandCenterTasks(...args) : fileStore.readPersistedCommandCenterTasks(...args);
}

export async function writePersistedCommandCenterTasks(...args: Parameters<typeof fileStore.writePersistedCommandCenterTasks>) {
  return isDatabaseMode() ? dbStore.writePersistedCommandCenterTasks(...args) : fileStore.writePersistedCommandCenterTasks(...args);
}

export async function appendTaskApproval(...args: Parameters<typeof fileStore.appendTaskApproval>) {
  return isDatabaseMode() ? dbStore.appendTaskApproval(...args) : fileStore.appendTaskApproval(...args);
}

export async function readTaskApprovals(...args: Parameters<typeof fileStore.readTaskApprovals>) {
  return isDatabaseMode() ? dbStore.readTaskApprovals(...args) : fileStore.readTaskApprovals(...args);
}

export async function enqueueOpsJob(...args: Parameters<typeof fileStore.enqueueOpsJob>) {
  return isDatabaseMode() ? dbStore.enqueueOpsJob(...args) : fileStore.enqueueOpsJob(...args);
}

export async function claimDueOpsJobs(...args: Parameters<typeof fileStore.claimDueOpsJobs>) {
  return isDatabaseMode() ? dbStore.claimDueOpsJobs(...args) : fileStore.claimDueOpsJobs(...args);
}

export async function completeOpsJob(...args: Parameters<typeof fileStore.completeOpsJob>) {
  return isDatabaseMode() ? dbStore.completeOpsJob(...args) : fileStore.completeOpsJob(...args);
}

export async function failOpsJob(...args: Parameters<typeof fileStore.failOpsJob>) {
  return isDatabaseMode() ? dbStore.failOpsJob(...args) : fileStore.failOpsJob(...args);
}

export async function deadLetterOpsJob(...args: Parameters<typeof fileStore.deadLetterOpsJob>) {
  return isDatabaseMode() ? dbStore.deadLetterOpsJob(...args) : fileStore.deadLetterOpsJob(...args);
}

export async function getOpsJobStats(...args: Parameters<typeof fileStore.getOpsJobStats>) {
  return isDatabaseMode() ? dbStore.getOpsJobStats(...args) : fileStore.getOpsJobStats(...args);
}

export async function upsertOpsIncident(...args: Parameters<typeof fileStore.upsertOpsIncident>) {
  return isDatabaseMode() ? dbStore.upsertOpsIncident(...args) : fileStore.upsertOpsIncident(...args);
}

export async function resolveOpsIncidentByKey(...args: Parameters<typeof fileStore.resolveOpsIncidentByKey>) {
  return isDatabaseMode() ? dbStore.resolveOpsIncidentByKey(...args) : fileStore.resolveOpsIncidentByKey(...args);
}

export async function resolveOpsIncidentById(...args: Parameters<typeof fileStore.resolveOpsIncidentById>) {
  return isDatabaseMode() ? dbStore.resolveOpsIncidentById(...args) : fileStore.resolveOpsIncidentById(...args);
}

export async function listOpsIncidents(...args: Parameters<typeof fileStore.listOpsIncidents>) {
  return isDatabaseMode() ? dbStore.listOpsIncidents(...args) : fileStore.listOpsIncidents(...args);
}

export async function getOpsIncidentMetrics(...args: Parameters<typeof fileStore.getOpsIncidentMetrics>) {
  return isDatabaseMode() ? dbStore.getOpsIncidentMetrics(...args) : fileStore.getOpsIncidentMetrics(...args);
}
