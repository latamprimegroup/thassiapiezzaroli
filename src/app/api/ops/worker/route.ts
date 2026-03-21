import { NextResponse } from "next/server";
import { processOpsJobQueue } from "@/lib/ops/war-room-ops-worker";
import { getOpsJobStats } from "@/lib/persistence/war-room-ops-repository";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { isOpsAuthorized } from "@/app/api/ops/_auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isOpsAuthorized(request))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const result = await processOpsJobQueue(WAR_ROOM_OPS_CONSTANTS.queue.worker.defaultBatchSize);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  if (!(await isOpsAuthorized(request))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Number.isFinite(body.limit)
    ? Math.max(1, Math.min(WAR_ROOM_OPS_CONSTANTS.queue.worker.maxBatchSize, Number(body.limit)))
    : WAR_ROOM_OPS_CONSTANTS.queue.worker.defaultBatchSize;
  const result = await processOpsJobQueue(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function HEAD(request: Request) {
  if (!(await isOpsAuthorized(request))) {
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
