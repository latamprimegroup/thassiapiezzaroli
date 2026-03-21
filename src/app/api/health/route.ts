import { NextResponse } from "next/server";
import { evaluateGoLiveReadiness } from "@/lib/runtime/go-live-readiness";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verbose = url.searchParams.get("verbose") === "true";
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
