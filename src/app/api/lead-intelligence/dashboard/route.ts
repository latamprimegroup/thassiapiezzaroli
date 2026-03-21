import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";
import { buildLeadIntelligenceDashboard } from "@/lib/metrics/lead-intelligence";
import {
  listLeadEvents,
  listPlaybookActions,
  listTriggerPerformance,
} from "@/lib/persistence/lead-intelligence-repository";
import { getRoutingStatus } from "@/lib/routing/traffic-router";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const [events, triggerRows, playbooks, warRoomData, routingRules] = await Promise.all([
    listLeadEvents(20_000),
    listTriggerPerformance(5_000),
    listPlaybookActions(5_000),
    getWarRoomData(),
    getRoutingStatus(),
  ]);

  const dashboard = buildLeadIntelligenceDashboard({
    events,
    triggerRows,
    playbookActions: playbooks,
    warRoomData,
  });

  return NextResponse.json({
    dashboard,
    routingRules,
  });
}
