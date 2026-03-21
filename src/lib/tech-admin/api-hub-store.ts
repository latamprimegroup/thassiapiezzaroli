import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ApiHubProvider = "utmify" | "appmax" | "kiwify" | "yampi" | "cloudflare";
export type ApiHubMode = "auto" | "manual";

export type ApiHubStorePayload = {
  mode: ApiHubMode;
  tokens: Record<ApiHubProvider, string>;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "api-hub-store.json");

declare global {
  var __apiHubStoreLock: Promise<void> | undefined;
}

function defaultStore(): ApiHubStorePayload {
  return {
    mode: "auto",
    tokens: {
      utmify: "",
      appmax: "",
      kiwify: "",
      yampi: "",
      cloudflare: "",
    },
    updatedAt: "",
  };
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore(): Promise<ApiHubStorePayload> {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ApiHubStorePayload>;
    return {
      mode: parsed.mode === "manual" ? "manual" : "auto",
      tokens: {
        utmify: parsed.tokens?.utmify ?? "",
        appmax: parsed.tokens?.appmax ?? "",
        kiwify: parsed.tokens?.kiwify ?? "",
        yampi: parsed.tokens?.yampi ?? "",
        cloudflare: parsed.tokens?.cloudflare ?? "",
      },
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return defaultStore();
  }
}

async function writeStore(payload: ApiHubStorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (payload: ApiHubStorePayload) => T | Promise<T>) {
  const previous = globalThis.__apiHubStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__apiHubStoreLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const payload = await readStore();
    const result = await mutator(payload);
    payload.updatedAt = new Date().toISOString();
    await writeStore(payload);
    return result;
  } finally {
    release();
  }
}

export async function getApiHubStore() {
  return readStore();
}

export async function updateApiHubStore(
  patch: Omit<Partial<ApiHubStorePayload>, "tokens"> & { tokens?: Partial<Record<ApiHubProvider, string>> },
) {
  return withMutation((payload) => {
    if (patch.mode) {
      payload.mode = patch.mode;
    }
    if (patch.tokens) {
      payload.tokens = {
        ...payload.tokens,
        ...patch.tokens,
      };
    }
    return payload;
  });
}

export function maskToken(value: string) {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return `${"*".repeat(Math.max(0, value.length - 2))}${value.slice(-2)}`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
