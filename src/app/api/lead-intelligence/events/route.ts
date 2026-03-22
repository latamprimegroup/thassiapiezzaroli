import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import {
  appendLeadEvents,
  appendTriggerPerformance,
  listLeadEvents,
  listTriggerPerformance,
  type LeadEventRecord,
} from "@/lib/persistence/lead-intelligence-repository";

export const runtime = "nodejs";

type EventInput = Partial<Omit<LeadEventRecord, "id" | "createdAt">>;

function toEventRecord(input: EventInput) {
  const leadId = String(input.leadId ?? "").trim();
  if (!leadId) {
    return null;
  }
  return {
    leadId,
    sessionId: String(input.sessionId ?? `SESSION-${leadId}`).trim() || `SESSION-${leadId}`,
    offerId: String(input.offerId ?? "UNKNOWN").trim() || "UNKNOWN",
    utmSource: String(input.utmSource ?? "unknown").trim() || "unknown",
    utmCampaign: String(input.utmCampaign ?? "").trim(),
    utmContent: String(input.utmContent ?? "UNKNOWN").trim() || "UNKNOWN",
    eventType:
      input.eventType === "landing_view" ||
      input.eventType === "vsl_progress" ||
      input.eventType === "cta_click" ||
      input.eventType === "checkout_start" ||
      input.eventType === "purchase" ||
      input.eventType === "refund" ||
      input.eventType === "email_open" ||
      input.eventType === "email_click"
        ? input.eventType
        : "landing_view",
    value: Number(input.value ?? 0),
    revenue: Number(input.revenue ?? 0),
    adCost: Number(input.adCost ?? 0),
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata : {},
  };
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const [events, triggerPerformance] = await Promise.all([listLeadEvents(3000), listTriggerPerformance(1000)]);
  return NextResponse.json({ events, triggerPerformance });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    events?: EventInput[];
    event?: EventInput;
    triggerPerformance?: Array<{
      triggerId?: string;
      triggerName?: string;
      niche?: string;
      utmContent?: string;
      hookRate?: number;
      holdRate?: number;
      cpa?: number;
      roas?: number;
      ltv90?: number;
    }>;
  };

  const candidateEvents = Array.isArray(payload.events)
    ? payload.events
    : payload.event
      ? [payload.event]
      : [];
  const normalizedEvents = candidateEvents.map(toEventRecord).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const triggerRows = Array.isArray(payload.triggerPerformance)
    ? payload.triggerPerformance
        .map((item) => ({
          triggerId: String(item.triggerId ?? "").trim() || `TR-${String(item.triggerName ?? "generic").toLowerCase()}`,
          triggerName: String(item.triggerName ?? "Trigger generico").trim(),
          niche: String(item.niche ?? "geral").trim(),
          utmContent: String(item.utmContent ?? "UNKNOWN").trim(),
          hookRate: Number(item.hookRate ?? 0),
          holdRate: Number(item.holdRate ?? 0),
          cpa: Number(item.cpa ?? 0),
          roas: Number(item.roas ?? 0),
          ltv90: Number(item.ltv90 ?? 0),
        }))
        .filter((item) => item.triggerName.length > 0)
    : [];

  const [createdEvents, createdTriggers] = await Promise.all([
    appendLeadEvents(normalizedEvents),
    appendTriggerPerformance(triggerRows),
  ]);

  return NextResponse.json({
    ok: true,
    createdEvents: createdEvents.length,
    createdTriggers: createdTriggers.length,
  });
}
