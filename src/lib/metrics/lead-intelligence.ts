import { safeDivide } from "@/lib/metrics/kpis";
import type { WarRoomData } from "@/lib/war-room/types";
import type {
  ChurnPlaybookAction,
  LeadEventRecord,
  TriggerPerformanceRecord,
} from "@/lib/persistence/lead-intelligence-store";

export type LeadIntelligenceDashboard = {
  generatedAt: string;
  timeline: Array<{
    leadId: string;
    lastEventAt: string;
    stage: "cold" | "warm" | "hot" | "buyer";
    watchMinutes: number;
    purchases: number;
    refunds: number;
    source: string;
  }>;
  rplBySource: Array<{
    source: string;
    leads: number;
    adCost: number;
    revenue: number;
    revenuePerLead: number;
  }>;
  breakevenBySource: Array<{
    source: string;
    adCost: number;
    cumulativeRevenue: number;
    breakevenDay: number;
    status: "recovering" | "breakeven" | "profit";
  }>;
  whaleAlerts: Array<{
    leadId: string;
    totalRevenue: number;
    purchases: number;
    source: string;
    note: string;
  }>;
  retargetGaps: Array<{
    leadId: string;
    source: string;
    utmContent: string;
    maxWatchMinutes: number;
    idleHours: number;
    reason: string;
  }>;
  churnRadar: Array<{
    leadId: string;
    riskScore: number;
    purchases: number;
    refunds: number;
    watchMinutes: number;
    idleHours: number;
    source: string;
    recommendedPlaybook: ChurnPlaybookAction["action"];
  }>;
  creativeHeatmap: Array<{
    utmContent: string;
    sessions: number;
    avgWatchMinutes: number;
    coldPointMinute: number;
    highestDropPct: number;
  }>;
  ipTriggerRanking: Array<{
    triggerName: string;
    samples: number;
    avgRoas: number;
    avgCpa: number;
    avgLtv90: number;
    score: number;
  }>;
};

