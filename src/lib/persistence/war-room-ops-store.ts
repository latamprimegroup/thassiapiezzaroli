import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderName } from "@/lib/integrations/warroom-adapters";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import type { WarRoomData } from "@/lib/war-room/types";

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

export type WebhookEventStatus = "processed" | "retry" | "dead_letter" | "rejected" | "duplicate";

export type WebhookEventRecord = {
  id: string;
  provider: ProviderName;
  eventId: string;
  status: WebhookEventStatus;
  attempts: number;
  receivedAt: string;
  processedAt: string;
  nextRetryAt: string;
  lastError: string;
  signatureValid: boolean;
  payload: Record<string, unknown>;
};

export type TaskApprovalRecord = {
  taskId: string;
  approvedBy: string;
  approvedRole: string;
  approvedAt: string;
  note: string;
};

export type OpsJobType = "webhook_ingest";
export type OpsJobStatus = "pending" | "processing" | "completed" | "failed" | "dead_letter";
export type OpsIncidentSquad = "techCro" | "trafficMedia" | "copyResearch" | "ceoFinance" | "platform";
export type OpsIncidentSeverity = "warning" | "critical";
export type OpsIncidentStatus = "open" | "resolved";

export type OpsJobRecord = {
  id: string;
  type: OpsJobType;
  status: OpsJobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string;
  lastError: string;
  payload: Record<string, unknown>;
};

export type OpsIncidentRecord = {
  id: string;
  key: string;
  squad: OpsIncidentSquad;
  severity: OpsIncidentSeverity;
  status: OpsIncidentStatus;
  title: string;
  description: string;
  source: string;
  startedAt: string;
  lastSeenAt: string;
  resolvedAt: string;
  resolutionMinutes: number;
  resolutionNote: string;
  resolvedBy: string;
  slaTargetMinutes: number;
  slaBreached: boolean;
};

type OpsStorePayload = {
  webhookEvents: WebhookEventRecord[];
  jobs: OpsJobRecord[];
  incidents: OpsIncidentRecord[];
  commandCenter: {
    tasks: DemandTask[];
    approvals: TaskApprovalRecord[];
  };
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "ops-store.json");

declare global {
  var __warRoomOpsStoreLock: Promise<void> | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultStore(): OpsStorePayload {
  return {
    webhookEvents: [],
    jobs: [],
    incidents: [],
    commandCenter: {
      tasks: [],
      approvals: [],
    },
  };
}

async function ensureStoreDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore(): Promise<OpsStorePayload> {
  await ensureStoreDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<OpsStorePayload>;
    return {
      webhookEvents: Array.isArray(parsed.webhookEvents) ? parsed.webhookEvents : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
      commandCenter: {
        tasks: Array.isArray(parsed.commandCenter?.tasks) ? parsed.commandCenter.tasks : [],
        approvals: Array.isArray(parsed.commandCenter?.approvals) ? parsed.commandCenter.approvals : [],
      },
    };
  } catch {
    return defaultStore();
  }
}

async function writeStore(payload: OpsStorePayload) {
  await ensureStoreDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withStoreMutation<T>(mutator: (store: OpsStorePayload) => T | Promise<T>): Promise<T> {
  const previous = globalThis.__warRoomOpsStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__warRoomOpsStoreLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return result;
  } finally {
    release();
  }
}

export async function readWebhookEvent(provider: ProviderName, eventId: string) {
  const store = await readStore();
  return store.webhookEvents.find((event) => event.provider === provider && event.eventId === eventId) ?? null;
}

export async function upsertWebhookEvent(record: WebhookEventRecord) {
  return withStoreMutation((store) => {
    const index = store.webhookEvents.findIndex((event) => event.id === record.id);
    if (index >= 0) {
      store.webhookEvents[index] = record;
    } else {
      store.webhookEvents.push(record);
    }
    if (store.webhookEvents.length > WAR_ROOM_OPS_CONSTANTS.queue.store.maxWebhookEvents) {
      store.webhookEvents = store.webhookEvents.slice(-WAR_ROOM_OPS_CONSTANTS.queue.store.maxWebhookEvents);
    }
    return record;
  });
}

