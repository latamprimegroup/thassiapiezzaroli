import { NextResponse } from "next/server";
import { evaluateGoLiveReadiness } from "@/lib/runtime/go-live-readiness";
import { isOpsAuthorized } from "@/app/api/ops/_auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verbose = url.searchParams.get("verbose") === "true";
  if (verbose) {
    const authorized = await isOpsAuthorized(request, ["ceo", "financeManager", "techAdmin", "ctoDev"]);
    if (!authorized) {
      return NextResponse.json({ error: "Nao autorizado para health verbose." }, { status: 401 });
    }
  }
  const snapshot = verbose ? await evaluateGoLiveReadiness() : null;
  return NextResponse.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    goLive: snapshot
      ? {
          goNoGo: snapshot.goNoGo,
          blockingFailures: snapshot.blockingFailures,
        }
      : undefined,
  });
}
