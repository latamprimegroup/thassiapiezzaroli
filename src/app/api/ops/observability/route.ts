import { NextResponse } from "next/server";
import { getWarRoomObservabilitySnapshot } from "@/lib/ops/war-room-observability";

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
  const snapshot = await getWarRoomObservabilitySnapshot();
  return NextResponse.json({ ok: true, snapshot });
}