export async function listDueRetryEvents(limit = 50) {
  const store = await readStore();
  const now = nowIso();
  return store.webhookEvents
    .filter((event) => event.status === "retry" && event.nextRetryAt !== "" && event.nextRetryAt <= now)
    .sort((a, b) => a.nextRetryAt.localeCompare(b.nextRetryAt))
    .slice(0, limit);
}

export async function listDeadLetterEvents(limit = 50) {
  const store = await readStore();
  return store.webhookEvents
    .filter((event) => event.status === "dead_letter")
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, limit);
}

export async function readPersistedCommandCenterTasks() {
  const store = await readStore();
  return store.commandCenter.tasks;
}

export async function writePersistedCommandCenterTasks(tasks: DemandTask[]) {
  return withStoreMutation((store) => {
    store.commandCenter.tasks = tasks;
    return store.commandCenter.tasks;
  });
}

export async function appendTaskApproval(approval: TaskApprovalRecord) {
  return withStoreMutation((store) => {
    store.commandCenter.approvals = [...store.commandCenter.approvals, approval].slice(
      -WAR_ROOM_OPS_CONSTANTS.queue.store.maxApprovals,
    );
    return approval;
  });
}

export async function readTaskApprovals(taskId: string) {
  const store = await readStore();
  return store.commandCenter.approvals.filter((approval) => approval.taskId === taskId);
}

export async function enqueueOpsJob(params: {
  id: string;
  type: OpsJobType;
  payload: Record<string, unknown>;
  runAt?: string;
  maxAttempts?: number;
}) {
  return withStoreMutation((store) => {
    const now = nowIso();
    const existingIndex = store.jobs.findIndex((job) => job.id === params.id);
    const record: OpsJobRecord = {
      id: params.id,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 6,
      runAt: params.runAt ?? now,
      createdAt: now,
      updatedAt: now,
      processedAt: "",
      lastError: "",
      payload: params.payload,
    };
    if (existingIndex >= 0) {
      store.jobs[existingIndex] = { ...store.jobs[existingIndex], ...record };
    } else {
      store.jobs.push(record);
    }
    if (store.jobs.length > WAR_ROOM_OPS_CONSTANTS.queue.store.maxJobs) {
      store.jobs = store.jobs.slice(-WAR_ROOM_OPS_CONSTANTS.queue.store.maxJobs);
    }
    return record;
  });
}

export async function claimDueOpsJobs(limit = 25) {
  return withStoreMutation((store) => {
    const now = nowIso();
    const due = store.jobs
      .filter((job) => job.status === "pending" && job.runAt <= now)
      .sort((a, b) => a.runAt.localeCompare(b.runAt))
      .slice(0, limit);
    for (const job of due) {
      const idx = store.jobs.findIndex((item) => item.id === job.id);
      if (idx >= 0) {
        store.jobs[idx] = {
          ...store.jobs[idx],
          status: "processing",
          attempts: store.jobs[idx].attempts + 1,
          updatedAt: now,
        };
      }
    }
    return due.map((job) => ({
      ...job,
      status: "processing" as const,
      attempts: job.attempts + 1,
      updatedAt: now,
    }));
  });
}

export async function completeOpsJob(jobId: string) {
  return withStoreMutation((store) => {
    const now = nowIso();
    const index = store.jobs.findIndex((job) => job.id === jobId);
    if (index < 0) {
      return null;
    }
    store.jobs[index] = {
      ...store.jobs[index],
      status: "completed",
      updatedAt: now,
      processedAt: now,
      lastError: "",
    };
    return store.jobs[index];
  });
}

