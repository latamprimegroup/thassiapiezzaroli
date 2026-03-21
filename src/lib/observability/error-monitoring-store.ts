import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type SilentErrorRecord = {
  id: string;
  source: "server" | "client";
  route: string;
  message: string;
  stack: string;
  context: Record<string, unknown>;
  level: "warning" | "error" | "critical";
  occurredAt: string;
};

type ErrorStorePayload = {
  errors: SilentErrorRecord[];
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "error-monitoring.json");

declare global {
  var __silentErrorStoreLock: Promise<void> | undefined;
}

function defaultStore(): ErrorStorePayload {
  return {
    errors: [],
  };
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore(): Promise<ErrorStorePayload> {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ErrorStorePayload>;
    return {
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    };
  } catch {
    return defaultStore();
  }
}

async function writeStore(payload: ErrorStorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (store: ErrorStorePayload) => T | Promise<T>) {
  const previous = globalThis.__silentErrorStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__silentErrorStoreLock = new Promise<void>((resolve) => {
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

export async function appendSilentError(record: SilentErrorRecord) {
  return withMutation((store) => {
    store.errors.unshift(record);
    store.errors = store.errors.slice(0, 2_000);
    return record;
  });
}

export async function listSilentErrors(limit = 100) {
  const store = await readStore();
  return store.errors.slice(0, limit);
}

