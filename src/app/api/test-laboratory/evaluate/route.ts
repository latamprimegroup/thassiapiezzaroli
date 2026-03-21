import { NextResponse } from "next/server";
import { evaluateCreativeTest } from "@/lib/metrics/test-laboratory";
import { evaluateExperimentStats } from "@/lib/metrics/experiment-stats";

export const runtime = "nodejs";

type EvaluatePayload = {
  spend?: number;
  cpa?: number;
  targetCpa?: number;
  hookRate?: number;
  ctrOutbound?: number;
  minSpendMultiplier?: number;
  maxSpendMultiplier?: number;
  experiment?: {
    visitorsA?: number;
    conversionsA?: number;
    visitorsB?: number;
    conversionsB?: number;
    alpha?: number;
    minSamplePerVariant?: number;
    minDetectableEffectPct?: number;
  };
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as EvaluatePayload;

  if (!Number.isFinite(payload.targetCpa)) {
    return NextResponse.json(
      { error: "targetCpa obrigatorio para validar o teste." },
      { status: 400 },
    );
  }

  const result = evaluateCreativeTest({
    spend: Number(payload.spend ?? 0),
    cpa: Number(payload.cpa ?? 0),
    targetCpa: Number(payload.targetCpa),
    hookRate: Number(payload.hookRate ?? 0),
    ctrOutbound: Number(payload.ctrOutbound ?? 0),
    minSpendMultiplier: Number(payload.minSpendMultiplier ?? 1),
    maxSpendMultiplier: Number(payload.maxSpendMultiplier ?? 2),
  });

  const experimentStats = payload.experiment
    ? evaluateExperimentStats({
        visitorsA: Number(payload.experiment.visitorsA ?? 0),
        conversionsA: Number(payload.experiment.conversionsA ?? 0),
        visitorsB: Number(payload.experiment.visitorsB ?? 0),
        conversionsB: Number(payload.experiment.conversionsB ?? 0),
        alpha: Number(payload.experiment.alpha ?? 0.05),
        minSamplePerVariant: Number(payload.experiment.minSamplePerVariant ?? 500),
        minDetectableEffectPct: Number(payload.experiment.minDetectableEffectPct ?? 10),
      })
    : null;

  return NextResponse.json({ ok: true, result, experimentStats });
}
