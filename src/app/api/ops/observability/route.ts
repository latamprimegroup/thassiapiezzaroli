import { NextResponse } from "next/server";
import { getWarRoomObservabilitySnapshot } from "@/lib/ops/war-room-observability";
import { isOpsAuthorized } from "@/app/api/ops/_auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isOpsAuthorized(request, ["ceo", "financeManager", "techAdmin", "ctoDev"]))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const snapshot = await getWarRoomObservabilitySnapshot();
  return NextResponse.json({ ok: true, snapshot });
}
