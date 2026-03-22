import { safeDivide } from "@/lib/metrics/kpis";
import type { AwarenessStage, WarRoomData } from "@/lib/war-room/types";

function inferAwarenessStage(params: {
  completionPct: number;
  openedEmails7d: number;
  clickedEmails7d: number;
  purchases: number;
}): AwarenessStage {
  if (params.purchases >= 2) {
    return "most_aware";
  }
  if (params.purchases >= 1 || params.completionPct >= 70) {
    return "product_aware";
  }
  if (params.clickedEmails7d >= 2 || params.completionPct >= 45) {
    return "solution_aware";
  }
  if (params.openedEmails7d >= 2 || params.completionPct >= 25) {
    return "problem_aware";
  }
  return "unaware";
}

function estimatePredictedLtv90d(params: {
  currentLtv: number;
  completionPct: number;
  openedEmails7d: number;
  clickedEmails7d: number;
  purchases: number;
}) {
  const completionFactor = 0.45 + params.completionPct / 100;
  const emailFactor = 1 + params.openedEmails7d * 0.03 + params.clickedEmails7d * 0.06;
  const purchaseFactor = 1 + params.purchases * 0.22;
  const base = Math.max(50, params.currentLtv);
  return Math.max(base, base * completionFactor * emailFactor * purchaseFactor);
}

function buildFallbackLeads(data: WarRoomData) {
  const topRows = [...data.liveAdsTracking].slice(0, 8);
  return topRows.map((row, index) => {
    const completionPct = Math.min(100, safeDivide(row.views15s, row.views3s || 1) * 100);
    const openedEmails7d = 1 + (index % 4);
    const clickedEmails7d = index % 3;
    const purchases = Math.max(0, Math.round((row.roas - 1.4) * 0.8));
    const currentLtv = Math.max(100, row.ltv * (0.35 + completionPct / 200));
    const predictedLtv90d = estimatePredictedLtv90d({
      currentLtv,
      completionPct,
      openedEmails7d,
      clickedEmails7d,
      purchases,
    });
    return {
      leadId: `LEAD-${row.id}-${index + 1}`,
      awarenessStage: inferAwarenessStage({ completionPct, openedEmails7d, clickedEmails7d, purchases }),
      lastVslId: row.id,
      watchSeconds: Math.round(45 + completionPct * 1.8),
      watchCompletionPct: completionPct,
      openedEmails7d,
      clickedEmails7d,
      purchases,
      currentLtv,
      predictedLtv90d,
      lastTouchAt: new Date().toISOString(),
    };
  });
}

export function enrichCustomerCentrality(data: WarRoomData): WarRoomData {
  const next = structuredClone(data);
  const leads = next.customerCentrality?.leads && next.customerCentrality.leads.length > 0
    ? next.customerCentrality.leads.map((lead) => {
        const awarenessStage = inferAwarenessStage({
          completionPct: lead.watchCompletionPct,
          openedEmails7d: lead.openedEmails7d,
          clickedEmails7d: lead.clickedEmails7d,
          purchases: lead.purchases,
        });
        const predictedLtv90d = estimatePredictedLtv90d({
          currentLtv: lead.currentLtv,
          completionPct: lead.watchCompletionPct,
          openedEmails7d: lead.openedEmails7d,
          clickedEmails7d: lead.clickedEmails7d,
          purchases: lead.purchases,
        });
        return {
          ...lead,
          awarenessStage,
          predictedLtv90d,
        };
      })
    : buildFallbackLeads(next);

  const stages: AwarenessStage[] = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"];
  const awarenessDistribution = stages.map((stage) => {
    const scoped = leads.filter((lead) => lead.awarenessStage === stage);
    const avgPredictedLtv90d = safeDivide(
      scoped.reduce((acc, lead) => acc + lead.predictedLtv90d, 0),
      scoped.length || 1,
    );
    return {
      stage,
      leads: scoped.length,
      avgPredictedLtv90d,
    };
  });

  next.customerCentrality = {
    leads,
    awarenessDistribution,
  };
  return next;
}
