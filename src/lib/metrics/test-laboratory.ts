import { safeDivide, toFiniteNumber } from "@/lib/metrics/kpis";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";

export type TestLabVerdict = "continue" | "approved" | "hook_failure" | "killed";

export type TestLabEvaluationInput = {
  spend: number;
  cpa: number;
  targetCpa: number;
  hookRate: number;
  ctrOutbound: number;
  minSpendMultiplier?: number;
  maxSpendMultiplier?: number;
};

export type TestLabEvaluationResult = {
  verdict: TestLabVerdict;
  minimumSpend: number;
  maximumSpend: number;
  hasMinimumSpend: boolean;
  reason: string;
};

const DEFAULT_MIN_SPEND_MULTIPLIER = WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.minSpendMultiplier;
const DEFAULT_MAX_SPEND_MULTIPLIER = WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.maxSpendMultiplier;
const APPROVED_HOOK_RATE_PCT = WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.approvedHookRatePct;
const HOOK_FAILURE_RATE_PCT = WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.hookFailureRatePct;
const HIGH_CTR_OUTBOUND_PCT = WAR_ROOM_OPS_CONSTANTS.thresholds.testLab.highCtrOutboundPct;

export function getValidationSpendWindow(
  targetCpa: number,
  minMultiplier: number = DEFAULT_MIN_SPEND_MULTIPLIER,
  maxMultiplier: number = DEFAULT_MAX_SPEND_MULTIPLIER,
) {
  const safeTarget = Math.max(1, toFiniteNumber(targetCpa, 0));
  const safeMinMultiplier = Math.max(0.5, toFiniteNumber(minMultiplier, DEFAULT_MIN_SPEND_MULTIPLIER));
  const safeMaxMultiplier = Math.max(safeMinMultiplier, toFiniteNumber(maxMultiplier, DEFAULT_MAX_SPEND_MULTIPLIER));
  return {
    minimumSpend: safeTarget * safeMinMultiplier,
    maximumSpend: safeTarget * safeMaxMultiplier,
  };
}

export function evaluateCreativeTest(input: TestLabEvaluationInput): TestLabEvaluationResult {
  const spend = Math.max(0, toFiniteNumber(input.spend, 0));
  const cpa = Math.max(0, toFiniteNumber(input.cpa, 0));
  const targetCpa = Math.max(1, toFiniteNumber(input.targetCpa, 1));
  const hookRate = Math.max(0, toFiniteNumber(input.hookRate, 0));
  const ctrOutbound = Math.max(0, toFiniteNumber(input.ctrOutbound, 0));

  const { minimumSpend, maximumSpend } = getValidationSpendWindow(
    targetCpa,
    input.minSpendMultiplier,
    input.maxSpendMultiplier,
  );
  const hasMinimumSpend = spend >= minimumSpend;

  if (!hasMinimumSpend) {
    const progressPct = safeDivide(spend, minimumSpend) * 100;
    return {
      verdict: "continue",
      minimumSpend,
      maximumSpend,
      hasMinimumSpend: false,
      reason: `Aguardando gasto minimo de validacao (${progressPct.toFixed(0)}% de 1x CPA).`,
    };
  }

  if (cpa >= targetCpa * 2 && spend >= minimumSpend) {
    return {
      verdict: "killed",
      minimumSpend,
      maximumSpend,
      hasMinimumSpend: true,
      reason: "CPA acima de 2x o alvo apos gasto minimo. Arquivar criativo.",
    };
  }

  if (cpa <= targetCpa && hookRate >= APPROVED_HOOK_RATE_PCT) {
    return {
      verdict: "approved",
      minimumSpend,
      maximumSpend,
      hasMinimumSpend: true,
      reason: "CPA abaixo do alvo com retencao 3s forte. Mover para board de escala.",
    };
  }

  if (ctrOutbound >= HIGH_CTR_OUTBOUND_PCT && hookRate < HOOK_FAILURE_RATE_PCT) {
    return {
      verdict: "hook_failure",
      minimumSpend,
      maximumSpend,
      hasMinimumSpend: true,
      reason: "CTR alto com retencao 3s fraca. Retornar para Edicao e trocar gancho.",
    };
  }

  return {
    verdict: "continue",
    minimumSpend,
    maximumSpend,
    hasMinimumSpend: true,
    reason: "Sinais mistos. Continue coletando dados ate 2x CPA alvo ou nova decisao.",
  };
}
