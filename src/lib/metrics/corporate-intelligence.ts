import { safeDivide } from "@/lib/metrics/kpis";
import type { AwarenessStage, WarRoomData } from "@/lib/war-room/types";

const DIRECT_PROMISE_HINTS = ["ganhe", "fique", "perca", "pare", "resultado", "lucro rapido", "sem esforco"];
const INDIRECT_MECHANISM_HINTS = ["metodo", "mecanismo", "segredo", "historia", "protocolo", "brecha"];

function includesAny(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stageToTrack(stage: AwarenessStage) {
  if (stage === "unaware" || stage === "problem_aware") {
    return "Suplementos";
  }
  if (stage === "solution_aware") {
    return "Biohacking";
  }
  if (stage === "product_aware") {
    return "Oferta Premium de Continuidade";
  }
  return "Assinatura / Mastermind";
}

export function computeMarketSentimentTracker(data: WarRoomData) {
  const directRows = data.liveAdsTracking.filter((row) => includesAny(row.adName, DIRECT_PROMISE_HINTS));
  const indirectRows = data.liveAdsTracking.filter((row) => includesAny(row.adName, INDIRECT_MECHANISM_HINTS));

  const directCtr = avg(directRows.map((row) => row.uniqueCtr));
  const indirectCtr = avg(indirectRows.map((row) => row.uniqueCtr));
  const directTrend = avg(directRows.map((row) => {
    if (row.uniqueCtrTrend3d.length < 2) return 0;
    return row.uniqueCtrTrend3d[row.uniqueCtrTrend3d.length - 1] - row.uniqueCtrTrend3d[0];
  }));
  const indirectTrend = avg(indirectRows.map((row) => {
    if (row.uniqueCtrTrend3d.length < 2) return 0;
    return row.uniqueCtrTrend3d[row.uniqueCtrTrend3d.length - 1] - row.uniqueCtrTrend3d[0];
  }));
  const avgSophistication = avg(data.enterprise.copyResearch.bigIdeaVault.map((item) => item.marketSophisticationLevel ?? 3));
  const demandMoreSophisticated =
    directCtr > 0 &&
    (directCtr < Math.max(0.6, indirectCtr * 0.9) || directTrend < -0.22 || (directTrend < 0 && indirectTrend > 0));
  const suggestedLevel = Math.min(5, Math.max(1, Math.round(avgSophistication + (demandMoreSophisticated ? 1 : 0))));

  return {
    level: suggestedLevel,
    directCtr,
    indirectCtr,
    directTrend,
    indirectTrend,
    recommendation: demandMoreSophisticated
      ? "Mercado mais vacinado para promessa direta. Migrar para Mecanismo Indireto (Historia/Segredo)."
      : "Promessa direta ainda performa. Manter teste paralelo com mecanismos indiretos.",
    demandMoreSophisticated,
  };
}

export function computeYieldOptimizer(data: WarRoomData) {
  const leads = data.customerCentrality?.leads ?? [];
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const staleLeads = leads.filter((lead) => lead.purchases === 0 && nowMs - new Date(lead.lastTouchAt).getTime() >= sevenDaysMs);

  const crossSellRecommendations = staleLeads
    .map((lead) => ({
      leadId: lead.leadId,
      fromOffer: lead.lastVslId,
      targetTrack: stageToTrack(lead.awarenessStage),
      reason: `Sem compra apos 7 dias. Estagio: ${lead.awarenessStage}.`,
      predictedRevenueLift: Math.round(lead.predictedLtv90d * 0.24),
    }))
    .slice(0, 25);

  const totalRevenue = data.integrations.gateway.consolidatedNetRevenue;
  const acquiredLeads = Math.max(
    1,
    data.integrations.fortress.pixelSync.realPurchases + staleLeads.length + Math.max(0, leads.length - 3),
  );
  const baseRevenuePerLead = safeDivide(totalRevenue, acquiredLeads);
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const revenuePerLead12m = labels.map((label, index) => {
    const growth = 0.84 + index * 0.035;
    const stability = 0.96 + (index % 3) * 0.025;
    return {
      month: label,
      value: Math.max(0, baseRevenuePerLead * growth * stability),
    };
  });

  const avgCpa = avg(data.liveAdsTracking.map((row) => row.cpa));
  const leadRecyclingMap = data.liveAdsTracking
    .filter((row) => row.cpa > avgCpa * 1.12 && row.roas < 2.0)
    .map((row) => ({
      sourceCreativeId: row.id,
      sourceOffer: row.adName,
      suggestedTarget: row.upsellConversion < 12 ? "Biohacking" : "Suplementos",
      reason: `CPA ${row.cpa.toFixed(0)} acima da media e ROAS ${row.roas.toFixed(2)}.`,
    }))
    .slice(0, 12);

  const byOrigin = new Map<string, { leads: number; predictedRevenue: number }>();
  for (const lead of leads) {
    const current = byOrigin.get(lead.lastVslId) ?? { leads: 0, predictedRevenue: 0 };
    current.leads += 1;
    current.predictedRevenue += lead.predictedLtv90d;
    byOrigin.set(lead.lastVslId, current);
  }
  const backEndRevenueByOrigin = [...byOrigin.entries()]
    .map(([origin, value]) => ({
      origin,
      leads: value.leads,
      predictedBackEndRevenue: value.predictedRevenue,
    }))
    .sort((a, b) => b.predictedBackEndRevenue - a.predictedBackEndRevenue)
    .slice(0, 12);

  return {
    crossSellRecommendations,
    revenuePerLead12m,
    leadRecyclingMap,
    backEndRevenueByOrigin,
  };
}

export function computeEquityValuation(data: WarRoomData) {
  const netProfit = data.enterprise.ceoFinance.netProfit;
  const ltmEbitda = netProfit * 12;
  const mer = data.integrations.merCross.value;
  const baseMultiple = 3 + Math.max(0, Math.min(2, (mer - 2) / 1.5));
  const multiple = Math.max(3, Math.min(5, baseMultiple));
  const activeLeads = (data.customerCentrality?.leads ?? []).filter((lead) => {
    const ageDays = (Date.now() - new Date(lead.lastTouchAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 120;
  });
  const avgPredictedLtv = avg(activeLeads.map((lead) => lead.predictedLtv90d));
  const valuePerLead = Math.max(15, Math.min(140, avgPredictedLtv * 0.07));
  const databaseValue = activeLeads.length * valuePerLead;
  const estimatedValuation = ltmEbitda * multiple + databaseValue;

  const equity12m = Array.from({ length: 12 }).map((_, index) => {
    const monthIndex = 11 - index;
    const factor = 0.78 + monthIndex * 0.025;
    return Math.max(0, estimatedValuation * factor);
  });

  return {
    ltmEbitda,
    multiple,
    activeLeads: activeLeads.length,
    valuePerLead,
    databaseValue,
    estimatedValuation,
    equity12m,
  };
}
