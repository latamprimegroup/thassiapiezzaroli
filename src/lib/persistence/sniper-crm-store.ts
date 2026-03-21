import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  SniperAttributionEvent,
  SniperAuditLog,
  SniperChat,
  SniperCrmInstance,
  SniperFunnelTemplate,
  SniperKanbanStage,
  SniperMessage,
  SniperQueueItem,
  SniperQueueStatus,
  SniperStorePayload,
} from "@/lib/sniper-crm/types";
import { defaultSniperStorePayload, estimateResponseSlaMinutes } from "@/lib/sniper-crm/engine";

const STORE_PATH = path.join(process.cwd(), ".war-room", "sniper-crm-store.json");

declare global {
  var __sniperCrmStoreLock: Promise<void> | undefined;
}

type ChatListParams = {
  ownerUserId?: string;
  includeAll?: boolean;
  stage?: SniperKanbanStage;
  awaitingResponse?: boolean;
  limit?: number;
  search?: string;
};

function clampLimit(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(5000, Number(value)));
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInstance(input: SniperCrmInstance): SniperCrmInstance {
  return {
    ...input,
    id: normalizeString(input.id),
    label: normalizeString(input.label).trim() || "Instância WhatsApp",
    ownerUserId: normalizeString(input.ownerUserId),
    ownerUserName: normalizeString(input.ownerUserName),
    status: input.status,
    qrCodeText: normalizeString(input.qrCodeText),
    connectedAt: normalizeString(input.connectedAt),
    conversionGoalDaily: Math.max(0, Math.round(normalizeNumber(input.conversionGoalDaily))),
    conversionsToday: Math.max(0, Math.round(normalizeNumber(input.conversionsToday))),
    createdAt: normalizeString(input.createdAt),
    updatedAt: normalizeString(input.updatedAt),
  };
}

function normalizeChat(input: SniperChat): SniperChat {
  return {
    ...input,
    id: normalizeString(input.id),
    instanceId: normalizeString(input.instanceId),
    ownerUserId: normalizeString(input.ownerUserId),
    ownerUserName: normalizeString(input.ownerUserName),
    assignedCloserUserId: normalizeString(input.assignedCloserUserId),
    assignedCloserUserName: normalizeString(input.assignedCloserUserName),
    profile: {
      ...input.profile,
      leadId: normalizeString(input.profile.leadId),
      leadName: normalizeString(input.profile.leadName),
      phone: normalizeString(input.profile.phone),
      niche: normalizeString(input.profile.niche) || "geral",
      managerUserId: normalizeString(input.profile.managerUserId),
      managerUserName: normalizeString(input.profile.managerUserName),
      utmSource: normalizeString(input.profile.utmSource),
      utmCampaign: normalizeString(input.profile.utmCampaign),
      utmContent: normalizeString(input.profile.utmContent),
      creativeId: normalizeString(input.profile.creativeId),
      offerId: normalizeString(input.profile.offerId),
      vslId: normalizeString(input.profile.vslId),
      vslWatchSeconds: Math.max(0, normalizeNumber(input.profile.vslWatchSeconds)),
      vslCompletionPct: Math.max(0, normalizeNumber(input.profile.vslCompletionPct)),
      predictedLtv90d: Math.max(0, normalizeNumber(input.profile.predictedLtv90d)),
    },
    tags: Array.isArray(input.tags) ? input.tags.map((item) => normalizeString(item).trim()).filter(Boolean) : [],
    latestMessagePreview: normalizeString(input.latestMessagePreview),
    latestMessageAt: normalizeString(input.latestMessageAt),
    lastInboundAt: normalizeString(input.lastInboundAt),
    lastOutboundAt: normalizeString(input.lastOutboundAt),
    nextFollowUpAt: normalizeString(input.nextFollowUpAt),
    automationPausedAt: normalizeString(input.automationPausedAt),
    automationPausedReason: normalizeString(input.automationPausedReason),
    createdAt: normalizeString(input.createdAt),
    updatedAt: normalizeString(input.updatedAt),
  };
}

