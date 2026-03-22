import { computeKpis, safeDivide } from "@/lib/metrics/kpis";
import type { SquadSyncCommandOrder, SquadSyncKpiSnapshot, WarRoomData } from "@/lib/war-room/types";

type AudienceLabel = "editors" | "copywriters" | "mediaBuyers" | "techCro" | "ceoFinance";
type OrderStatus = "winner" | "scaling" | "failing";

type AngleSummary = {
  angle: string;
  avgCpa: number;
  avgRoas: number;
  avgHookDelta24h: number;
  count: number;
};

type MetricAssessment = {
  value: number;
  benchmark: number;
  status: OrderStatus;
  sector: AudienceLabel;
  diagnosis: string;
  action: string;
};

const VALIDATED_ASSET_INPUT = [
  { assetId: "1450", cpa: 98 },
  { assetId: "1400", cpa: 103 },
  { assetId: "1402", cpa: 95 },
  { assetId: "1059", cpa: 129 },
  { assetId: "1076", cpa: 135 },
  { assetId: "1400 REFEITO", cpa: 107 },
] as const;

export const ELITE_BENCHMARKS = {
  hookRate: 25,
  holdRate15s: 30,
  icRate: 12,
  merCritical: 2.5,
  merScale: 4.0,
} as const;

function toStatus(value: number, benchmark: number): OrderStatus {
  if (value >= benchmark * 1.08) {
    return "winner";
  }
  if (value >= benchmark) {
    return "scaling";
  }
  return "failing";
}

function statusByCpa(cpa: number) {
  if (cpa < 105) {
    return "scale" as const;
  }
  if (cpa <= 120) {
    return "stabilize" as const;
  }
  return "pause" as const;
}

function buildValidatedAssets(data: WarRoomData) {
  const source = data.integrations.attribution.validatedAssets;
  const merged = VALIDATED_ASSET_INPUT.map((asset) => {
    const fromSource = source.find((row) => row.assetId === asset.assetId);
    const isTrackingOverride = asset.assetId === "1400 REFEITO";
    const effectiveCpa =
      isTrackingOverride && fromSource?.trackingSource === "utmifyClickToPurchase"
        ? fromSource.effectiveCpa || asset.cpa
        : fromSource?.effectiveCpa || asset.cpa;
    const status = statusByCpa(effectiveCpa);
    return {
      assetId: asset.assetId,
      inputCpa: asset.cpa,
      effectiveCpa,
      status,
      trackingSource: isTrackingOverride ? "utmifyClickToPurchase" : (fromSource?.trackingSource ?? "facebookApi"),
      note: isTrackingOverride
        ? "Tracking Error: usar somente Click-to-Purchase da Utmify."
        : status === "scale"
          ? "Escala vertical liberada."
          : status === "stabilize"
            ? "Ativo em estabilizacao."
            : "Pausar e refatorar.",
      salesVolumeShare: fromSource?.salesVolumeShare ?? 10,
    };
  });
  return merged.sort((a, b) => a.effectiveCpa - b.effectiveCpa);
}

export function inferAngle(campaign: string, adName: string) {
  const text = `${campaign} ${adName}`.toLowerCase();
  if (/prova|depoimento|social/.test(text)) {
    return "Prova Social";
  }
  if (/mecanismo|cient|metodo|framework/.test(text)) {
    return "Mecanismo Cientifico";
  }
  if (/objec|preco|quebra/.test(text)) {
    return "Quebra de Objecao";
  }
  if (/comparativo|transformacao|antes|depois|visual/.test(text)) {
    return "Comparativo Visual";
  }
  return "Narrativa Direta";
}

