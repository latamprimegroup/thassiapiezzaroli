export type ExperimentStatsInput = {
  visitorsA: number;
  conversionsA: number;
  visitorsB: number;
  conversionsB: number;
  alpha?: number;
  minSamplePerVariant?: number;
  minDetectableEffectPct?: number;
};

export type ExperimentStatsResult = {
  crA: number;
  crB: number;
  liftPct: number;
  zScore: number;
  pValue: number;
  confidencePct: number;
  significant: boolean;
  winner: "A" | "B" | "none";
  mdePct: number;
  stopRule: "keep_running" | "stop_winner_b" | "stop_winner_a" | "stop_no_diff";
  reason: string;
};

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

// Abramowitz-Stegun approximation for erf, enough for MVP decisions.
function erfApprox(x: number) {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(x: number) {
  return 0.5 * (1 + erfApprox(x / Math.sqrt(2)));
}

export function evaluateExperimentStats(input: ExperimentStatsInput): ExperimentStatsResult {
  const visitorsA = Math.max(0, Math.round(safeNumber(input.visitorsA, 0)));
  const visitorsB = Math.max(0, Math.round(safeNumber(input.visitorsB, 0)));
  const conversionsA = Math.max(0, Math.round(safeNumber(input.conversionsA, 0)));
  const conversionsB = Math.max(0, Math.round(safeNumber(input.conversionsB, 0)));
  const alpha = Math.min(0.2, Math.max(0.0001, safeNumber(input.alpha ?? 0.05, 0.05)));
  const minSamplePerVariant = Math.max(50, Math.round(safeNumber(input.minSamplePerVariant ?? 500, 500)));
  const fallbackMde = Math.max(2, safeNumber(input.minDetectableEffectPct ?? 10, 10));

  const crA = visitorsA > 0 ? conversionsA / visitorsA : 0;
  const crB = visitorsB > 0 ? conversionsB / visitorsB : 0;
  const pooled = visitorsA + visitorsB > 0 ? (conversionsA + conversionsB) / (visitorsA + visitorsB) : 0;
  const denominator = Math.sqrt(Math.max(1e-9, pooled * (1 - pooled) * (1 / Math.max(1, visitorsA) + 1 / Math.max(1, visitorsB))));
  const zScore = denominator > 0 ? (crB - crA) / denominator : 0;
  const pValue = Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(zScore)))));
  const confidencePct = Math.max(0, Math.min(99.99, (1 - pValue) * 100));
  const liftPct = crA > 0 ? ((crB - crA) / crA) * 100 : crB > 0 ? 100 : 0;
  const significant = pValue < alpha && visitorsA >= minSamplePerVariant && visitorsB >= minSamplePerVariant;

  const approxStandardError = denominator;
  const mdePct = crA > 0 ? (1.96 * approxStandardError) / crA * 100 : fallbackMde;

  if (significant && crB > crA) {
    return {
      crA,
      crB,
      liftPct,
      zScore,
      pValue,
      confidencePct,
      significant,
      winner: "B",
      mdePct,
      stopRule: "stop_winner_b",
      reason: "Variante B ganhou com significancia estatistica.",
    };
  }
  if (significant && crA > crB) {
    return {
      crA,
      crB,
      liftPct,
      zScore,
      pValue,
      confidencePct,
      significant,
      winner: "A",
      mdePct,
      stopRule: "stop_winner_a",
      reason: "Variante A continua vencedora com significancia estatistica.",
    };
  }

  const enoughVolume = visitorsA >= minSamplePerVariant && visitorsB >= minSamplePerVariant;
  if (enoughVolume && Math.abs(liftPct) < Math.max(fallbackMde, mdePct)) {
    return {
      crA,
      crB,
      liftPct,
      zScore,
      pValue,
      confidencePct,
      significant: false,
      winner: "none",
      mdePct,
      stopRule: "stop_no_diff",
      reason: "Volume suficiente e diferenca abaixo do MDE. Encerrar teste sem vencedor.",
    };
  }

  return {
    crA,
    crB,
    liftPct,
    zScore,
    pValue,
    confidencePct,
    significant: false,
    winner: "none",
    mdePct,
    stopRule: "keep_running",
    reason: "Continuar teste ate atingir amostra e/ou diferenca estatisticamente significativa.",
  };
}