function normalizeMessage(input: SniperMessage): SniperMessage {
  return {
    ...input,
    id: normalizeString(input.id),
    chatId: normalizeString(input.chatId),
    instanceId: normalizeString(input.instanceId),
    text: normalizeString(input.text),
    mediaUrl: normalizeString(input.mediaUrl),
    voiceDurationSec: Math.max(0, normalizeNumber(input.voiceDurationSec)),
    sentByUserId: normalizeString(input.sentByUserId),
    sentByUserName: normalizeString(input.sentByUserName),
    createdAt: normalizeString(input.createdAt),
    meta: {
      quickCommand: normalizeString(input.meta.quickCommand),
      funnelRunId: normalizeString(input.meta.funnelRunId),
      queueId: normalizeString(input.meta.queueId),
      typingCps: Math.max(0, normalizeNumber(input.meta.typingCps)),
      randomDelaySec: Math.max(0, Math.round(normalizeNumber(input.meta.randomDelaySec))),
    },
  };
}

function normalizeQueueItem(input: SniperQueueItem): SniperQueueItem {
  return {
    ...input,
    id: normalizeString(input.id),
    chatId: normalizeString(input.chatId),
    instanceId: normalizeString(input.instanceId),
    ownerUserId: normalizeString(input.ownerUserId),
    funnelRunId: normalizeString(input.funnelRunId),
    scheduledFor: normalizeString(input.scheduledFor),
    randomDelaySec: Math.max(0, Math.round(normalizeNumber(input.randomDelaySec))),
    typingCps: Math.max(0, normalizeNumber(input.typingCps)),
    stepLabel: normalizeString(input.stepLabel),
    text: normalizeString(input.text),
    mediaUrl: normalizeString(input.mediaUrl),
    dispatchedAt: normalizeString(input.dispatchedAt),
    errorMessage: normalizeString(input.errorMessage),
    createdAt: normalizeString(input.createdAt),
  };
}

function normalizePayload(input: Partial<SniperStorePayload>): SniperStorePayload {
  const fallback = defaultSniperStorePayload();
  return {
    instances: Array.isArray(input.instances) ? input.instances.map((item) => normalizeInstance(item)) : fallback.instances,
    chats: Array.isArray(input.chats) ? input.chats.map((item) => normalizeChat(item)) : fallback.chats,
    messages: Array.isArray(input.messages) ? input.messages.map((item) => normalizeMessage(item)) : fallback.messages,
    funnels: Array.isArray(input.funnels) ? input.funnels : fallback.funnels,
    queue: Array.isArray(input.queue) ? input.queue.map((item) => normalizeQueueItem(item)) : fallback.queue,
    auditLogs: Array.isArray(input.auditLogs) ? input.auditLogs : fallback.auditLogs,
    attributionEvents: Array.isArray(input.attributionEvents) ? input.attributionEvents : fallback.attributionEvents,
  };
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return normalizePayload(JSON.parse(raw) as Partial<SniperStorePayload>);
  } catch {
    return defaultSniperStorePayload();
  }
}

async function writeStore(payload: SniperStorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (payload: SniperStorePayload) => Promise<T> | T) {
  const previous = globalThis.__sniperCrmStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__sniperCrmStoreLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const payload = await readStore();
    const result = await mutator(payload);
    payload.messages = payload.messages.slice(-30_000);
    payload.queue = payload.queue.slice(-30_000);
    payload.auditLogs = payload.auditLogs.slice(-20_000);
    payload.attributionEvents = payload.attributionEvents.slice(-20_000);
    await writeStore(payload);
    return result;
  } finally {
    release();
  }
}

