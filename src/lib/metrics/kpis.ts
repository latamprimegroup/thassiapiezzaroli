import type { WarRoomData } from "@/lib/war-room/types";

type LiveRow = WarRoomData["liveAdsTracking"][number];

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function safeDivide(numerator: unknown, denominator: unknown): number {
  const n = toFiniteNumber(numerator, 0);
  const d = toFiniteNumber(denominator, 0);
  if (d <= 0) {
    return 0;
  }
  const result = n / d;
  return Number.isFinite(result) ? result : 0;
}

export function computeKpis(row: LiveRow) {
  const hookRate = safeDivide(row.views3s, row.impressions) * 100;
  const holdRate = safeDivide(row.views15s, row.views3s) * 100;
  const vslEfficiency = safeDivide(row.ic, row.lp) * 100;

  return {
    hookRate,
    holdRate,
    vslEfficiency,
  };
}
