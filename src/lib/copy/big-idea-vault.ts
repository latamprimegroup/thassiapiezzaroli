import { safeDivide } from "@/lib/metrics/kpis";

export type BigIdeaEmotion = "medo" | "ganancia" | "revolta" | "esperanca";
export type LeadType = "direta" | "indireta" | "segredo" | "proclamacao" | "historia";
export type SaturationStatus = "fresh" | "fatiguing" | "saturated";

export type BigIdeaScoreInput = {
  hook: string;
  uniqueMechanism: string;
  intellectualNovelty: string;
  nomenclature: string;
  proofSocialUrl: string;
  proofScientificUrl: string;
  proofHistoricalUrl: string;
  swipeReferenceUrl: string;
  whatToSteal: string;
  whatToBeat: string;
};

export function computeSaturationStatus(params: {
  cpaStart: number;
  cpaCurrent: number;
  roasCurrent: number;
  runningDays: number;
}): SaturationStatus {
  if (params.roasCurrent < 1.5) {
    return "saturated";
  }
  const cpaLiftPct = safeDivide(params.cpaCurrent - params.cpaStart, params.cpaStart || 1) * 100;
  if (params.runningDays >= 7 && cpaLiftPct >= 20) {
    return "fatiguing";
  }
  return "fresh";
}

export function computeBigIdeaHealthScore(input: BigIdeaScoreInput): number {
  const hookScore = input.hook.trim().length >= 45 ? 15 : input.hook.trim().length >= 20 ? 10 : 4;
  const mechanismScore = Math.min(30, Math.round((input.uniqueMechanism.trim().length / 300) * 30));
  const noveltyScore = input.intellectualNovelty.trim().length >= 140 ? 12 : input.intellectualNovelty.trim().length >= 80 ? 8 : 3;
  const nomenclatureScore = input.nomenclature.trim().length >= 8 ? 10 : input.nomenclature.trim().length >= 4 ? 6 : 2;
  const proofsFilled = [input.proofSocialUrl, input.proofScientificUrl, input.proofHistoricalUrl].filter(
    (value) => value.trim().length > 0,
  ).length;
  const proofScore = proofsFilled * 8;
  const swipeScore =
    input.swipeReferenceUrl.trim().length > 0 && input.whatToSteal.trim().length > 0 && input.whatToBeat.trim().length > 0
      ? 9
      : 0;

  return Math.max(0, Math.min(100, hookScore + mechanismScore + noveltyScore + nomenclatureScore + proofScore + swipeScore));
}

export function estimateVslLeadMinutes(wordCount: number) {
  const wordsPerMinute = 140;
  return safeDivide(wordCount, wordsPerMinute);
}