function evaluateGlobalMetrics(data: WarRoomData) {
  const totalImpressions = data.liveAdsTracking.reduce((acc, row) => acc + row.impressions, 0);
  const totalViews3s = data.liveAdsTracking.reduce((acc, row) => acc + row.views3s, 0);
  const totalViews15s = data.liveAdsTracking.reduce((acc, row) => acc + row.views15s, 0);
  const totalClicks = data.liveAdsTracking.reduce((acc, row) => acc + row.clicks, 0);
  const totalIc = data.liveAdsTracking.reduce((acc, row) => acc + row.ic, 0);
  const totalSpend = data.globalOverview.trafficSources.reduce((acc, row) => acc + row.spend, 0);
  const grossRevenue = data.enterprise.ceoFinance.grossRevenue || data.globalOverview.revenue;

  const computed = {
    hookRate: safeDivide(totalViews3s, totalImpressions) * 100,
    holdRate15s: safeDivide(totalViews15s, totalViews3s) * 100,
    icRate: safeDivide(totalIc, totalClicks) * 100,
    mer: safeDivide(grossRevenue, totalSpend || data.enterprise.ceoFinance.adSpend),
  };

  // Senior-only note:
  // Traffic daily input has operational priority; when present it overrides raw aggregates
  // to ensure the whole DSS reacts instantly to manager-provided battlefield data.
  const daily = data.squadSync.dailyInput.kpisToday;
  return {
    hookRate: daily.hookRate > 0 ? daily.hookRate : computed.hookRate,
    holdRate15s: daily.holdRate15s > 0 ? daily.holdRate15s : computed.holdRate15s,
    icRate: daily.icRate > 0 ? daily.icRate : computed.icRate,
    mer: data.integrations.merCross.value > 0 ? data.integrations.merCross.value : computed.mer,
  };
}

function assessMetrics(metrics: ReturnType<typeof evaluateGlobalMetrics>): Record<"hookRate" | "holdRate15s" | "icRate" | "mer", MetricAssessment> {
  return {
    hookRate: {
      value: metrics.hookRate,
      benchmark: ELITE_BENCHMARKS.hookRate,
      status: toStatus(metrics.hookRate, ELITE_BENCHMARKS.hookRate),
      sector: "editors",
      diagnosis: "Hook Rate (3s/Imp) abaixo da meta de elite.",
      action: "Acionar Edicao para criar novos ganchos de 5s com pattern interrupt.",
    },
    holdRate15s: {
      value: metrics.holdRate15s,
      benchmark: ELITE_BENCHMARKS.holdRate15s,
      status: toStatus(metrics.holdRate15s, ELITE_BENCHMARKS.holdRate15s),
      sector: "copywriters",
      diagnosis: "Hold Rate (15s/3s) abaixo da meta de elite.",
      action: "Acionar Copy para reforcar lead e clareza de promessa nos 15s iniciais.",
    },
    icRate: {
      value: metrics.icRate,
      benchmark: ELITE_BENCHMARKS.icRate,
      status: toStatus(metrics.icRate, ELITE_BENCHMARKS.icRate),
      sector: "techCro",
      diagnosis: "IC Rate (Checkout/Clicks) abaixo da meta de elite.",
      action: "Acionar Tech/CRO para reduzir friccao de pagina e checkout.",
    },
    mer: {
      value: metrics.mer,
      benchmark: ELITE_BENCHMARKS.merCritical,
      status: metrics.mer > ELITE_BENCHMARKS.merScale ? "winner" : toStatus(metrics.mer, ELITE_BENCHMARKS.merCritical),
      sector: "ceoFinance",
      diagnosis: "MER global fora da zona de escala segura.",
      action:
        metrics.mer > ELITE_BENCHMARKS.merScale
          ? "Sugerir aumento de budget em +20%."
          : metrics.mer < ELITE_BENCHMARKS.merCritical
            ? "Travar escala ate recuperar MER >= 2.5."
            : "Manter escala com monitoramento de risco.",
    },
  };
}

function summarizeAngles(data: WarRoomData): AngleSummary[] {
  const grouped = new Map<string, { totalCpa: number; totalRoas: number; totalDelta: number; count: number }>();

  for (const row of data.liveAdsTracking) {
    const angle = inferAngle(row.campaign, row.adName);
    const current = grouped.get(angle) ?? { totalCpa: 0, totalRoas: 0, totalDelta: 0, count: 0 };
    const hookFirst = row.trend24h.hookRate[0] ?? computeKpis(row).hookRate;
    const hookLast = row.trend24h.hookRate[row.trend24h.hookRate.length - 1] ?? computeKpis(row).hookRate;
    current.totalCpa += row.cpa;
    current.totalRoas += row.roas;
    current.totalDelta += hookLast - hookFirst;
    current.count += 1;
    grouped.set(angle, current);
  }

  return [...grouped.entries()].map(([angle, group]) => ({
    angle,
    avgCpa: safeDivide(group.totalCpa, group.count),
    avgRoas: safeDivide(group.totalRoas, group.count),
    avgHookDelta24h: safeDivide(group.totalDelta, group.count),
    count: group.count,
  }));
}

