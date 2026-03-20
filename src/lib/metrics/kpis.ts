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
  const pageDrop = (1 - safeDivide(row.lp, row.clicks)) * 100;
  const vslEfficiency = safeDivide(row.ic, row.lp) * 100;
  const predictiveBurnRate = computePredictiveBurnRate(row);

  return {
    hookRate,
    holdRate,
    pageDrop,
    vslEfficiency,
    predictiveBurnRate,
  };
}

export function computeMer(grossRevenue: number, totalTrafficSpend: number) {
  return safeDivide(grossRevenue, totalTrafficSpend);
}

export function isFatigueImminent(row: LiveRow) {
  const f = row.frequencyTrend3d;
  const ctr = row.uniqueCtrTrend3d;
  if (f.length < 3 || ctr.length < 3) {
    return false;
  }
  return f[0] < f[1] && f[1] < f[2] && ctr[0] > ctr[1] && ctr[1] > ctr[2];
}

export function computePredictiveBurnRate(row: LiveRow) {
  const f = row.frequencyTrend3d;
  const ctr = row.uniqueCtrTrend3d;
  if (f.length < 3 || ctr.length < 3) {
    return 0;
  }

  const freqDelta = Math.max(0, f[2] - f[0]);
  const ctrDelta = Math.max(0, ctr[0] - ctr[2]);
  const score = freqDelta * 22 + ctrDelta * 28;
  return Math.max(0, Math.min(100, score));
}

export function isLtvPriority(row: LiveRow, minCpa: number, ltvThreshold: number) {
  return row.ltv >= ltvThreshold && row.cpa <= minCpa * 1.1;
}
