import { NextResponse } from "next/server";
import { getOpsIncidentMetrics, listOpsIncidents, resolveOpsIncidentById } from "@/lib/persistence/war-room-ops-store";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { isOpsAuthorized } from "@/app/api/ops/_auth";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getDemoUserById } from "@/lib/auth/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isOpsAuthorized(request))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const [metrics, incidents] = await Promise.all([
    getOpsIncidentMetrics(WAR_ROOM_OPS_CONSTANTS.observability.incidents.historyRetentionDays),
    listOpsIncidents({ limit: WAR_ROOM_OPS_CONSTANTS.observability.incidents.maxRecentItems }),
  ]);
  return NextResponse.json({
    ok: true,
    metrics,
    incidents,
  });
}

export async function POST(request: Request) {
  if (!(await isOpsAuthorized(request, ["ceo", "mediaBuyer"]))) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => ({}))) as { incidentId?: string; note?: string };
  if (!payload.incidentId) {
    return NextResponse.json({ error: "incidentId obrigatorio." }, { status: 400 });
  }
  const session = await getSessionFromCookies();
  const actor = session ? getDemoUserById(session.userId)?.name ?? session.userId : "operator";
  const resolved = await resolveOpsIncidentById(payload.incidentId, payload.note || "Resolvido manualmente.", actor);
  if (!resolved) {
    return NextResponse.json({ error: "Incidente nao encontrado ou ja resolvido." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, incident: resolved });
}
