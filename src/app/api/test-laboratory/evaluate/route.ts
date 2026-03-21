import { NextResponse } from "next/server";
import { evaluateCreativeTest } from "@/lib/metrics/test-laboratory";

export const runtime = "nodejs";

type EvaluatePayload = {
  spend?: number;
  cpa?: number;
  targetCpa?: number;
  hookRate?: number;
  ctrOutbound?: number;
  minSpendMultiplier?: number;
  maxSpendMultiplier?: number;
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

  return NextResponse.json({ ok: true, result });
}