function deriveAngleMovement(angles: AngleSummary[]) {
  if (angles.length === 0) {
    return { rising: [] as AngleSummary[], saturated: [] as AngleSummary[] };
  }

  const sortedByCpa = [...angles].sort((a, b) => a.avgCpa - b.avgCpa);
  const medianCpa = sortedByCpa[Math.floor(sortedByCpa.length / 2)]?.avgCpa ?? sortedByCpa[0].avgCpa;

  const rising = angles
    .filter((angle) => angle.avgHookDelta24h > 0.8 && angle.avgCpa <= medianCpa * 1.05)
    .sort((a, b) => b.avgHookDelta24h - a.avgHookDelta24h);

  const saturated = angles
    .filter((angle) => angle.avgHookDelta24h < -0.8 || angle.avgRoas < 2)
    .sort((a, b) => a.avgHookDelta24h - b.avgHookDelta24h);

  return {
    rising: rising.length > 0 ? rising : sortedByCpa.slice(0, 2),
    saturated: saturated.length > 0 ? saturated : [...angles].sort((a, b) => a.avgRoas - b.avgRoas).slice(0, 2),
  };
}

export function buildCommandOrdersFromSnapshot(params: {
  creativeId: string;
  kpisToday: SquadSyncKpiSnapshot;
  mer: number;
  audienceFatigue: boolean;
  generatedAt: string;
}): SquadSyncCommandOrder[] {
  const orders: SquadSyncCommandOrder[] = [];
  const { creativeId, kpisToday, mer, audienceFatigue, generatedAt } = params;

  if (kpisToday.hookRate < ELITE_BENCHMARKS.hookRate) {
    orders.push({
      id: `CMD-${Date.now()}-HK`,
      audience: "editors",
      status: "failing",
      title: "Gancho abaixo do benchmark",
      diagnosis: `Hook Rate em ${kpisToday.hookRate.toFixed(2)}% (meta > ${ELITE_BENCHMARKS.hookRate}%).`,
      action: `Criar 3 novos hooks para o criativo ${creativeId} com pattern interrupt nos primeiros 5s.`,
      createdAt: generatedAt,
    });
  }

  if (kpisToday.holdRate15s < ELITE_BENCHMARKS.holdRate15s) {
    orders.push({
      id: `CMD-${Date.now()}-HD`,
      audience: "copywriters",
      status: "failing",
      title: "Lead fraca na abertura",
      diagnosis: `Hold Rate em ${kpisToday.holdRate15s.toFixed(2)}% (meta > ${ELITE_BENCHMARKS.holdRate15s}%).`,
      action: "Reescrever lead com promessa mais concreta e prova até 15s.",
      createdAt: generatedAt,
    });
  }

  if (kpisToday.icRate < ELITE_BENCHMARKS.icRate) {
    orders.push({
      id: `CMD-${Date.now()}-IC`,
      audience: "techCro",
      status: "failing",
      title: "Friccao no checkout",
      diagnosis: `IC Rate em ${kpisToday.icRate.toFixed(2)}% (meta > ${ELITE_BENCHMARKS.icRate}%).`,
      action: "Auditar LP/checkout imediatamente (tempo de carga, campos e prova de confiança).",
      createdAt: generatedAt,
    });
  }

  if (mer < ELITE_BENCHMARKS.merCritical) {
    orders.push({
      id: `CMD-${Date.now()}-MER-LOCK`,
      audience: "ceoFinance",
      status: "failing",
      title: "Escala travada por MER",
      diagnosis: `MER em ${mer.toFixed(2)}x (zona critica < ${ELITE_BENCHMARKS.merCritical.toFixed(1)}x).`,
      action: "Travar escala e priorizar recuperação de eficiência antes de subir budget.",
      createdAt: generatedAt,
    });
  } else if (mer > ELITE_BENCHMARKS.merScale) {
    orders.push({
      id: `CMD-${Date.now()}-MER-UP`,
      audience: "mediaBuyers",
      status: "winner",
      title: "Escala liberada",
      diagnosis: `MER em ${mer.toFixed(2)}x acima da zona de escala (${ELITE_BENCHMARKS.merScale.toFixed(1)}x).`,
      action: "Sugestão DSS: aumentar budget consolidado em +20% com monitoramento de CPA.",
      createdAt: generatedAt,
    });
  }

  if (audienceFatigue) {
    orders.push({
      id: `CMD-${Date.now()}-FAT`,
      audience: "mediaBuyers",
      status: "scaling",
      title: "Alerta de fadiga de publico",
      diagnosis: "Frequencia > 2.2 com queda de CTR detectada.",
      action: "Refrescar criativos e abrir nova segmentacao para reduzir saturacao.",
      createdAt: generatedAt,
    });
  }

  return orders;
}