export async function failOpsJob(jobId: string, errorMessage: string) {
  return withStoreMutation((store) => {
    const now = nowIso();
    const index = store.jobs.findIndex((job) => job.id === jobId);
    if (index < 0) {
      return null;
    }
    const current = store.jobs[index];
    const shouldDeadLetter = current.attempts >= current.maxAttempts;
    const backoffMinutes = Math.min(
      WAR_ROOM_OPS_CONSTANTS.queue.webhook.maxBackoffMinutes,
      WAR_ROOM_OPS_CONSTANTS.queue.webhook.retryBaseMinutes ** Math.max(1, current.attempts),
    );
    store.jobs[index] = {
      ...current,
      status: shouldDeadLetter ? "dead_letter" : "pending",
      runAt: shouldDeadLetter ? current.runAt : new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
      updatedAt: now,
      lastError: errorMessage,
    };
    return store.jobs[index];
  });
}

export async function deadLetterOpsJob(jobId: string, errorMessage: string) {
  return withStoreMutation((store) => {
    const now = nowIso();
    const index = store.jobs.findIndex((job) => job.id === jobId);
    if (index < 0) {
      return null;
    }
    store.jobs[index] = {
      ...store.jobs[index],
      status: "dead_letter",
      updatedAt: now,
      lastError: errorMessage,
      processedAt: now,
    };
    return store.jobs[index];
  });
}

export async function getOpsJobStats() {
  const store = await readStore();
  const todayPrefix = nowIso().slice(0, 10);
  const processedToday = store.jobs.filter((job) => job.status === "completed" && job.processedAt.startsWith(todayPrefix)).length;
  const failedJobs = store.jobs.filter((job) => job.status === "failed" || job.status === "dead_letter").length;
  const queueDepth = store.jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
  const latest = [...store.jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return {
    queueDepth,
    failedJobs,
    processedToday,
    lastRunAt: latest?.updatedAt ?? "",
  };
}

function shouldSlaBeBreached(startedAt: string, slaTargetMinutes: number) {
  const startedMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedMs) || slaTargetMinutes <= 0) {
    return false;
  }
  return Date.now() - startedMs > slaTargetMinutes * 60_000;
}