export async function listSniperInstances(params?: { ownerUserId?: string; includeAll?: boolean }) {
  const payload = await readStore();
  return payload.instances
    .filter((row) => (params?.includeAll ? true : params?.ownerUserId ? row.ownerUserId === params.ownerUserId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertSniperInstance(
  input: Omit<SniperCrmInstance, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  return withMutation(async (payload) => {
    const now = new Date().toISOString();
    const targetId = input.id?.trim() || `inst-${randomUUID()}`;
    const index = payload.instances.findIndex((row) => row.id === targetId);
    const normalized = normalizeInstance({
      id: targetId,
      label: input.label,
      ownerUserId: input.ownerUserId,
      ownerUserName: input.ownerUserName,
      status: input.status,
      qrCodeText: input.qrCodeText,
      connectedAt: input.connectedAt,
      conversionGoalDaily: input.conversionGoalDaily,
      conversionsToday: input.conversionsToday,
      createdAt: index >= 0 ? payload.instances[index].createdAt : now,
      updatedAt: now,
    });
    if (index >= 0) {
      payload.instances[index] = normalized;
    } else {
      payload.instances.unshift(normalized);
    }
    return normalized;
  });
}

export async function listSniperFunnels(params?: { ownerUserId?: string; includeAll?: boolean }) {
  const payload = await readStore();
  return payload.funnels
    .filter((row) => (params?.includeAll ? true : params?.ownerUserId ? row.ownerUserId === params.ownerUserId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertSniperFunnel(input: Omit<SniperFunnelTemplate, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return withMutation(async (payload) => {
    const now = new Date().toISOString();
    const targetId = input.id?.trim() || `funnel-${randomUUID()}`;
    const index = payload.funnels.findIndex((row) => row.id === targetId);
    const next: SniperFunnelTemplate = {
      ...input,
      id: targetId,
      steps: input.steps.map((step) => ({
        ...step,
        id: step.id || `step-${randomUUID()}`,
        waitSeconds: Math.max(0, Math.round(Number(step.waitSeconds || 0))),
        text: normalizeString(step.text),
        mediaUrl: normalizeString(step.mediaUrl),
      })),
      createdAt: index >= 0 ? payload.funnels[index].createdAt : now,
      updatedAt: now,
    };
    if (index >= 0) {
      payload.funnels[index] = next;
    } else {
      payload.funnels.unshift(next);
    }
    return next;
  });
}

export async function listSniperChats(params: ChatListParams = {}) {
  const payload = await readStore();
  const filtered = payload.chats
    .filter((chat) => (params.includeAll ? true : params.ownerUserId ? chat.ownerUserId === params.ownerUserId : true))
    .filter((chat) => (params.stage ? chat.stage === params.stage : true))
    .filter((chat) => (typeof params.awaitingResponse === "boolean" ? chat.awaitingResponse === params.awaitingResponse : true))
    .filter((chat) => {
      if (!params.search) {
        return true;
      }
      const search = params.search.toLowerCase();
      return (
        chat.profile.leadName.toLowerCase().includes(search) ||
        chat.profile.phone.toLowerCase().includes(search) ||
        chat.profile.leadId.toLowerCase().includes(search) ||
        chat.profile.utmContent.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => b.latestMessageAt.localeCompare(a.latestMessageAt));
  const limit = clampLimit(params.limit, 300);
  return filtered.slice(0, limit).map((chat) => ({
    ...chat,
    tags: [...chat.tags, chat.awaitingResponse ? "aguardando_resposta" : ""].filter(Boolean),
    updatedAt: chat.updatedAt || chat.latestMessageAt || chat.createdAt,
    profile: { ...chat.profile },
    // usado no smart inbox para destacar gargalo de atendimento.
    automationPausedReason: chat.automationPaused ? chat.automationPausedReason : "",
    latestMessagePreview: chat.latestMessagePreview || "Sem mensagens ainda.",
    nextFollowUpAt: chat.nextFollowUpAt,
    createdAt: chat.createdAt,
  }));
}

export async function upsertSniperChat(input: Omit<SniperChat, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return withMutation(async (payload) => {
    const now = new Date().toISOString();
    const targetId = input.id?.trim() || `chat-${randomUUID()}`;
    const index = payload.chats.findIndex((row) => row.id === targetId);
    const normalized = normalizeChat({
      ...input,
      id: targetId,
      createdAt: index >= 0 ? payload.chats[index].createdAt : now,
      updatedAt: now,
    });
    if (index >= 0) {
      payload.chats[index] = normalized;
    } else {
      payload.chats.unshift(normalized);
    }
    return normalized;
  });
}

export async function getSniperChatById(chatId: string) {
  const payload = await readStore();
  return payload.chats.find((chat) => chat.id === chatId) ?? null;
}

export async function listSniperMessages(chatId: string, limit = 200) {
  const payload = await readStore();
  return payload.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-clampLimit(limit, 200));
}

export async function appendSniperMessage(input: Omit<SniperMessage, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  return withMutation(async (payload) => {
    const now = input.createdAt || new Date().toISOString();
    const message = normalizeMessage({
      ...input,
      id: input.id || `msg-${randomUUID()}`,
      createdAt: now,
    });
    payload.messages.push(message);
    const chatIndex = payload.chats.findIndex((chat) => chat.id === message.chatId);
    if (chatIndex >= 0) {
      const chat = payload.chats[chatIndex];
      chat.latestMessagePreview = message.kind === "state" ? `[${message.stateSignal}]` : message.text || message.mediaUrl || "Mídia";
      chat.latestMessageAt = message.createdAt;
      if (message.direction === "inbound") {
        chat.awaitingResponse = true;
        chat.lastInboundAt = message.createdAt;
      } else if (message.direction === "outbound") {
        chat.awaitingResponse = false;
        chat.lastOutboundAt = message.createdAt;
      }
      chat.updatedAt = now;
      payload.chats[chatIndex] = normalizeChat(chat);
    }
    return message;
  });
}

export async function appendSniperAuditLog(input: Omit<SniperAuditLog, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  return withMutation(async (payload) => {
    const log: SniperAuditLog = {
      ...input,
      id: input.id || `audit-${randomUUID()}`,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    payload.auditLogs.push(log);
    return log;
  });
}

export async function listSniperAuditLogs(params?: { chatId?: string; limit?: number }) {
  const payload = await readStore();
  return payload.auditLogs
    .filter((row) => (params?.chatId ? row.chatId === params.chatId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, clampLimit(params?.limit, 200));
}

export async function enqueueSniperQueueItems(items: SniperQueueItem[]) {
  return withMutation(async (payload) => {
    payload.queue.push(...items.map((item) => normalizeQueueItem(item)));
    return items.length;
  });
}

export async function listSniperQueueDue(params?: { now?: Date; limit?: number; ownerUserId?: string; includeAll?: boolean }) {
  const payload = await readStore();
  const now = params?.now ?? new Date();
  const nowIso = now.toISOString();
  return payload.queue
    .filter((row) => row.status === "pending")
    .filter((row) => row.scheduledFor <= nowIso)
    .filter((row) => (params?.includeAll ? true : params?.ownerUserId ? row.ownerUserId === params.ownerUserId : true))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, clampLimit(params?.limit, 50));
}

export async function updateSniperQueueStatus(input: { ids: string[]; status: SniperQueueStatus; errorMessage?: string }) {
  return withMutation(async (payload) => {
    const ids = new Set(input.ids);
    const now = new Date().toISOString();
    let updated = 0;
    payload.queue = payload.queue.map((item) => {
      if (!ids.has(item.id)) {
        return item;
      }
      updated += 1;
      return {
        ...item,
        status: input.status,
        dispatchedAt: input.status === "dispatched" ? now : item.dispatchedAt,
        errorMessage: input.errorMessage ?? item.errorMessage,
      };
    });
    return updated;
  });
}

export async function cancelPendingQueueForChat(chatId: string, note = "automation_paused") {
  return withMutation(async (payload) => {
    let updated = 0;
    payload.queue = payload.queue.map((item) => {
      if (item.chatId !== chatId || item.status !== "pending") {
        return item;
      }
      updated += 1;
      return {
        ...item,
        status: "cancelled",
        errorMessage: note,
      };
    });
    return updated;
  });
}

export async function setSniperChatAutomationState(input: {
  chatId: string;
  paused: boolean;
  reason?: string;
  followUpAt?: string;
}) {
  return withMutation(async (payload) => {
    const index = payload.chats.findIndex((chat) => chat.id === input.chatId);
    if (index < 0) {
      return null;
    }
    const now = new Date().toISOString();
    const current = payload.chats[index];
    const updated = normalizeChat({
      ...current,
      automationPaused: input.paused,
      automationPausedAt: input.paused ? now : "",
      automationPausedReason: input.paused ? input.reason || "resposta_do_lead" : "",
      nextFollowUpAt: input.followUpAt || current.nextFollowUpAt,
      updatedAt: now,
    });
    payload.chats[index] = updated;
    return updated;
  });
}

export async function updateSniperChatStage(input: {
  chatId: string;
  stage: SniperKanbanStage;
  priority?: SniperChat["priority"];
  note?: string;
}) {
  return withMutation(async (payload) => {
    const index = payload.chats.findIndex((chat) => chat.id === input.chatId);
    if (index < 0) {
      return null;
    }
    const now = new Date().toISOString();
    const current = payload.chats[index];
    const updated = normalizeChat({
      ...current,
      stage: input.stage,
      priority: input.priority ?? current.priority,
      updatedAt: now,
      nextFollowUpAt: input.stage === "vendido" ? "" : current.nextFollowUpAt,
    });
    payload.chats[index] = updated;
    return updated;
  });
}

export async function appendSniperAttributionEvent(input: Omit<SniperAttributionEvent, "id"> & { id?: string }) {
  return withMutation(async (payload) => {
    const event: SniperAttributionEvent = {
      ...input,
      id: input.id || `attr-${randomUUID()}`,
    };
    payload.attributionEvents.push(event);
    return event;
  });
}

export async function listSniperAttributionEvents(params?: { managerUserId?: string; creativeId?: string; limit?: number }) {
  const payload = await readStore();
  return payload.attributionEvents
    .filter((row) => (params?.managerUserId ? row.managerUserId === params.managerUserId : true))
    .filter((row) => (params?.creativeId ? row.creativeId === params.creativeId : true))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, clampLimit(params?.limit, 200));
}

export async function getSniperDashboardSnapshot(params: {
  ownerUserId?: string;
  includeAll?: boolean;
  search?: string;
  awaitingResponseOnly?: boolean;
}) {
  const [instances, chats, queue] = await Promise.all([
    listSniperInstances({ ownerUserId: params.ownerUserId, includeAll: params.includeAll }),
    listSniperChats({
      ownerUserId: params.ownerUserId,
      includeAll: params.includeAll,
      search: params.search,
      awaitingResponse: params.awaitingResponseOnly ? true : undefined,
      limit: 1000,
    }),
    listSniperQueueDue({ ownerUserId: params.ownerUserId, includeAll: params.includeAll, limit: 500 }),
  ]);

  const now = new Date();
  const stageBoard: Record<SniperKanbanStage, SniperChat[]> = {
    lead: [],
    contato: [],
    boleto_pix_gerado: [],
    vendido: [],
  };
  for (const chat of chats) {
    stageBoard[chat.stage].push(chat);
  }
  const smartInbox = chats
    .map((chat) => ({
      ...chat,
      slaMinutes: estimateResponseSlaMinutes(chat, now),
    }))
    .sort((a, b) => {
      if (a.awaitingResponse && !b.awaitingResponse) {
        return -1;
      }
      if (!a.awaitingResponse && b.awaitingResponse) {
        return 1;
      }
      return b.latestMessageAt.localeCompare(a.latestMessageAt);
    })
    .slice(0, 200);

  const counters = {
    totalChats: chats.length,
    awaitingResponse: chats.filter((chat) => chat.awaitingResponse).length,
    pausedAutomation: chats.filter((chat) => chat.automationPaused).length,
    dueQueueItems: queue.length,
  };
  return {
    instances,
    stageBoard,
    smartInbox,
    counters,
  };
}

