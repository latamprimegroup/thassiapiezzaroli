import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UserRole } from "@/lib/auth/rbac";

export type DailyTaskRecord = {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  summary: string;
  blockers: string;
  impactNote: string;
  createdAt: string;
};

type DailyTaskStorePayload = {
  items: DailyTaskRecord[];
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "daily-tasks.json");

declare global {
  var __dailyTaskStoreLock: Promise<void> | undefined;
}

function defaultPayload(): DailyTaskStorePayload {
  return {
    items: [],
  };
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<DailyTaskStorePayload>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
    } satisfies DailyTaskStorePayload;
  } catch {
    return defaultPayload();
  }
}

async function writeStore(payload: DailyTaskStorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (payload: DailyTaskStorePayload) => T | Promise<T>) {
  const previous = globalThis.__dailyTaskStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__dailyTaskStoreLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const payload = await readStore();
    const result = await mutator(payload);
    await writeStore(payload);
    return result;
  } finally {
    release();
  }
}

export async function listDailyTasks(limit = 100) {
  const payload = await readStore();
  return payload.items.slice(0, limit);
}

export async function appendDailyTask(input: Omit<DailyTaskRecord, "id" | "createdAt">) {
  const record: DailyTaskRecord = {
    id: `DT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  return withMutation((payload) => {
    payload.items.unshift(record);
    payload.items = payload.items.slice(0, 3000);
    return record;
  });
}
