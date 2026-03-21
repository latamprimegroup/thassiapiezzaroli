export type DailySettlementBase = {
  adSpend: number;
  grossRevenue: number;
};

export function calculateEstimatedNetProfit(input: DailySettlementBase) {
  const adSpend = Number.isFinite(input.adSpend) ? input.adSpend : 0;
  const grossRevenue = Number.isFinite(input.grossRevenue) ? input.grossRevenue : 0;
  const taxAndGateway = grossRevenue * 0.15;
  const netProfit = grossRevenue - adSpend - taxAndGateway;
  return {
    adSpend,
    grossRevenue,
    taxAndGateway,
    netProfit,
  };
}

export function toDateOnlyIso(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toISOString().slice(0, 10);
}

export function dayRangeFromToday(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - Math.max(0, days - 1));
  return {
    startDate: toDateOnlyIso(start),
    endDate: toDateOnlyIso(now),
  };
}

