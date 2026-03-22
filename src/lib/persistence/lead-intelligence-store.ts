import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LeadEventType =
  | "landing_view"
  | "vsl_progress"
  | "cta_click"
  | "checkout_start"
  | "purchase"
  | "refund"
  | "email_open"
  | "email_click";

export type LeadEventRecord = {
  id: string;
  leadId: string;
  sessionId: string;
  offerId: string;
  utmSource: string;
  utmCampaign: string;
  utmContent: string;
  eventType: LeadEventType;
  value: number;
  revenue: number;
  adCost: number;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type ChurnPlaybookAction = {
  id: string;
  leadId: string;
  action: "welcome_call" | "support_ticket" | "downsell_offer" | "vip_followup";
  note: string;
  triggeredBy: string;
  createdAt: string;
};

export type TriggerPerformanceRecord = {
  id: string;
  triggerId: string;
  triggerName: string;
  niche: string;
  utmContent: string;
  hookRate: number;
  holdRate: number;
  cpa: number;
  roas: number;
  ltv90: number;
  recordedAt: string;
};

export type RoutingRule = {
  id: string;
  offerId: string;
  primaryUrl: string;
  backupUrls: string[];
  activeUrl: string;
  mode: "primary" | "failover_manual" | "failover_auto";
  reason: string;
  lastSwitchAt: string;
};

type LeadIntelligenceStorePayload = {
  leadEvents: LeadEventRecord[];
  playbookActions: ChurnPlaybookAction[];
  triggerPerformance: TriggerPerformanceRecord[];
  routingRules: RoutingRule[];
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "lead-intelligence-store.json");

declare global {
  var __leadIntelligenceStoreLock: Promise<void> | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultPayload(): LeadIntelligenceStorePayload {
  const bootAt = nowIso();
  return {
    leadEvents: [],
    playbookActions: [],
    triggerPerformance: [],
    routingRules: [
      {
        id: "ROUTE-GLOBAL",
        offerId: "global",
        primaryUrl: "https://oferta.exemplo/landing",
        backupUrls: ["https://backup1.exemplo/landing", "https://backup2.exemplo/landing"],
        activeUrl: "https://oferta.exemplo/landing",
        mode: "primary",
        reason: "estado inicial",
        lastSwitchAt: bootAt,
      },
    ],
    updatedAt: bootAt,
  };
}

async function ensureParentDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore(): Promise<LeadIntelligenceStorePayload> {
  await ensureParentDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LeadIntelligenceStorePayload>;
    return {
      leadEvents: Array.isArray(parsed.leadEvents) ? parsed.leadEvents : [],
      playbookActions: Array.isArray(parsed.playbookActions) ? parsed.playbookActions : [],
      triggerPerformance: Array.isArray(parsed.triggerPerformance) ? parsed.triggerPerformance : [],
      routingRules: Array.isArray(parsed.routingRules) ? parsed.routingRules : createDefaultPayload().routingRules,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
    };
  } catch {
    const fallback = createDefaultPayload();
    await writeStore(fallback);
    return fallback;
  }
}

async function writeStore(payload: LeadIntelligenceStorePayload) {
  await ensureParentDir();
  await writeFile(
    STORE_PATH,
    JSON.stringify(
      {
        ...payload,
        updatedAt: nowIso(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function withMutation<T>(mutator: (payload: LeadIntelligenceStorePayload) => T | Promise<T>) {
  const previous = globalThis.__leadIntelligenceStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__leadIntelligenceStoreLock = new Promise<void>((resolve) => {
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

export async function listLeadEvents(limit = 5000) {
  const store = await readStore();
  return store.leadEvents.slice(0, limit);
}

export async function appendLeadEvents(records: Omit<LeadEventRecord, "id" | "createdAt">[]) {
  if (records.length === 0) {
    return [];
  }
  return withMutation((store) => {
    const created = records.map((record) => ({
      ...record,
      id: `LE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: nowIso(),
      value: Number.isFinite(record.value) ? record.value : 0,
      revenue: Number.isFinite(record.revenue) ? record.revenue : 0,
      adCost: Number.isFinite(record.adCost) ? record.adCost : 0,
    }));
    store.leadEvents = [...created, ...store.leadEvents].slice(0, 200_000);
    return created;
  });
}

export async function listPlaybookActions(limit = 500) {
  const store = await readStore();
  return store.playbookActions.slice(0, limit);
}

export async function appendPlaybookAction(input: Omit<ChurnPlaybookAction, "id" | "createdAt">) {
  return withMutation((store) => {
    const created: ChurnPlaybookAction = {
      ...input,
      id: `PA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: nowIso(),
    };
    store.playbookActions.unshift(created);
    store.playbookActions = store.playbookActions.slice(0, 5_000);
    return created;
  });
}

export async function listTriggerPerformance(limit = 2000) {
  const store = await readStore();
  return store.triggerPerformance.slice(0, limit);
}

export async function appendTriggerPerformance(records: Omit<TriggerPerformanceRecord, "id" | "recordedAt">[]) {
  if (records.length === 0) {
    return [];
  }
  return withMutation((store) => {
    const created = records.map((record) => ({
      ...record,
      id: `TP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: nowIso(),
    }));
    store.triggerPerformance = [...created, ...store.triggerPerformance].slice(0, 20_000);
    return created;
  });
}

export async function listRoutingRules() {
  const store = await readStore();
  return store.routingRules;
}

export async function upsertRoutingRule(input: RoutingRule) {
  return withMutation((store) => {
    const index = store.routingRules.findIndex((rule) => rule.id === input.id);
    if (index >= 0) {
      store.routingRules[index] = input;
    } else {
      store.routingRules.unshift(input);
    }
    return input;
  });
}

export async function updateRoutingRule(
  id: string,
  patch: Partial<RoutingRule> & { reason?: string },
) {
  return withMutation((store) => {
    const index = store.routingRules.findIndex((rule) => rule.id === id);
    if (index < 0) {
      return null;
    }
    const current = store.routingRules[index];
    const updated: RoutingRule = {
      ...current,
      ...patch,
      reason: typeof patch.reason === "string" && patch.reason.trim().length > 0 ? patch.reason : current.reason,
      lastSwitchAt: patch.activeUrl && patch.activeUrl !== current.activeUrl ? nowIso() : current.lastSwitchAt,
    };
    store.routingRules[index] = updated;
    return updated;
  });
}
