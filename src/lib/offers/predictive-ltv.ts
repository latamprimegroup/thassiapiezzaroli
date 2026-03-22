import type { LtvSampleRecord, PredictiveLtvModelState } from "@/lib/offers/types";

type TrainingStats = {
  slope: number;
  intercept: number;
  r2: number;
  mae: number;
};

function avg(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function meanAbsoluteError(actual: number[], predicted: number[]) {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < actual.length; index += 1) {
    total += Math.abs(actual[index] - predicted[index]);
  }
  return total / actual.length;
}

export function trainLinearLtvModel(samples: LtvSampleRecord[]): TrainingStats {
  const x = samples.map((sample) => sample.ltvD7);
  const y = samples.map((sample) => sample.ltvD90);
  const xMean = avg(x);
  const yMean = avg(y);

  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < samples.length; index += 1) {
    numerator += (x[index] - xMean) * (y[index] - yMean);
    denominator += (x[index] - xMean) ** 2;
  }
  const slope = denominator > 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  const predictions = x.map((value) => intercept + slope * value);
  const mae = meanAbsoluteError(y, predictions);

  const ssRes = y.reduce((acc, actual, index) => acc + (actual - predictions[index]) ** 2, 0);
  const ssTot = y.reduce((acc, actual) => acc + (actual - yMean) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    slope: Number(slope.toFixed(6)),
    intercept: Number(intercept.toFixed(6)),
    r2: Number(r2.toFixed(4)),
    mae: Number(mae.toFixed(4)),
  };
}

export function evaluateDrift(
  samples: LtvSampleRecord[],
  mae: number,
  thresholds?: { warningRatio?: number; criticalRatio?: number },
) {
  if (samples.length < 20) {
    return {
      driftRatio: 0,
      driftStatus: "stable" as const,
    };
  }
  const ordered = [...samples].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const splitIndex = Math.floor(ordered.length * 0.7);
  const baseline = ordered.slice(0, splitIndex);
  const recent = ordered.slice(splitIndex);
  if (baseline.length < 5 || recent.length < 5) {
    return {
      driftRatio: 0,
      driftStatus: "stable" as const,
    };
  }
  const baselineStats = trainLinearLtvModel(baseline);
  const recentStats = trainLinearLtvModel(recent);
  const baselineMae = Math.max(1e-6, baselineStats.mae || mae || 1e-6);
  const driftRatio = recentStats.mae / baselineMae;
  const warningRatio = thresholds?.warningRatio ?? 1.35;
  const criticalRatio = thresholds?.criticalRatio ?? 1.8;
  const driftStatus: "stable" | "warning" | "critical" =
    driftRatio >= criticalRatio ? "critical" : driftRatio >= warningRatio ? "warning" : "stable";
  return {
    driftRatio: Number(driftRatio.toFixed(4)),
    driftStatus,
  };
}

export function buildDefaultPredictiveModelState(): PredictiveLtvModelState {
  return {
    trainedAt: "",
    sampleSize: 0,
    slope: 0,
    intercept: 0,
    r2: 0,
    mae: 0,
    driftRatio: 0,
    driftStatus: "stable",
  };
}

