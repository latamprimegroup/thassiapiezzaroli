import { NextResponse } from "next/server";
import { isOpsAuthorized } from "@/app/api/ops/_auth";
import { evaluateGoLiveReadiness } from "@/lib/runtime/go-live-readiness";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isOpsAuthorized(request, ["ceo", "financeManager", "techAdmin", "ctoDev"]))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const snapshot = await evaluateGoLiveReadiness();
  return NextResponse.json({
    ok: true,
    snapshot,
  });
}
