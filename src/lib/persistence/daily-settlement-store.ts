import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { UserRole } from "@/lib/auth/rbac";
import { calculateEstimatedNetProfit, toDateOnlyIso } from "@/lib/metrics/daily-settlement";

export type DailySettlementRecord = {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  date: string;
  niche: string;
  adSpend: number;
  salesCount: number;
  grossRevenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  checkoutRate: number;
  winningCreativeId: string;
  audienceInsight: string;
  productionFeedback: string;
  netProfit: number;
  createdAt: string;
  updatedAt: string;
};

type StorePayload = {
  items: DailySettlementRecord[];
};

type ListParams = {
  userId?: string;
  niche?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

type UpsertInput = Omit<DailySettlementRecord, "id" | "netProfit" | "createdAt" | "updatedAt">;
type IncrementSaleInput = {
  userId: string;
  userName: string;
  userRole: UserRole;
  date: string;
  niche: string;
  grossRevenueIncrement: number;
  winningCreativeId: string;
  audienceInsightAppend: string;
  productionFeedbackAppend: string;
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "daily-settlements.json");

declare global {
  var __dailySettlementStoreLock: Promise<void> | undefined;
}

function defaultPayload(): StorePayload {
  return { items: [] };
}

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRecord(input: DailySettlementRecord): DailySettlementRecord {
  return {
    ...input,
    date: toDateOnlyIso(input.date),
    niche: input.niche.trim() || "geral",
    adSpend: safeNumber(input.adSpend),
    salesCount: Math.max(0, Math.round(safeNumber(input.salesCount))),
    grossRevenue: safeNumber(input.grossRevenue),
    ctr: safeNumber(input.ctr),
    cpc: safeNumber(input.cpc),
    cpm: safeNumber(input.cpm),
    checkoutRate: safeNumber(input.checkoutRate),
    winningCreativeId: input.winningCreativeId.trim(),
    audienceInsight: input.audienceInsight.trim(),
    productionFeedback: input.productionFeedback.trim(),
    netProfit: safeNumber(input.netProfit),
    userName: input.userName.trim(),
  };
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StorePayload>;
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((item): item is DailySettlementRecord => typeof item === "object" && item !== null)
          .map((item) => normalizeRecord(item))
      : [];
    return { items } satisfies StorePayload;
  } catch {
    return defaultPayload();
  }
}

async function writeStore(payload: StorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (payload: StorePayload) => T | Promise<T>) {
  const previous = globalThis.__dailySettlementStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__dailySettlementStoreLock = new Promise<void>((resolve) => {
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

function applyFilters(items: DailySettlementRecord[], params: ListParams) {
  const start = params.startDate ? toDateOnlyIso(params.startDate) : "";
  const end = params.endDate ? toDateOnlyIso(params.endDate) : "";
  const filtered = items.filter((item) => {
    if (params.userId && item.userId !== params.userId) {
      return false;
    }
    if (params.niche && item.niche.toLowerCase() !== params.niche.toLowerCase()) {
      return false;
    }
    if (start && item.date < start) {
      return false;
    }
    if (end && item.date > end) {
      return false;
    }
    return true;
  });
  const sorted = filtered.sort((a, b) => (a.date === b.date ? b.updatedAt.localeCompare(a.updatedAt) : b.date.localeCompare(a.date)));
  const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(10_000, Number(params.limit))) : 500;
  return sorted.slice(0, limit);
}

export async function listDailySettlements(params: ListParams = {}) {
  const payload = await readStore();
  return applyFilters(payload.items, params);
}

export async function getDailySettlementByUserDate(userId: string, date: string) {
  const targetDate = toDateOnlyIso(date);
  const payload = await readStore();
  return payload.items.find((item) => item.userId === userId && item.date === targetDate) ?? null;
}

export async function upsertDailySettlement(input: UpsertInput) {
  return withMutation((payload) => {
    const now = new Date().toISOString();
    const date = toDateOnlyIso(input.date);
    const net = calculateEstimatedNetProfit({ grossRevenue: input.grossRevenue, adSpend: input.adSpend }).netProfit;
    const existingIndex = payload.items.findIndex((item) => item.userId === input.userId && item.date === date);
    if (existingIndex >= 0) {
      const current = payload.items[existingIndex];
      const updated: DailySettlementRecord = normalizeRecord({
        ...current,
        ...input,
        date,
        netProfit: net,
        updatedAt: now,
      });
      payload.items[existingIndex] = updated;
      return updated;
    }

    const created: DailySettlementRecord = normalizeRecord({
      ...input,
      id: randomUUID(),
      date,
      netProfit: net,
      createdAt: now,
      updatedAt: now,
    });
    payload.items.unshift(created);
    payload.items = payload.items.slice(0, 5000);
    return created;
  });
}

export async function incrementDailySettlementSale(input: IncrementSaleInput) {
  return withMutation((payload) => {
    const now = new Date().toISOString();
    const date = toDateOnlyIso(input.date);
    const grossIncrement = Math.max(0, safeNumber(input.grossRevenueIncrement));
    const existingIndex = payload.items.findIndex((item) => item.userId === input.userId && item.date === date);
    if (existingIndex >= 0) {
      const current = payload.items[existingIndex];
      const nextGrossRevenue = current.grossRevenue + grossIncrement;
      const nextSalesCount = current.salesCount + 1;
      const nextAudienceInsight = [current.audienceInsight, input.audienceInsightAppend].filter(Boolean).join("\n").trim();
      const nextProductionFeedback = [current.productionFeedback, input.productionFeedbackAppend].filter(Boolean).join("\n").trim();
      const net = calculateEstimatedNetProfit({
        grossRevenue: nextGrossRevenue,
        adSpend: current.adSpend,
      }).netProfit;
      const updated: DailySettlementRecord = normalizeRecord({
        ...current,
        userName: input.userName || current.userName,
        userRole: input.userRole || current.userRole,
        niche: input.niche || current.niche,
        grossRevenue: nextGrossRevenue,
        salesCount: nextSalesCount,
        winningCreativeId: input.winningCreativeId || current.winningCreativeId,
        audienceInsight: nextAudienceInsight || current.audienceInsight,
        productionFeedback: nextProductionFeedback || current.productionFeedback,
        netProfit: net,
        updatedAt: now,
      });
      payload.items[existingIndex] = updated;
      return updated;
    }
    const net = calculateEstimatedNetProfit({
      grossRevenue: grossIncrement,
      adSpend: 0,
    }).netProfit;
    const created: DailySettlementRecord = normalizeRecord({
      id: randomUUID(),
      userId: input.userId,
      userName: input.userName,
      userRole: input.userRole,
      date,
      niche: input.niche || "geral",
      adSpend: 0,
      salesCount: 1,
      grossRevenue: grossIncrement,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      checkoutRate: 0,
      winningCreativeId: input.winningCreativeId || "CRM-WHATSAPP",
      audienceInsight: input.audienceInsightAppend || "Venda recuperada via Sniper CRM.",
      productionFeedback: input.productionFeedbackAppend || "Venda recuperada via Sniper CRM.",
      netProfit: net,
      createdAt: now,
      updatedAt: now,
    });
    payload.items.unshift(created);
    payload.items = payload.items.slice(0, 5000);
    return created;
  });
}

