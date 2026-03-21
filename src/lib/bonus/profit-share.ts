import type {
  BonusPayoutApproval,
  BonusSettings,
  CommissionLadderRule,
  ManagerCommissionRule,
  MonthlyBonusPayoutRow,
  MonthlyProfitRow,
} from "@/lib/bonus/types";

export const DEFAULT_LADDER_RULES: CommissionLadderRule[] = [
  { id: "tier-2pct", minNetProfit: 0, commissionPct: 2, bonusFixed: 0 },
  { id: "tier-5pct", minNetProfit: 100_000, commissionPct: 5, bonusFixed: 0 },
  { id: "tier-7pct-bonus", minNetProfit: 500_000, commissionPct: 7, bonusFixed: 10_000 },
];

export function normalizeLadderRules(rules: CommissionLadderRule[]) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return [...DEFAULT_LADDER_RULES];
  }
  return rules
    .map((rule, index) => ({
      id: rule.id || `tier-${index + 1}`,
      minNetProfit: Number.isFinite(rule.minNetProfit) ? Math.max(0, rule.minNetProfit) : 0,
      commissionPct: Number.isFinite(rule.commissionPct) ? Math.max(0, rule.commissionPct) : 0,
      bonusFixed: Number.isFinite(rule.bonusFixed) ? Math.max(0, rule.bonusFixed) : 0,
    }))
    .sort((a, b) => a.minNetProfit - b.minNetProfit);
}

export function createDefaultBonusSettings(managerRules: ManagerCommissionRule[] = []): BonusSettings {
  return {
    managerRules,
    ladderRules: [...DEFAULT_LADDER_RULES],
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  };
}

export function monthKeyFromDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRangeFromKey(monthKey?: string) {
  const fallback = monthKeyFromDate(new Date());
  const key = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : fallback;
  const [yearRaw, monthRaw] = key.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
  return {
    monthKey: key,
    startDate: dateOnly(start),
    endDate: dateOnly(end),
  };
}

export function isClosedMonth(monthKey: string) {
  const current = monthKeyFromDate(new Date());
  return monthKey < current;
}

export function resolveCommissionForProfit(params: {
  netProfit: number;
  managerRule?: ManagerCommissionRule | null;
  ladderRules: CommissionLadderRule[];
}) {
  const sorted = normalizeLadderRules(params.ladderRules);
  const netProfit = Number.isFinite(params.netProfit) ? params.netProfit : 0;
  const tier = sorted.reduce<CommissionLadderRule | null>((selected, rule) => {
    if (netProfit >= rule.minNetProfit) {
      return rule;
    }
    return selected;
  }, sorted[0] ?? null);
  const overridePct = params.managerRule?.active ? params.managerRule.commissionPct : 0;
  const tierPct = tier?.commissionPct ?? 0;
  const bonusFixed = tier?.bonusFixed ?? 0;
  const commissionPctApplied = Math.max(overridePct, tierPct);
  const commissionValue = netProfit > 0 ? (netProfit * commissionPctApplied) / 100 : 0;
  const payoutValue = commissionValue + (netProfit > 0 ? bonusFixed : 0);
  return {
    commissionPctApplied,
    bonusFixedApplied: netProfit > 0 ? bonusFixed : 0,
    commissionValue,
    payoutValue,
    ruleSource: overridePct >= tierPct && params.managerRule?.active ? ("manager_override" as const) : ("ladder" as const),
  };
}

export function buildPayoutRows(params: {
  rows: MonthlyProfitRow[];
  settings: BonusSettings;
}): MonthlyBonusPayoutRow[] {
  const managerRuleById = new Map(params.settings.managerRules.map((item) => [item.userId, item]));
  return params.rows
    .map((row) => {
      const commission = resolveCommissionForProfit({
        netProfit: row.netProfit,
        managerRule: managerRuleById.get(row.userId) ?? null,
        ladderRules: params.settings.ladderRules,
      });
      return {
        ...row,
        ...commission,
      };
    })
    .sort((a, b) => b.payoutValue - a.payoutValue);
}

export function summarizePayout(rows: MonthlyBonusPayoutRow[]) {
  return {
    totalNetProfit: rows.reduce((acc, row) => acc + row.netProfit, 0),
    totalAdSpend: rows.reduce((acc, row) => acc + row.adSpend, 0),
    totalGrossRevenue: rows.reduce((acc, row) => acc + row.grossRevenue, 0),
    totalPayout: rows.reduce((acc, row) => acc + row.payoutValue, 0),
  };
}

export function managerBonusProgress(params: {
  netProfit: number;
  ladderRules: CommissionLadderRule[];
  managerPct: number;
}) {
  const rules = normalizeLadderRules(params.ladderRules);
  const netProfit = Math.max(0, params.netProfit);
  const currentTier = rules.reduce<CommissionLadderRule | null>((selected, rule) => {
    if (netProfit >= rule.minNetProfit) {
      return rule;
    }
    return selected;
  }, rules[0] ?? null);
  const currentIndex = currentTier ? rules.findIndex((rule) => rule.id === currentTier.id) : 0;
  const nextTier = currentIndex >= 0 ? rules[currentIndex + 1] : rules[0];
  const currentPct = Math.max(params.managerPct, currentTier?.commissionPct ?? 0);
  if (!nextTier) {
    return {
      currentPct,
      nextPct: currentPct,
      missingProfit: 0,
      progressPct: 100,
      message: "Faixa maxima de comissionamento atingida.",
    };
  }
  const lowerBound = currentTier?.minNetProfit ?? 0;
  const missingProfit = Math.max(0, nextTier.minNetProfit - netProfit);
  const range = Math.max(1, nextTier.minNetProfit - lowerBound);
  const progressPct = Math.max(0, Math.min(100, ((netProfit - lowerBound) / range) * 100));
  return {
    currentPct,
    nextPct: Math.max(params.managerPct, nextTier.commissionPct),
    missingProfit,
    progressPct,
    message: `Faltam ${missingProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} de lucro para proxima faixa (${Math.max(params.managerPct, nextTier.commissionPct).toFixed(2)}%).`,
  };
}

export function buildApprovalRecord(params: {
  monthKey: string;
  approvedBy: string;
  note: string;
  rows: MonthlyBonusPayoutRow[];
}): BonusPayoutApproval {
  return {
    id: `BONUS-PAYOUT-${params.monthKey}-${Date.now()}`,
    monthKey: params.monthKey,
    approvedBy: params.approvedBy,
    approvedAt: new Date().toISOString(),
    note: params.note,
    totalPayout: params.rows.reduce((acc, item) => acc + item.payoutValue, 0),
    items: params.rows,
  };
}