export async function upsertOpsIncident(params: {
  key: string;
  squad: OpsIncidentSquad;
  severity: OpsIncidentSeverity;
  title: string;
  description: string;
  source: string;
  slaTargetMinutes: number;
}) {
  return withStoreMutation((store) => {
    const now = nowIso();
    const existingOpenIndex = store.incidents.findIndex((incident) => incident.key === params.key && incident.status === "open");
    if (existingOpenIndex >= 0) {
      const current = store.incidents[existingOpenIndex];
      store.incidents[existingOpenIndex] = {
        ...current,
        severity: params.severity,
        title: params.title,
        description: params.description,
        source: params.source,
        slaTargetMinutes: params.slaTargetMinutes,
        lastSeenAt: now,
        slaBreached: shouldSlaBeBreached(current.startedAt, params.slaTargetMinutes),
      };
      return store.incidents[existingOpenIndex];
    }

    const incident: OpsIncidentRecord = {
      id: `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key: params.key,
      squad: params.squad,
      severity: params.severity,
      status: "open",
      title: params.title,
      description: params.description,
      source: params.source,
      startedAt: now,
      lastSeenAt: now,
      resolvedAt: "",
      resolutionMinutes: 0,
      resolutionNote: "",
      resolvedBy: "",
      slaTargetMinutes: params.slaTargetMinutes,
      slaBreached: false,
    };
    store.incidents.unshift(incident);
    const retentionMs = WAR_ROOM_OPS_CONSTANTS.observability.incidents.historyRetentionDays * 24 * 60 * 60 * 1000;
    store.incidents = store.incidents
      .filter((row) => {
        const reference = row.status === "resolved" ? row.resolvedAt : row.startedAt;
        const refMs = new Date(reference).getTime();
        return !Number.isFinite(refMs) || Date.now() - refMs <= retentionMs;
      })
      .slice(0, 5000);
    return incident;
  });
}

export async function resolveOpsIncidentByKey(key: string, note = "Resolvido automaticamente pelo sistema.", resolvedBy = "war-room-automation") {
  return withStoreMutation((store) => {
    const now = nowIso();
    const index = store.incidents.findIndex((incident) => incident.key === key && incident.status === "open");
    if (index < 0) {
      return null;
    }
    const current = store.incidents[index];
    const startedMs = new Date(current.startedAt).getTime();
    const resolutionMinutes = Number.isFinite(startedMs) ? Math.max(0, Math.round((Date.now() - startedMs) / 60_000)) : 0;
    store.incidents[index] = {
      ...current,
      status: "resolved",
      resolvedAt: now,
      resolutionMinutes,
      resolutionNote: note,
      resolvedBy,
      slaBreached: current.slaBreached || shouldSlaBeBreached(current.startedAt, current.slaTargetMinutes),
      lastSeenAt: now,
    };
    return store.incidents[index];
  });
}

export async function resolveOpsIncidentById(incidentId: string, note = "Resolvido manualmente.", resolvedBy = "operator") {
  return withStoreMutation((store) => {
    const now = nowIso();
    const index = store.incidents.findIndex((incident) => incident.id === incidentId && incident.status === "open");
    if (index < 0) {
      return null;
    }
    const current = store.incidents[index];
    const startedMs = new Date(current.startedAt).getTime();
    const resolutionMinutes = Number.isFinite(startedMs) ? Math.max(0, Math.round((Date.now() - startedMs) / 60_000)) : 0;
    store.incidents[index] = {
      ...current,
      status: "resolved",
      resolvedAt: now,
      resolutionMinutes,
      resolutionNote: note,
      resolvedBy,
      slaBreached: current.slaBreached || shouldSlaBeBreached(current.startedAt, current.slaTargetMinutes),
      lastSeenAt: now,
    };
    return store.incidents[index];
  });
}

export async function listOpsIncidents(params?: { limit?: number; status?: OpsIncidentStatus }) {
  const store = await readStore();
  const limit = params?.limit ?? WAR_ROOM_OPS_CONSTANTS.observability.incidents.maxRecentItems;
  const status = params?.status;
  return store.incidents
    .filter((incident) => (status ? incident.status === status : true))
    .sort((a, b) => {
      const aRef = a.status === "resolved" ? a.resolvedAt : a.lastSeenAt;
      const bRef = b.status === "resolved" ? b.resolvedAt : b.lastSeenAt;
      return bRef.localeCompare(aRef);
    })
    .slice(0, limit);
}

export async function getOpsIncidentMetrics(days = WAR_ROOM_OPS_CONSTANTS.observability.incidents.historyRetentionDays) {
  const store = await readStore();
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = store.incidents.filter((incident) => {
    const ref = incident.status === "resolved" ? incident.resolvedAt : incident.startedAt;
    const refMs = new Date(ref).getTime();
    return Number.isFinite(refMs) && refMs >= sinceMs;
  });
  const open = inWindow.filter((incident) => incident.status === "open");
  const resolved = inWindow.filter((incident) => incident.status === "resolved");
  const breachedOpen = open.filter((incident) => incident.slaBreached || shouldSlaBeBreached(incident.startedAt, incident.slaTargetMinutes)).length;

  const squads: OpsIncidentSquad[] = ["techCro", "trafficMedia", "copyResearch", "ceoFinance", "platform"];
  const mttrBySquad = squads.map((squad) => {
    const rows = resolved.filter((incident) => incident.squad === squad && incident.resolutionMinutes > 0);
    const avg = rows.length > 0 ? rows.reduce((acc, row) => acc + row.resolutionMinutes, 0) / rows.length : 0;
    return {
      squad,
      incidents: rows.length,
      mttrMinutes: Number(avg.toFixed(1)),
    };
  });

  return {
    openCount: open.length,
    resolvedCount: resolved.length,
    breachedOpenCount: breachedOpen,
    mttrBySquad,
  };
}
