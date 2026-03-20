import { NextResponse } from "next/server";
import { processOpsJobQueue } from "@/lib/ops/war-room-ops-worker";
import { getOpsJobStats } from "@/lib/persistence/war-room-ops-store";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = process.env.WAR_ROOM_WEBHOOK_API_KEY;
  if (!expected) {
    return true;
  }
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return apiKey === expected || bearer === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const result = await processOpsJobQueue(50);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(200, Number(body.limit))) : 50;
  const result = await processOpsJobQueue(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function HEAD(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse(null, { status: 401 });
  }
  const stats = await getOpsJobStats();
  return new NextResponse(null, {
    status: 200,
    headers: {
      "x-warroom-queue-depth": String(stats.queueDepth),
      "x-warroom-failed-jobs": String(stats.failedJobs),
      "x-warroom-processed-today": String(stats.processedToday),
    },
  });
}
