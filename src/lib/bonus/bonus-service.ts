import {
  buildApprovalRecord,
  buildPayoutRows,
  createDefaultBonusSettings,
  isClosedMonth,
  managerBonusProgress,
  monthRangeFromKey,
  summarizePayout,
} from "@/lib/bonus/profit-share";
import type { BonusSettings, MonthlyBonusPayoutRow } from "@/lib/bonus/types";
import {
  appendBonusApproval,
  insertBonusSnapshotsIfMissing,
  listBonusApprovals,
  listBonusSnapshots,
  listMonthlyProfitRows,
  readBonusSettings,
  writeBonusSettings,
} from "@/lib/persistence/bonus-repository";

function toPayoutRowsFromSnapshots(
  snapshots: Awaited<ReturnType<typeof listBonusSnapshots>>,
  monthKey: string,
): MonthlyBonusPayoutRow[] {
  return snapshots.map((row) => ({
    monthKey,
    userId: row.userId,
    userName: row.userName,
    niche: row.niche,
    netProfit: row.netProfit,
    adSpend: 0,
    grossRevenue: 0,
    daysReported: 0,
    commissionPctApplied: row.commissionPctApplied,
    bonusFixedApplied: row.bonusFixedApplied,
    commissionValue: row.commissionValue,
    payoutValue: row.payoutValue,
    ruleSource: row.ruleSource,
  }));
}

export async function getBonusSettings() {
  const settings = await readBonusSettings();
  return settings ?? createDefaultBonusSettings();
}

export async function updateBonusSettings(input: {
  managerRules?: BonusSettings["managerRules"];
  ladderRules?: BonusSettings["ladderRules"];
  updatedBy: string;
}) {
  return writeBonusSettings(input);
}

export async function getMonthlyPayout(params?: {
  monthKey?: string;
  managerUserId?: string;
  niche?: string;
}) {
  const { monthKey } = monthRangeFromKey(params?.monthKey);
  const settings = await getBonusSettings();
  const allProfitRows = await listMonthlyProfitRows(monthKey);

  if (isClosedMonth(monthKey)) {
    const allLiveRows = buildPayoutRows({ rows: allProfitRows, settings });
    await insertBonusSnapshotsIfMissing(monthKey, allLiveRows);
    const snapshots = await listBonusSnapshots(monthKey);
    const rows = toPayoutRowsFromSnapshots(snapshots, monthKey)
      .filter((row) => (params?.managerUserId ? row.userId === params.managerUserId : true))
      .filter((row) => (params?.niche ? row.niche.toLowerCase() === params.niche.toLowerCase() : true))
      .sort((a, b) => b.payoutValue - a.payoutValue);
    return {
      monthKey,
      settings,
      rows,
      summary: summarizePayout(rows),
      frozenSnapshot: true,
    };
  }

  const filteredRows = allProfitRows
    .filter((row) => (params?.managerUserId ? row.userId === params.managerUserId : true))
    .filter((row) => (params?.niche ? row.niche.toLowerCase() === params.niche.toLowerCase() : true));
  const rows = buildPayoutRows({
    rows: filteredRows,
    settings,
  });
  return {
    monthKey,
    settings,
    rows,
    summary: summarizePayout(rows),
    frozenSnapshot: false,
  };
}

export async function getMyBonusSummary(params: { userId: string; monthKey?: string }) {
  const payout = await getMonthlyPayout({
    monthKey: params.monthKey,
    managerUserId: params.userId,
  });
  const settings = payout.settings;
  const managerRule = settings.managerRules.find((item) => item.userId === params.userId);
  const row = payout.rows[0];
  const netProfit = row?.netProfit ?? 0;
  const progress = managerBonusProgress({
    netProfit,
    ladderRules: settings.ladderRules,
    managerPct: managerRule?.active ? managerRule.commissionPct : 0,
  });
  return {
    monthKey: payout.monthKey,
    userId: params.userId,
    userName: row?.userName ?? params.userId,
    netProfit,
    payoutValue: row?.payoutValue ?? 0,
    commissionPctApplied: row?.commissionPctApplied ?? progress.currentPct,
    bonusFixedApplied: row?.bonusFixedApplied ?? 0,
    progress,
    frozenSnapshot: payout.frozenSnapshot,
  };
}

export async function approveMonthlyPayout(params: {
  monthKey?: string;
  approvedBy: string;
  note: string;
}) {
  const payout = await getMonthlyPayout({ monthKey: params.monthKey });
  const approval = buildApprovalRecord({
    monthKey: payout.monthKey,
    approvedBy: params.approvedBy,
    note: params.note,
    rows: payout.rows,
  });
  await appendBonusApproval(approval);
  const approvals = await listBonusApprovals(payout.monthKey);
  return {
    approval,
    approvals,
  };
}

