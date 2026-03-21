import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createDefaultBonusSettings,
  monthRangeFromKey,
  normalizeLadderRules,
} from "@/lib/bonus/profit-share";
import type {
  BonusPayoutApproval,
  BonusSettings,
  BonusSnapshotRow,
  MonthlyBonusPayoutRow,
  MonthlyProfitRow,
} from "@/lib/bonus/types";
import { listDailySettlements } from "@/lib/persistence/daily-settlement-store";

type BonusStorePayload = {
  settings: BonusSettings;
  snapshots: BonusSnapshotRow[];
  approvals: BonusPayoutApproval[];
};

const STORE_PATH = path.join(process.cwd(), ".war-room", "bonus-store.json");

declare global {
  var __bonusStoreLock: Promise<void> | undefined;
}

function defaultPayload(): BonusStorePayload {
  return {
    settings: createDefaultBonusSettings(),
    snapshots: [],
    approvals: [],
  };
}

async function ensureDir() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
}

function normalizePayload(payload: Partial<BonusStorePayload>): BonusStorePayload {
  const settings = payload.settings
    ? {
        ...createDefaultBonusSettings(),
        ...payload.settings,
        managerRules: Array.isArray(payload.settings.managerRules) ? payload.settings.managerRules : [],
        ladderRules: normalizeLadderRules(Array.isArray(payload.settings.ladderRules) ? payload.settings.ladderRules : []),
      }
    : createDefaultBonusSettings();
  return {
    settings,
    snapshots: Array.isArray(payload.snapshots) ? payload.snapshots : [],
    approvals: Array.isArray(payload.approvals) ? payload.approvals : [],
  };
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BonusStorePayload>;
    return normalizePayload(parsed);
  } catch {
    return defaultPayload();
  }
}

async function writeStore(payload: BonusStorePayload) {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function withMutation<T>(mutator: (payload: BonusStorePayload) => Promise<T> | T) {
  const previous = globalThis.__bonusStoreLock ?? Promise.resolve();
  let release: () => void = () => undefined;
  globalThis.__bonusStoreLock = new Promise<void>((resolve) => {
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

export async function readBonusSettings() {
  const payload = await readStore();
  return payload.settings;
}

export async function writeBonusSettings(input: {
  managerRules?: BonusSettings["managerRules"];
  ladderRules?: BonusSettings["ladderRules"];
  updatedBy: string;
}) {
  return withMutation(async (payload) => {
    payload.settings = {
      managerRules: Array.isArray(input.managerRules) ? input.managerRules : payload.settings.managerRules,
      ladderRules: Array.isArray(input.ladderRules) ? normalizeLadderRules(input.ladderRules) : payload.settings.ladderRules,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
    };
    return payload.settings;
  });
}

export async function listMonthlyProfitRows(monthKey: string) {
  const { startDate, endDate } = monthRangeFromKey(monthKey);
  const rows = await listDailySettlements({
    startDate,
    endDate,
    limit: 10_000,
  });
  const grouped = new Map<string, MonthlyProfitRow>();
  for (const row of rows) {
    const current =
      grouped.get(row.userId) ??
      ({
        monthKey,
        userId: row.userId,
        userName: row.userName,
        niche: row.niche,
        netProfit: 0,
        adSpend: 0,
        grossRevenue: 0,
        daysReported: 0,
      } satisfies MonthlyProfitRow);
    current.netProfit += row.netProfit;
    current.adSpend += row.adSpend;
    current.grossRevenue += row.grossRevenue;
    current.daysReported += 1;
    if (Math.abs(row.netProfit) > Math.abs(current.netProfit)) {
      current.niche = row.niche;
    }
    grouped.set(row.userId, current);
  }
  return [...grouped.values()].sort((a, b) => b.netProfit - a.netProfit);
}

export async function listBonusSnapshots(monthKey: string) {
  const payload = await readStore();
  return payload.snapshots.filter((item) => item.monthKey === monthKey);
}

export async function insertBonusSnapshotsIfMissing(monthKey: string, rows: MonthlyBonusPayoutRow[]) {
  return withMutation(async (payload) => {
    const existingKeys = new Set(payload.snapshots.filter((item) => item.monthKey === monthKey).map((item) => item.userId));
    const inserted: BonusSnapshotRow[] = [];
    for (const row of rows) {
      if (existingKeys.has(row.userId)) {
        continue;
      }
      const snapshot: BonusSnapshotRow = {
        monthKey,
        userId: row.userId,
        userName: row.userName,
        niche: row.niche,
        netProfit: row.netProfit,
        commissionPctApplied: row.commissionPctApplied,
        bonusFixedApplied: row.bonusFixedApplied,
        commissionValue: row.commissionValue,
        payoutValue: row.payoutValue,
        ruleSource: row.ruleSource,
        createdAt: new Date().toISOString(),
      };
      payload.snapshots.push(snapshot);
      inserted.push(snapshot);
    }
    payload.snapshots = payload.snapshots.slice(-20_000);
    return inserted;
  });
}

export async function listBonusApprovals(monthKey?: string) {
  const payload = await readStore();
  const items = monthKey ? payload.approvals.filter((item) => item.monthKey === monthKey) : payload.approvals;
  return items.slice().sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export async function appendBonusApproval(approval: BonusPayoutApproval) {
  return withMutation(async (payload) => {
    payload.approvals.unshift(approval);
    payload.approvals = payload.approvals.slice(0, 2000);
    return approval;
  });
}