export function computeIntelligenceEngine(data: WarRoomData) {
  const metrics = evaluateGlobalMetrics(data);
  const assessments = assessMetrics(metrics);
  const angles = summarizeAngles(data);
  const angleMovement = deriveAngleMovement(angles);
  const validatedAssets = buildValidatedAssets(data);

  const editorPriorities = data.liveAdsTracking
    .map((row) => ({ row, hookRate: computeKpis(row).hookRate, holdRate: computeKpis(row).holdRate }))
    .filter((item) => item.row.roas > 2 && item.hookRate < 20)
    .sort((a, b) => a.hookRate - b.hookRate || b.row.roas - a.row.roas);

  const audienceFatigue = data.liveAdsTracking
    .filter((row) => {
      const ctr = row.uniqueCtrTrend3d;
      const ctrDown = ctr.length >= 3 && ctr[0] > ctr[1] && ctr[1] > ctr[2];
      return row.frequency > 2.2 && ctrDown;
    })
    .map((row) => ({
      creativeId: row.id,
      frequency: row.frequency,
      ctrNow: row.uniqueCtr,
      ctrTrend: row.uniqueCtrTrend3d,
    }));

  const redAssets = validatedAssets.filter((asset) => asset.status === "pause");
  const autoMirrorTriggers = redAssets.map((asset) => ({
    sourceAssetId: asset.assetId,
    copyTask: `Análise de Gancho - ${asset.assetId}`,
    editTask: `Produção de 5 variações de Hook - ${asset.assetId}`,
    impact: asset.salesVolumeShare >= 18 ? "critical" : "high",
  }));

  const currentApproval = data.integrations.gateway.appmaxCardApprovalRate;
  const prevDayApproval = data.integrations.gateway.appmaxPreviousDayApprovalRate;
  const gatewayApprovalDropPct =
    prevDayApproval > 0 ? ((prevDayApproval - currentApproval) / prevDayApproval) * 100 : 0;
  const gatewayHealthAlert = prevDayApproval > 0 && currentApproval < prevDayApproval * 0.9;

  const now = new Date();
  const generatedAt = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const orders = buildCommandOrdersFromSnapshot({
    creativeId: data.squadSync.dailyInput.creativeId || data.liveAdsTracking[0]?.id || "N/A",
    kpisToday: data.squadSync.dailyInput.kpisToday,
    mer: metrics.mer,
    audienceFatigue: audienceFatigue.length > 0,
    generatedAt,
  });

  return {
    metrics,
    assessments,
    scalePolicy: {
      locked: metrics.mer < ELITE_BENCHMARKS.merCritical,
      suggestedBudgetIncreasePct: metrics.mer > ELITE_BENCHMARKS.merScale ? 20 : 0,
      reason:
        metrics.mer > ELITE_BENCHMARKS.merScale
          ? "MER acima de 4.0x. Escala sugerida em +20%."
          : metrics.mer < ELITE_BENCHMARKS.merCritical
            ? "MER abaixo de 2.5x. Escala deve ser travada."
            : "MER em zona de operacao controlada (2.5x-4.0x).",
    },
    editorPriorities,
    audienceFatigue,
    validatedAssets,
    autoMirrorTriggers,
    gatewayHealth: {
      currentApproval,
      prevDayApproval,
      dropPct: gatewayApprovalDropPct,
      alert: gatewayHealthAlert,
    },
    angleComparative: angles.sort((a, b) => a.avgCpa - b.avgCpa),
    angleMovement,
    commandOrders: orders,
  };
}
