import * as fileStore from "@/lib/persistence/sniper-crm-store";
import * as dbStore from "@/lib/persistence/sniper-crm-db";

function isDatabaseMode() {
  const enabled = process.env.WAR_ROOM_OPS_PERSISTENCE_MODE === "database" && Boolean(process.env.DATABASE_URL);
  const mustUseDatabase =
    process.env.NODE_ENV === "production" && process.env.WAR_ROOM_REQUIRE_DATABASE_IN_PROD === "true";
  if (mustUseDatabase && !enabled) {
    throw new Error(
      "Persistencia em banco obrigatoria para Sniper CRM em producao. Configure WAR_ROOM_OPS_PERSISTENCE_MODE=database e DATABASE_URL.",
    );
  }
  return enabled;
}

export async function listSniperInstances(...args: Parameters<typeof fileStore.listSniperInstances>) {
  return isDatabaseMode() ? dbStore.listSniperInstances(...args) : fileStore.listSniperInstances(...args);
}

export async function upsertSniperInstance(...args: Parameters<typeof fileStore.upsertSniperInstance>) {
  return isDatabaseMode() ? dbStore.upsertSniperInstance(...args) : fileStore.upsertSniperInstance(...args);
}

export async function listSniperFunnels(...args: Parameters<typeof fileStore.listSniperFunnels>) {
  return isDatabaseMode() ? dbStore.listSniperFunnels(...args) : fileStore.listSniperFunnels(...args);
}

export async function upsertSniperFunnel(...args: Parameters<typeof fileStore.upsertSniperFunnel>) {
  return isDatabaseMode() ? dbStore.upsertSniperFunnel(...args) : fileStore.upsertSniperFunnel(...args);
}

export async function listSniperChats(...args: Parameters<typeof fileStore.listSniperChats>) {
  return isDatabaseMode() ? dbStore.listSniperChats(...args) : fileStore.listSniperChats(...args);
}

export async function upsertSniperChat(...args: Parameters<typeof fileStore.upsertSniperChat>) {
  return isDatabaseMode() ? dbStore.upsertSniperChat(...args) : fileStore.upsertSniperChat(...args);
}

export async function getSniperChatById(...args: Parameters<typeof fileStore.getSniperChatById>) {
  return isDatabaseMode() ? dbStore.getSniperChatById(...args) : fileStore.getSniperChatById(...args);
}

export async function listSniperMessages(...args: Parameters<typeof fileStore.listSniperMessages>) {
  return isDatabaseMode() ? dbStore.listSniperMessages(...args) : fileStore.listSniperMessages(...args);
}

export async function appendSniperMessage(...args: Parameters<typeof fileStore.appendSniperMessage>) {
  return isDatabaseMode() ? dbStore.appendSniperMessage(...args) : fileStore.appendSniperMessage(...args);
}

export async function appendSniperAuditLog(...args: Parameters<typeof fileStore.appendSniperAuditLog>) {
  return isDatabaseMode() ? dbStore.appendSniperAuditLog(...args) : fileStore.appendSniperAuditLog(...args);
}

export async function listSniperAuditLogs(...args: Parameters<typeof fileStore.listSniperAuditLogs>) {
  return isDatabaseMode() ? dbStore.listSniperAuditLogs(...args) : fileStore.listSniperAuditLogs(...args);
}

export async function enqueueSniperQueueItems(...args: Parameters<typeof fileStore.enqueueSniperQueueItems>) {
  return isDatabaseMode() ? dbStore.enqueueSniperQueueItems(...args) : fileStore.enqueueSniperQueueItems(...args);
}

export async function listSniperQueueDue(...args: Parameters<typeof fileStore.listSniperQueueDue>) {
  return isDatabaseMode() ? dbStore.listSniperQueueDue(...args) : fileStore.listSniperQueueDue(...args);
}

export async function updateSniperQueueStatus(...args: Parameters<typeof fileStore.updateSniperQueueStatus>) {
  return isDatabaseMode() ? dbStore.updateSniperQueueStatus(...args) : fileStore.updateSniperQueueStatus(...args);
}

export async function cancelPendingQueueForChat(...args: Parameters<typeof fileStore.cancelPendingQueueForChat>) {
  return isDatabaseMode() ? dbStore.cancelPendingQueueForChat(...args) : fileStore.cancelPendingQueueForChat(...args);
}

export async function setSniperChatAutomationState(...args: Parameters<typeof fileStore.setSniperChatAutomationState>) {
  return isDatabaseMode() ? dbStore.setSniperChatAutomationState(...args) : fileStore.setSniperChatAutomationState(...args);
}

export async function updateSniperChatStage(...args: Parameters<typeof fileStore.updateSniperChatStage>) {
  return isDatabaseMode() ? dbStore.updateSniperChatStage(...args) : fileStore.updateSniperChatStage(...args);
}

export async function appendSniperAttributionEvent(...args: Parameters<typeof fileStore.appendSniperAttributionEvent>) {
  return isDatabaseMode() ? dbStore.appendSniperAttributionEvent(...args) : fileStore.appendSniperAttributionEvent(...args);
}

export async function listSniperAttributionEvents(...args: Parameters<typeof fileStore.listSniperAttributionEvents>) {
  return isDatabaseMode() ? dbStore.listSniperAttributionEvents(...args) : fileStore.listSniperAttributionEvents(...args);
}

export async function getSniperDashboardSnapshot(...args: Parameters<typeof fileStore.getSniperDashboardSnapshot>) {
  return isDatabaseMode() ? dbStore.getSniperDashboardSnapshot(...args) : fileStore.getSniperDashboardSnapshot(...args);
}