type LeadAggregate = {
  leadId: string;
  source: string;
  utmContent: string;
  adCost: number;
  revenue: number;
  purchases: number;
  refunds: number;
  maxWatchSeconds: number;
  lastEventAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function inferStage(lead: LeadAggregate): "cold" | "warm" | "hot" | "buyer" {
  if (lead.purchases > 0) {
    return "buyer";
  }
  if (lead.maxWatchSeconds >= 12 * 60) {
    return "hot";
  }
  if (lead.maxWatchSeconds >= 4 * 60) {
    return "warm";
  }
  return "cold";
}

function hoursSince(iso: string) {
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
}

function buildFallbackEventsFromWarRoom(data: WarRoomData): LeadEventRecord[] {
  const rows = data.customerCentrality?.leads ?? [];
  const createdAt = nowIso();
  return rows.flatMap((lead, index) => {
    const sourceGuess = data.integrations.attribution.realRoiLeaderboard[index % Math.max(1, data.integrations.attribution.realRoiLeaderboard.length)]?.source ?? "meta";
    const adRow = data.liveAdsTracking[index % Math.max(1, data.liveAdsTracking.length)];
    const sessionId = `SESSION-${lead.leadId}`;
    const baseCost = Math.max(1, adRow?.cpa ?? 120);
    const purchaseRevenue = lead.purchases > 0 ? Math.max(lead.currentLtv, 200) : 0;
    const events: LeadEventRecord[] = [
      {
        id: `FALLBACK-LV-${lead.leadId}`,
        leadId: lead.leadId,
        sessionId,
        offerId: adRow?.id ?? lead.lastVslId,
        utmSource: sourceGuess,
        utmCampaign: `${sourceGuess}|${adRow?.id ?? "GEN"}`,
        utmContent: adRow?.id ?? lead.lastVslId,
        eventType: "landing_view",
        value: 1,
        revenue: 0,
        adCost: baseCost,
        createdAt: lead.lastTouchAt || createdAt,
        metadata: {},
      },
      {
        id: `FALLBACK-VP-${lead.leadId}`,
        leadId: lead.leadId,
        sessionId,
        offerId: adRow?.id ?? lead.lastVslId,
        utmSource: sourceGuess,
        utmCampaign: `${sourceGuess}|${adRow?.id ?? "GEN"}`,
        utmContent: adRow?.id ?? lead.lastVslId,
        eventType: "vsl_progress",
        value: lead.watchSeconds,
        revenue: 0,
        adCost: 0,
        createdAt: lead.lastTouchAt || createdAt,
        metadata: {
          completionPct: lead.watchCompletionPct,
        },
      },
    ];
    if (lead.purchases > 0) {
      events.push({
        id: `FALLBACK-PU-${lead.leadId}`,
        leadId: lead.leadId,
        sessionId,
        offerId: adRow?.id ?? lead.lastVslId,
        utmSource: sourceGuess,
        utmCampaign: `${sourceGuess}|${adRow?.id ?? "GEN"}`,
        utmContent: adRow?.id ?? lead.lastVslId,
        eventType: "purchase",
        value: lead.purchases,
        revenue: purchaseRevenue,
        adCost: 0,
        createdAt: lead.lastTouchAt || createdAt,
        metadata: {},
      });
    }
    return events;
  });
}

function aggregateLeads(events: LeadEventRecord[]) {
  const byLead = new Map<string, LeadAggregate>();
  for (const event of events) {
    const current = byLead.get(event.leadId) ?? {
      leadId: event.leadId,
      source: event.utmSource || "unknown",
      utmContent: event.utmContent || "unknown",
      adCost: 0,
      revenue: 0,
      purchases: 0,
      refunds: 0,
      maxWatchSeconds: 0,
      lastEventAt: event.createdAt,
    };
    current.source = event.utmSource || current.source;
    current.utmContent = event.utmContent || current.utmContent;
    current.adCost += Number.isFinite(event.adCost) ? event.adCost : 0;
    current.revenue += Number.isFinite(event.revenue) ? event.revenue : 0;
    if (event.eventType === "purchase") {
      current.purchases += 1;
    }
    if (event.eventType === "refund") {
      current.refunds += 1;
    }
    if (event.eventType === "vsl_progress") {
      current.maxWatchSeconds = Math.max(current.maxWatchSeconds, Number.isFinite(event.value) ? event.value : 0);
    }
    if (new Date(event.createdAt).getTime() > new Date(current.lastEventAt).getTime()) {
      current.lastEventAt = event.createdAt;
    }
    byLead.set(event.leadId, current);
  }
  return [...byLead.values()];
}

function buildCreativeHeatmap(events: LeadEventRecord[]) {
  const progressEvents = events.filter((event) => event.eventType === "vsl_progress" && event.utmContent);
  const byCreative = new Map<string, number[]>();
  for (const event of progressEvents) {
    const key = event.utmContent || "unknown";
    const current = byCreative.get(key) ?? [];
    current.push(Math.max(0, event.value));
    byCreative.set(key, current);
  }

  return [...byCreative.entries()]
    .map(([utmContent, watchValues]) => {
      const sessions = watchValues.length;
      const avgWatchSeconds = safeDivide(watchValues.reduce((acc, value) => acc + value, 0), sessions || 1);
      const maxMinute = Math.max(2, Math.min(18, Math.ceil(Math.max(...watchValues, 60) / 60)));
      let highestDropPct = 0;
      let coldPointMinute = 1;
      for (let minute = 1; minute < maxMinute; minute += 1) {
        const reachedCurrent = watchValues.filter((seconds) => seconds >= minute * 60).length;
        const reachedNext = watchValues.filter((seconds) => seconds >= (minute + 1) * 60).length;
        const dropPct = (1 - safeDivide(reachedNext, reachedCurrent || 1)) * 100;
        if (dropPct > highestDropPct) {
          highestDropPct = dropPct;
          coldPointMinute = minute;
        }
      }
      return {
        utmContent,
        sessions,
        avgWatchMinutes: avgWatchSeconds / 60,
        coldPointMinute,
        highestDropPct,
      };
    })
    .sort((a, b) => b.highestDropPct - a.highestDropPct)
    .slice(0, 16);
}

function buildTriggerRanking(triggerRows: TriggerPerformanceRecord[]) {
  const grouped = new Map<string, { name: string; rows: TriggerPerformanceRecord[] }>();
  for (const row of triggerRows) {
    const key = row.triggerId || row.triggerName.toLowerCase();
    const current = grouped.get(key) ?? { name: row.triggerName, rows: [] };
    current.rows.push(row);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((item) => {
      const samples = item.rows.length;
      const avgRoas = safeDivide(item.rows.reduce((acc, row) => acc + row.roas, 0), samples || 1);
      const avgCpa = safeDivide(item.rows.reduce((acc, row) => acc + row.cpa, 0), samples || 1);
      const avgLtv90 = safeDivide(item.rows.reduce((acc, row) => acc + row.ltv90, 0), samples || 1);
      const score = avgRoas * 35 + safeDivide(avgLtv90, Math.max(1, avgCpa)) * 20;
      return {
        triggerName: item.name,
        samples,
        avgRoas,
        avgCpa,
        avgLtv90,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function recommendPlaybook(lead: LeadAggregate): ChurnPlaybookAction["action"] {
  const idleHours = hoursSince(lead.lastEventAt);
  if (lead.revenue >= 3000) {
    return "vip_followup";
  }
  if (lead.refunds > 0 || idleHours >= 72) {
    return "support_ticket";
  }
  if (lead.purchases > 0 && lead.maxWatchSeconds < 5 * 60) {
    return "welcome_call";
  }
  return "downsell_offer";
}

export function buildLeadIntelligenceDashboard(params: {
  events: LeadEventRecord[];
  triggerRows: TriggerPerformanceRecord[];
  playbookActions: ChurnPlaybookAction[];
  warRoomData?: WarRoomData;
}): LeadIntelligenceDashboard {
  const fallbackEvents =
    params.events.length > 0 ? params.events : params.warRoomData ? buildFallbackEventsFromWarRoom(params.warRoomData) : [];
  const leads = aggregateLeads(fallbackEvents);
  const bySource = new Map<string, { leads: number; adCost: number; revenue: number }>();
  for (const lead of leads) {
    const key = lead.source || "unknown";
    const current = bySource.get(key) ?? { leads: 0, adCost: 0, revenue: 0 };
    current.leads += 1;
    current.adCost += lead.adCost;
    current.revenue += lead.revenue;
    bySource.set(key, current);
  }

  const rplBySource = [...bySource.entries()]
    .map(([source, value]) => ({
      source,
      leads: value.leads,
      adCost: value.adCost,
      revenue: value.revenue,
      revenuePerLead: safeDivide(value.revenue, value.leads || 1),
    }))
    .sort((a, b) => b.revenuePerLead - a.revenuePerLead);

  const breakevenBySource = rplBySource.map((row) => {
    const breakevenDay = row.revenue <= 0 ? 999 : Math.max(1, Math.round(safeDivide(row.adCost, row.revenue) * 30));
    return {
      source: row.source,
      adCost: row.adCost,
      cumulativeRevenue: row.revenue,
      breakevenDay,
      status: row.revenue > row.adCost ? ("profit" as const) : breakevenDay <= 30 ? ("breakeven" as const) : ("recovering" as const),
    };
  });

  const whaleAlerts = leads
    .filter((lead) => lead.revenue >= 5_000 || lead.purchases >= 3)
    .map((lead) => ({
      leadId: lead.leadId,
      totalRevenue: lead.revenue,
      purchases: lead.purchases,
      source: lead.source,
      note: lead.revenue >= 5_000 ? "Cliente com ticket elevado (VIP onboarding)." : "Comprador com multiplas compras no funil.",
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 20);

  const retargetGaps = leads
    .filter((lead) => lead.purchases === 0 && lead.maxWatchSeconds >= 8 * 60)
    .map((lead) => ({
      leadId: lead.leadId,
      source: lead.source,
      utmContent: lead.utmContent,
      maxWatchMinutes: lead.maxWatchSeconds / 60,
      idleHours: hoursSince(lead.lastEventAt),
      reason: "Assistiu VSL por tempo alto e nao converteu. Priorizar retarget dinamico.",
    }))
    .sort((a, b) => b.maxWatchMinutes - a.maxWatchMinutes)
    .slice(0, 30);

  const playbookByLead = new Map(params.playbookActions.map((action) => [action.leadId, action]));
  const churnRadar = leads
    .filter((lead) => lead.purchases > 0 || lead.revenue > 0)
    .map((lead) => {
      const idleHours = hoursSince(lead.lastEventAt);
      const refundPenalty = lead.refunds > 0 ? 35 : 0;
      const lowConsumptionPenalty = lead.maxWatchSeconds < 4 * 60 ? 22 : 0;
      const inactivityPenalty = idleHours >= 48 ? Math.min(28, idleHours / 3) : 0;
      const riskScore = Math.max(0, Math.min(100, refundPenalty + lowConsumptionPenalty + inactivityPenalty));
      return {
        leadId: lead.leadId,
        riskScore,
        purchases: lead.purchases,
        refunds: lead.refunds,
        watchMinutes: lead.maxWatchSeconds / 60,
        idleHours,
        source: lead.source,
        recommendedPlaybook: playbookByLead.get(lead.leadId)?.action ?? recommendPlaybook(lead),
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 25);

  const timeline = leads
    .map((lead) => ({
      leadId: lead.leadId,
      lastEventAt: lead.lastEventAt,
      stage: inferStage(lead),
      watchMinutes: lead.maxWatchSeconds / 60,
      purchases: lead.purchases,
      refunds: lead.refunds,
      source: lead.source,
    }))
    .sort((a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime())
    .slice(0, 80);

  return {
    generatedAt: nowIso(),
    timeline,
    rplBySource,
    breakevenBySource,
    whaleAlerts,
    retargetGaps,
    churnRadar,
    creativeHeatmap: buildCreativeHeatmap(fallbackEvents),
    ipTriggerRanking: buildTriggerRanking(params.triggerRows),
  };
}
