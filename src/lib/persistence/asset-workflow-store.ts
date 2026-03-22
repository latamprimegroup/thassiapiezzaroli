import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AssetWorkflowStatus = "aguardando_edicao" | "pronto_para_trafego";

export type AssetWorkflowRecord = {
  id: string;
  title: string;
  offerId: string;
  status: AssetWorkflowStatus;
  createdByUserId: string;
  createdByName: string;
  assignedEditor: string;
  creativeUrl: string;
  updatedAt: string;
  history: Array<{
    at: string;
    actor: string;
    action: string;
    note: string;
  }>;
};

type AssetWorkflowStorePayload = {
  assets: AssetWorkflowRecord[];
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "asset-workflow.json");

declare global {
  var __assetWorkflowStoreLock: Promise<void> | undefined;
}

function defaultPayload(): AssetWorkflowStorePayload {
  return {
    assets: [],
  };
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AssetWorkflowStorePayload>;
    return {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    } satisfies AssetWorkflowStorePayload;
  } catch {
    return defaultPayload();
  }
}

async function writeStore(payload: AssetWorkflowStorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (payload: AssetWorkflowStorePayload) => T | Promise<T>) {
  const previous = globalThis.__assetWorkflowStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__assetWorkflowStoreLock = new Promise<void>((resolve) => {
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

export async function listAssetWorkflow(limit = 200) {
  const payload = await readStore();
  return payload.assets.slice(0, limit);
}

export async function submitScriptForEditing(params: {
  title: string;
  offerId: string;
  createdByUserId: string;
  createdByName: string;
}) {
  const now = new Date().toISOString();
  const record: AssetWorkflowRecord = {
    id: `ASSET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: params.title,
    offerId: params.offerId,
    status: "aguardando_edicao",
    createdByUserId: params.createdByUserId,
    createdByName: params.createdByName,
    assignedEditor: "",
    creativeUrl: "",
    updatedAt: now,
    history: [
      {
        at: now,
        actor: params.createdByName,
        action: "roteiro_subido",
        note: "Ativo enviado para fila de edicao.",
      },
    ],
  };
  return withMutation((payload) => {
    payload.assets.unshift(record);
    payload.assets = payload.assets.slice(0, 2000);
    return record;
  });
}

export async function markAssetReadyForTraffic(params: {
  assetId: string;
  editorName: string;
  creativeUrl: string;
}) {
  return withMutation((payload) => {
    const idx = payload.assets.findIndex((asset) => asset.id === params.assetId);
    if (idx < 0) {
      return null;
    }
    const now = new Date().toISOString();
    const current = payload.assets[idx];
    const updated: AssetWorkflowRecord = {
      ...current,
      status: "pronto_para_trafego",
      assignedEditor: params.editorName,
      creativeUrl: params.creativeUrl,
      updatedAt: now,
      history: [
        ...current.history,
        {
          at: now,
          actor: params.editorName,
          action: "edicao_finalizada",
          note: "Ativo finalizado e liberado para trafego.",
        },
      ],
    };
    payload.assets[idx] = updated;
    return updated;
  });
}
