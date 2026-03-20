import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderName } from "@/lib/integrations/warroom-adapters";
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

type OpsStorePayload = {
  webhookEvents: WebhookEventRecord[];
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
    if (store.webhookEvents.length > 2000) {
      store.webhookEvents = store.webhookEvents.slice(-2000);
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
    store.commandCenter.approvals = [...store.commandCenter.approvals, approval].slice(-2000);
    return approval;
  });
}

export async function readTaskApprovals(taskId: string) {
  const store = await readStore();
  return store.commandCenter.approvals.filter((approval) => approval.taskId === taskId);
}
