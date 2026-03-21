import { addMoney, fromCents, toCents } from "@/lib/metrics/money";
import { dayRangeFromTodayInBusinessTimezone, toDateKeyInBusinessTimezone } from "@/lib/time/war-room-clock";

export type DailySettlementBase = {
  adSpend: number;
  grossRevenue: number;
};

export function calculateEstimatedNetProfit(input: DailySettlementBase) {
  const adSpend = fromCents(toCents(input.adSpend));
  const grossRevenue = fromCents(toCents(input.grossRevenue));
  const taxAndGateway = fromCents(Math.round(toCents(grossRevenue) * 0.15));
  const netProfit = addMoney(grossRevenue, -adSpend, -taxAndGateway);
  return {
    adSpend,
    grossRevenue,
    taxAndGateway,
    netProfit,
  };
}

export function toDateOnlyIso(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return toDateKeyInBusinessTimezone(value);
}

export function dayRangeFromToday(days: number) {
  return dayRangeFromTodayInBusinessTimezone(days);
}

