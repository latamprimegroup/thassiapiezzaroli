import { safeDivide } from "@/lib/metrics/kpis";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { getOpsJobStats } from "@/lib/persistence/war-room-ops-repository";
import type { TrafficSourceKey, WarRoomData } from "@/lib/war-room/types";
import type { ProviderName, RecoveryAgent, UnifiedProviderEvent } from "./warroom-adapters";

type ApiStatus = {
  status: "online" | "syncing" | "error";
  lastSync: string;
  trend12h: number[];
  errorMessage: string;
};

type IntegrationState = {
  apiStatus: Record<ProviderName, ApiStatus>;
  utmify: {
    spendTotal: number;
    creatives: Record<string, { source: TrafficSourceKey; profit: number; roas: number; clickToPurchaseCpa: number }>;
    metaReportedPurchases: number;
    paidTrafficRevenue: number;
    ltv7d: number;
    ltv30d: number;
    ltv90d: number;
  };
  appmax: {
    gross: number;
    net: number;
    cardApprovalRate: number;
    previousDayApprovalRate: number;
    purchaseCount: number;
    crmEmailRevenue: number;
    crmSmsRevenue: number;
    crmWhatsappRevenue: number;
    recoveryAgents: RecoveryAgent[];
  };
  kiwify: {
    gross: number;
    net: number;
    purchaseCount: number;
    upsellTakeRates: {
      upsell1: number;
      upsell2: number;
      upsell3: number;
    };
  };
  yampi: {
    cartAbandonmentRate: number;
  };
  config: {
    fixedCosts: number;
    taxRatePct: number;
  };
  merTrend12h: number[];
};

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function toTrend(history: number[], value: number) {
  return [...history, Number.isFinite(value) ? value : 0].slice(-12);
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }
  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

function buildNamingDriftAlerts(next: WarRoomData) {
  const registry = next.enterprise.copyResearch.namingRegistry;
  const alerts: WarRoomData["integrations"]["attribution"]["namingDriftAlerts"] = [];
  for (const row of next.liveAdsTracking) {
    const exact = registry.find((item) => item.linkedCreativeId === row.id);
    if (exact) {
      continue;
    }
    const closest = registry
      .map((item) => ({
        item,
        distance: levenshteinDistance(item.linkedCreativeId.toUpperCase(), row.id.toUpperCase()),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (closest && closest.distance <= WAR_ROOM_OPS_CONSTANTS.naming.maxLevenshteinDistance) {
      alerts.push({
        creativeId: row.id,
        severity: "warning",
        reason: `Possivel erro de digitacao no ID do criativo (distancia ${closest.distance}).`,
        suggestedRegistryId: closest.item.uniqueId,
        suggestedDnaName: closest.item.dnaName,
      });
      continue;
    }
    alerts.push({
      creativeId: row.id,
      severity: "critical",
      reason: "Criativo sem mapeamento no Naming Registry.",
      suggestedRegistryId: "",
      suggestedDnaName: "",
    });
  }
  return alerts.slice(0, 20);
}

function createInitialState(): IntegrationState {
  return {
    apiStatus: {
      utmify: { status: "syncing", lastSync: "N/A", trend12h: [0], errorMessage: "" },
      appmax: { status: "syncing", lastSync: "N/A", trend12h: [0], errorMessage: "" },
      kiwify: { status: "syncing", lastSync: "N/A", trend12h: [0], errorMessage: "" },
      yampi: { status: "syncing", lastSync: "N/A", trend12h: [0], errorMessage: "" },
    },
    utmify: {
      spendTotal: 0,
      creatives: {},
      metaReportedPurchases: 0,
      paidTrafficRevenue: 0,
      ltv7d: 0,
      ltv30d: 0,
      ltv90d: 0,
    },
    appmax: {
      gross: 0,
      net: 0,
      cardApprovalRate: 0,
      previousDayApprovalRate: 0,
      purchaseCount: 0,
      crmEmailRevenue: 0,
      crmSmsRevenue: 0,
      crmWhatsappRevenue: 0,
      recoveryAgents: [],
    },
    kiwify: {
      gross: 0,
      net: 0,
      purchaseCount: 0,
      upsellTakeRates: {
        upsell1: 0,
        upsell2: 0,
        upsell3: 0,
      },
    },
    yampi: {
      cartAbandonmentRate: 0,
    },
    config: {
      fixedCosts: Number(process.env.WAR_ROOM_FIXED_COSTS ?? 0) || 0,
      taxRatePct: Number(process.env.WAR_ROOM_TAX_RATE_PCT ?? 0) || 0,
    },
    merTrend12h: [0],
  };
}

declare global {
  var __warRoomIntegrationState: IntegrationState | undefined;
}

function getState() {
  if (!globalThis.__warRoomIntegrationState) {
    globalThis.__warRoomIntegrationState = createInitialState();
  }
  return globalThis.__warRoomIntegrationState;
}

export function markProviderError(provider: ProviderName, message: string) {
  const state = getState();
  state.apiStatus[provider] = {
    ...state.apiStatus[provider],
    status: "error",
    lastSync: nowLabel(),
    errorMessage: message,
  };
}

export function ingestIntegrationEvent(event: UnifiedProviderEvent) {
  const state = getState();
  const provider = event.provider;
  const current = state.apiStatus[provider];

  if (provider === "utmify") {
    state.utmify.spendTotal = event.spend > 0 ? event.spend : state.utmify.spendTotal;
    state.utmify.metaReportedPurchases =
      event.meta_reported_purchase_count > 0 ? event.meta_reported_purchase_count : state.utmify.metaReportedPurchases;
    state.utmify.paidTrafficRevenue =
      event.paid_traffic_revenue > 0 ? event.paid_traffic_revenue : state.utmify.paidTrafficRevenue;
    state.utmify.ltv7d = event.ltv_7d > 0 ? event.ltv_7d : state.utmify.ltv7d;
    state.utmify.ltv30d = event.ltv_30d > 0 ? event.ltv_30d : state.utmify.ltv30d;
    state.utmify.ltv90d = event.ltv_90d > 0 ? event.ltv_90d : state.utmify.ltv90d;
    for (const creative of event.creatives) {
      if (!creative.creativeId || creative.creativeId === "N/A") {
        continue;
      }
      state.utmify.creatives[creative.creativeId] = {
        source: creative.source,
        profit: creative.profit,
        roas: creative.roas,
        clickToPurchaseCpa: creative.clickToPurchaseCpa,
      };
    }
    state.apiStatus.utmify = {
      status: "online",
      lastSync: nowLabel(),
      trend12h: toTrend(
        current.trend12h,
        event.creatives.length > 0
          ? safeDivide(event.creatives.reduce((acc, row) => acc + row.roas, 0), event.creatives.length)
          : event.spend,
      ),
      errorMessage: "",
    };
  }

  if (provider === "appmax") {
    state.appmax.gross = event.valor_bruto > 0 ? event.valor_bruto : state.appmax.gross;
    state.appmax.net = event.valor_liquido > 0 ? event.valor_liquido : state.appmax.net;
    state.appmax.cardApprovalRate =
      event.card_approval_rate > 0 ? event.card_approval_rate : state.appmax.cardApprovalRate;
    state.appmax.previousDayApprovalRate =
      event.appmax_previous_day_approval_rate > 0
        ? event.appmax_previous_day_approval_rate
        : state.appmax.previousDayApprovalRate;
    state.appmax.purchaseCount = event.real_purchase_count > 0 ? event.real_purchase_count : state.appmax.purchaseCount;
    state.appmax.crmEmailRevenue = event.crm_email_revenue > 0 ? event.crm_email_revenue : state.appmax.crmEmailRevenue;
    state.appmax.crmSmsRevenue = event.crm_sms_revenue > 0 ? event.crm_sms_revenue : state.appmax.crmSmsRevenue;
    state.appmax.crmWhatsappRevenue =
      event.crm_whatsapp_revenue > 0 ? event.crm_whatsapp_revenue : state.appmax.crmWhatsappRevenue;
    state.appmax.recoveryAgents = event.recovery_agents.length > 0 ? event.recovery_agents : state.appmax.recoveryAgents;
    state.apiStatus.appmax = {
      status: "online",
      lastSync: nowLabel(),
      trend12h: toTrend(current.trend12h, state.appmax.cardApprovalRate),
      errorMessage: "",
    };
  }

  if (provider === "kiwify") {
    state.kiwify.gross = event.valor_bruto > 0 ? event.valor_bruto : state.kiwify.gross;
    state.kiwify.net = event.valor_liquido > 0 ? event.valor_liquido : state.kiwify.net;
    state.kiwify.purchaseCount = event.real_purchase_count > 0 ? event.real_purchase_count : state.kiwify.purchaseCount;
    state.kiwify.upsellTakeRates = {
      upsell1: event.upsell_take_rates.upsell1 || state.kiwify.upsellTakeRates.upsell1,
      upsell2: event.upsell_take_rates.upsell2 || state.kiwify.upsellTakeRates.upsell2,
      upsell3: event.upsell_take_rates.upsell3 || state.kiwify.upsellTakeRates.upsell3,
    };
    const avgUpsell = (state.kiwify.upsellTakeRates.upsell1 + state.kiwify.upsellTakeRates.upsell2 + state.kiwify.upsellTakeRates.upsell3) / 3;
    state.apiStatus.kiwify = {
      status: "online",
      lastSync: nowLabel(),
      trend12h: toTrend(current.trend12h, avgUpsell),
      errorMessage: "",
    };
  }

  if (provider === "yampi") {
    state.yampi.cartAbandonmentRate =
      event.cart_abandonment_rate > 0 ? event.cart_abandonment_rate : state.yampi.cartAbandonmentRate;
    state.apiStatus.yampi = {
      status: "online",
      lastSync: nowLabel(),
      trend12h: toTrend(current.trend12h, state.yampi.cartAbandonmentRate),
      errorMessage: "",
    };
  }

  const consolidatedGross = state.appmax.gross + state.kiwify.gross;
  const spendTotal = state.utmify.spendTotal;
  const mer = safeDivide(consolidatedGross, spendTotal);
  state.merTrend12h = toTrend(state.merTrend12h, mer);
}

export function mergeWarRoomWithIntegrations(base: WarRoomData): WarRoomData {
  const state = getState();
  const next = structuredClone(base);

  const consolidatedGross = state.appmax.gross + state.kiwify.gross;
  const consolidatedNet = state.appmax.net + state.kiwify.net;
  const fallbackSpend = next.globalOverview.trafficSources.reduce((acc, source) => acc + source.spend, 0);
  const spendTotal = state.utmify.spendTotal > 0 ? state.utmify.spendTotal : fallbackSpend;
  const merValue = safeDivide(consolidatedNet || next.integrations.gateway.consolidatedNetRevenue, spendTotal || 1);
  const avgTicket = safeDivide(
    next.liveAdsTracking.reduce((acc, row) => acc + row.aov, 0),
    next.liveAdsTracking.length || 1,
  );
  const realPurchases = Math.max(
    0,
    Math.round(
      state.appmax.purchaseCount + state.kiwify.purchaseCount > 0
        ? state.appmax.purchaseCount + state.kiwify.purchaseCount
        : safeDivide(consolidatedGross || next.integrations.gateway.consolidatedGrossRevenue, avgTicket || 1),
    ),
  );
  const metaReportedPurchases = Math.max(
    0,
    Math.round(
      state.utmify.metaReportedPurchases > 0
        ? state.utmify.metaReportedPurchases
        : Number(process.env.WAR_ROOM_META_REPORTED_PURCHASES ?? realPurchases * 0.88) || 0,
    ),
  );
  const discrepancyPct = realPurchases > 0 ? Math.abs(realPurchases - metaReportedPurchases) / realPurchases * 100 : 0;
  const pixelStatus =
    realPurchases === 0
      ? "no_data"
      : discrepancyPct > WAR_ROOM_OPS_CONSTANTS.thresholds.pixel.maxDiscrepancyPct
        ? "unhealthy"
        : "healthy";
  const paidTrafficRevenue = state.utmify.paidTrafficRevenue > 0 ? state.utmify.paidTrafficRevenue : consolidatedNet * 0.86;
  const crmEmailRevenue = state.appmax.crmEmailRevenue > 0 ? state.appmax.crmEmailRevenue : consolidatedNet * 0.05;
  const crmSmsRevenue = state.appmax.crmSmsRevenue > 0 ? state.appmax.crmSmsRevenue : consolidatedNet * 0.03;
  const crmWhatsappRevenue = state.appmax.crmWhatsappRevenue > 0 ? state.appmax.crmWhatsappRevenue : consolidatedNet * 0.04;
  const crmTotal = crmEmailRevenue + crmSmsRevenue + crmWhatsappRevenue;
  const revenueBySourceTotal = paidTrafficRevenue + crmTotal;
  const crmSharePct = safeDivide(crmTotal, revenueBySourceTotal || 1) * 100;
  const ltvD7 = state.utmify.ltv7d > 0 ? state.utmify.ltv7d : Math.max(0, next.finance.ltv24h * 1.35);
  const ltvD30 = state.utmify.ltv30d > 0 ? state.utmify.ltv30d : Math.max(ltvD7, next.enterprise.ceoFinance.ltvCohorts.d30);
  const ltvD90 = state.utmify.ltv90d > 0 ? state.utmify.ltv90d : Math.max(ltvD30, next.enterprise.ceoFinance.ltvCohorts.d90);
  const averageUpsellTakeRate =
    (state.kiwify.upsellTakeRates.upsell1 + state.kiwify.upsellTakeRates.upsell2 + state.kiwify.upsellTakeRates.upsell3) /
    3;
  const modelWeights = WAR_ROOM_OPS_CONSTANTS.predictiveLtv.weights;
  const qualityScore =
    safeDivide(state.appmax.cardApprovalRate, 100) * modelWeights.appmaxApproval +
    safeDivide(averageUpsellTakeRate, 100) * modelWeights.upsellTakeRate +
    safeDivide(crmSharePct, 100) * modelWeights.crmShare +
    (pixelStatus === "unhealthy" ? modelWeights.pixelHealthPenalty : 0) +
    (state.yampi.cartAbandonmentRate > WAR_ROOM_OPS_CONSTANTS.thresholds.yampi.abandonmentCriticalPct
      ? modelWeights.abandonmentPenalty
      : 0);
  const ltvBaselineFromD7 = ltvD7 * WAR_ROOM_OPS_CONSTANTS.predictiveLtv.baseGrowthFromD7;
  const predictedLtv90d = Math.max(0, ltvBaselineFromD7 * (1 + qualityScore));
  const confidencePct = Math.max(
    WAR_ROOM_OPS_CONSTANTS.predictiveLtv.confidence.min,
    Math.min(
      WAR_ROOM_OPS_CONSTANTS.predictiveLtv.confidence.max,
      55 + safeDivide(state.appmax.cardApprovalRate, 100) * 25 + safeDivide(averageUpsellTakeRate, 100) * 20,
    ),
  );
  const predictiveDrivers = [
    `Aprovacao Appmax ${state.appmax.cardApprovalRate.toFixed(2)}%`,
    `Upsell medio ${averageUpsellTakeRate.toFixed(2)}%`,
    `Share CRM ${crmSharePct.toFixed(2)}%`,
    pixelStatus === "unhealthy" ? "Penalidade por divergencia CAPI/Pixel" : "Pixel em faixa saudavel",
  ];
  const upsellFlowMap = [
    {
      step: "Order Bump",
      takeRate: Math.max(0, state.kiwify.upsellTakeRates.upsell1 * 0.92),
      estimatedRevenue: Math.round(consolidatedNet * 0.08),
      status: state.kiwify.upsellTakeRates.upsell1 >= 20 ? ("scale" as const) : ("attention" as const),
    },
    {
      step: "Upsell 1",
      takeRate: state.kiwify.upsellTakeRates.upsell1,
      estimatedRevenue: Math.round(consolidatedNet * 0.14),
      status: state.kiwify.upsellTakeRates.upsell1 >= 20 ? ("scale" as const) : ("attention" as const),
    },
    {
      step: "Upsell 2",
      takeRate: state.kiwify.upsellTakeRates.upsell2,
      estimatedRevenue: Math.round(consolidatedNet * 0.09),
      status: state.kiwify.upsellTakeRates.upsell2 >= 12 ? ("scale" as const) : ("attention" as const),
    },
    {
      step: "Upsell 3",
      takeRate: state.kiwify.upsellTakeRates.upsell3,
      estimatedRevenue: Math.round(consolidatedNet * 0.05),
      status: state.kiwify.upsellTakeRates.upsell3 >= 8 ? ("scale" as const) : ("attention" as const),
    },
  ];
  const attachBenchmark = WAR_ROOM_OPS_CONSTANTS.thresholds.upsell.attachRateBenchmarkPct;
  const upsellTree = [
    {
      fromProduct: "Core Offer",
      toProduct: "Order Bump",
      buyersFrom: Math.max(1, realPurchases),
      buyersTo: Math.round(realPurchases * safeDivide(next.integrations.gateway.kiwifyUpsellTakeRates.upsell1, 100)),
      attachRate: next.integrations.gateway.kiwifyUpsellTakeRates.upsell1,
      benchmarkAttachRate: attachBenchmark,
      status:
        next.integrations.gateway.kiwifyUpsellTakeRates.upsell1 >= attachBenchmark
          ? ("healthy" as const)
          : ("warning" as const),
    },
    {
      fromProduct: "Order Bump",
      toProduct: "Upsell 1",
      buyersFrom: Math.max(1, Math.round(realPurchases * safeDivide(next.integrations.gateway.kiwifyUpsellTakeRates.upsell1, 100))),
      buyersTo: Math.round(realPurchases * safeDivide(next.integrations.gateway.kiwifyUpsellTakeRates.upsell2, 100)),
      attachRate: next.integrations.gateway.kiwifyUpsellTakeRates.upsell2,
      benchmarkAttachRate: attachBenchmark,
      status:
        next.integrations.gateway.kiwifyUpsellTakeRates.upsell2 >= attachBenchmark
          ? ("healthy" as const)
          : ("warning" as const),
    },
    {
      fromProduct: "Upsell 1",
      toProduct: "Upsell 2",
      buyersFrom: Math.max(1, Math.round(realPurchases * safeDivide(next.integrations.gateway.kiwifyUpsellTakeRates.upsell2, 100))),
      buyersTo: Math.round(realPurchases * safeDivide(next.integrations.gateway.kiwifyUpsellTakeRates.upsell3, 100)),
      attachRate: next.integrations.gateway.kiwifyUpsellTakeRates.upsell3,
      benchmarkAttachRate: attachBenchmark,
      status:
        next.integrations.gateway.kiwifyUpsellTakeRates.upsell3 >= attachBenchmark
          ? ("healthy" as const)
          : ("warning" as const),
    },
  ];
  const attachRateAlerts = upsellTree
    .filter((item) => item.attachRate < attachBenchmark)
    .map(
      (item) =>
        `Attach Rate ${item.fromProduct} -> ${item.toProduct} em ${item.attachRate.toFixed(2)}% (benchmark ${attachBenchmark}%).`,
    );
  const defaultCpa = safeDivide(
    next.liveAdsTracking.reduce((acc, row) => acc + row.cpa, 0),
    next.liveAdsTracking.length || 1,
  );
  const projectedPurchases = Math.max(1, Math.round(safeDivide(spendTotal || next.globalOverview.investment, defaultCpa || 1)));
  const simulatedTaxes = (consolidatedGross * (state.config.taxRatePct > 0 ? state.config.taxRatePct : next.integrations.gateway.taxRatePct)) / 100;
  const simulatedNetProfit =
    consolidatedGross -
    next.enterprise.ceoFinance.gatewayFees -
    simulatedTaxes -
    (spendTotal || next.globalOverview.investment) -
    (state.config.fixedCosts > 0 ? state.config.fixedCosts : next.integrations.gateway.fixedCosts);
  const simulatedRoiPct = safeDivide(simulatedNetProfit, consolidatedGross || 1) * 100;
  const revenuePerMinute = safeDivide(consolidatedGross || next.globalOverview.revenue, 24 * 60);
  const approvalDropThreshold =
    next.integrations.gateway.appmaxPreviousDayApprovalRate *
    (1 - WAR_ROOM_OPS_CONSTANTS.thresholds.appmax.approvalDropAlertPct / 100);
  const approvalIncident = next.integrations.gateway.appmaxCardApprovalRate > 0 &&
    next.integrations.gateway.appmaxCardApprovalRate < approvalDropThreshold;
  const checkoutIncident =
    next.integrations.gateway.yampiCartAbandonmentRate >
    WAR_ROOM_OPS_CONSTANTS.thresholds.yampi.abandonmentCriticalPct;
  const pixelIncident = pixelStatus === "unhealthy";
  const lossPerMinute =
    (checkoutIncident
      ? revenuePerMinute *
        safeDivide(
          next.integrations.gateway.yampiCartAbandonmentRate -
            WAR_ROOM_OPS_CONSTANTS.thresholds.yampi.abandonmentCriticalPct,
          100,
        )
      : 0) +
    (approvalIncident ? revenuePerMinute * 0.22 : 0) +
    (pixelIncident ? revenuePerMinute * 0.18 : 0);
  const currentIncidents: WarRoomData["integrations"]["operations"]["opportunityLost"]["incidents"] = [];
  if (checkoutIncident) {
    currentIncidents.push({
      id: `INC-YAMPI-${Date.now()}`,
      severity: "critical",
      reason: `Checkout com abandono acima de ${WAR_ROOM_OPS_CONSTANTS.thresholds.yampi.abandonmentCriticalPct}%.`,
      estimatedLoss: Math.round(revenuePerMinute * 15),
      startedAt: nowLabel(),
    });
  }
  if (approvalIncident) {
    currentIncidents.push({
      id: `INC-APPMAX-${Date.now()}`,
      severity: "warning",
      reason: `Aprovacao Appmax caiu mais de ${WAR_ROOM_OPS_CONSTANTS.thresholds.appmax.approvalDropAlertPct}%.`,
      estimatedLoss: Math.round(revenuePerMinute * 10),
      startedAt: nowLabel(),
    });
  }
  if (pixelIncident) {
    currentIncidents.push({
      id: `INC-PIXEL-${Date.now()}`,
      severity: "warning",
      reason: "Divergencia Pixel/CAPI acima do limite.",
      estimatedLoss: Math.round(revenuePerMinute * 8),
      startedAt: nowLabel(),
    });
  }
  const reconciliationLedger: WarRoomData["integrations"]["operations"]["reconciliation"]["ledger"] = [
    {
      id: "spend_vs_utmify",
      expected: fallbackSpend,
      observed: spendTotal,
      variancePct: safeDivide(spendTotal - fallbackSpend, fallbackSpend || 1) * 100,
      status:
        Math.abs(safeDivide(spendTotal - fallbackSpend, fallbackSpend || 1) * 100) >
        WAR_ROOM_OPS_CONSTANTS.attribution.reconciliation.spendVarianceWarningPct
          ? "warning"
          : "ok",
      note: "Conferencia do spend consolidado entre fontes internas e Utmify.",
    },
    {
      id: "gross_vs_gateways",
      expected: next.globalOverview.revenue,
      observed: consolidatedGross || next.globalOverview.revenue,
      variancePct: safeDivide((consolidatedGross || next.globalOverview.revenue) - next.globalOverview.revenue, next.globalOverview.revenue || 1) * 100,
      status:
        Math.abs(
          safeDivide((consolidatedGross || next.globalOverview.revenue) - next.globalOverview.revenue, next.globalOverview.revenue || 1) * 100,
        ) > WAR_ROOM_OPS_CONSTANTS.attribution.reconciliation.grossVarianceWarningPct
          ? "warning"
          : "ok",
      note: "Conferencia de faturamento bruto vs gateways.",
    },
    {
      id: "profit_formula_check",
      expected: simulatedNetProfit,
      observed: next.enterprise.ceoFinance.netProfit,
      variancePct: safeDivide(next.enterprise.ceoFinance.netProfit - simulatedNetProfit, simulatedNetProfit || 1) * 100,
      status:
        Math.abs(safeDivide(next.enterprise.ceoFinance.netProfit - simulatedNetProfit, simulatedNetProfit || 1) * 100) >
        WAR_ROOM_OPS_CONSTANTS.attribution.reconciliation.profitVarianceCriticalPct
          ? "critical"
          : "ok",
      note: "Conferencia da formula de lucro liquido operacional.",
    },
  ];
  const reconciliationStatus = reconciliationLedger.some((item) => item.status === "critical")
    ? "critical"
    : reconciliationLedger.some((item) => item.status === "warning")
      ? "warning"
      : "ok";

  const leaderboard = Object.entries(state.utmify.creatives)
    .map(([creativeId, value]) => ({
      creativeId,
      source: value.source,
      realProfit: value.profit,
      realRoas: value.roas,
    }))
    .sort((a, b) => b.realProfit - a.realProfit)
    .slice(0, 20);

  next.integrations = {
    apiStatus: state.apiStatus,
    attribution: {
      realRoiLeaderboard: leaderboard.length > 0 ? leaderboard : next.integrations.attribution.realRoiLeaderboard,
      namingDriftAlerts: buildNamingDriftAlerts(next),
      validatedAssets:
        next.integrations.attribution.validatedAssets.length > 0
          ? next.integrations.attribution.validatedAssets.map((asset) => {
              if (asset.assetId !== "1400 REFEITO") {
                return asset;
              }
              const utmifyRef = state.utmify.creatives["1400 REFEITO"] ?? state.utmify.creatives["1400"];
              const effective = utmifyRef?.clickToPurchaseCpa && utmifyRef.clickToPurchaseCpa > 0 ? utmifyRef.clickToPurchaseCpa : asset.effectiveCpa;
              return {
                ...asset,
                effectiveCpa: effective,
                trackingSource: "utmifyClickToPurchase" as const,
                note: "Tracking Error: ignorando Facebook API e validando por Click-to-Purchase da Utmify.",
              };
            })
          : next.integrations.attribution.validatedAssets,
    },
    gateway: {
      consolidatedGrossRevenue:
        consolidatedGross > 0 ? consolidatedGross : next.integrations.gateway.consolidatedGrossRevenue,
      consolidatedNetRevenue: consolidatedNet > 0 ? consolidatedNet : next.integrations.gateway.consolidatedNetRevenue,
      appmaxCardApprovalRate:
        state.appmax.cardApprovalRate > 0 ? state.appmax.cardApprovalRate : next.integrations.gateway.appmaxCardApprovalRate,
      appmaxPreviousDayApprovalRate:
        state.appmax.previousDayApprovalRate > 0
          ? state.appmax.previousDayApprovalRate
          : next.integrations.gateway.appmaxPreviousDayApprovalRate,
      yampiCartAbandonmentRate:
        state.yampi.cartAbandonmentRate > 0
          ? state.yampi.cartAbandonmentRate
          : next.integrations.gateway.yampiCartAbandonmentRate,
      fixedCosts: state.config.fixedCosts > 0 ? state.config.fixedCosts : next.integrations.gateway.fixedCosts,
      taxRatePct: state.config.taxRatePct > 0 ? state.config.taxRatePct : next.integrations.gateway.taxRatePct,
      kiwifyUpsellTakeRates: {
        upsell1: state.kiwify.upsellTakeRates.upsell1 || next.integrations.gateway.kiwifyUpsellTakeRates.upsell1,
        upsell2: state.kiwify.upsellTakeRates.upsell2 || next.integrations.gateway.kiwifyUpsellTakeRates.upsell2,
        upsell3: state.kiwify.upsellTakeRates.upsell3 || next.integrations.gateway.kiwifyUpsellTakeRates.upsell3,
      },
    },
    merCross: {
      value: merValue,
      totalSpend: spendTotal,
      status:
        merValue < WAR_ROOM_OPS_CONSTANTS.thresholds.mer.operationalCritical
          ? "critical"
          : merValue > WAR_ROOM_OPS_CONSTANTS.thresholds.mer.scale
            ? "elite"
            : "stable",
      trend12h: state.merTrend12h.length > 1 ? state.merTrend12h : next.integrations.merCross.trend12h,
      recommendation:
        merValue < WAR_ROOM_OPS_CONSTANTS.thresholds.mer.operationalCritical
          ? "CRITICAL: MER abaixo do limiar operacional. Travar escala imediatamente."
          : merValue > WAR_ROOM_OPS_CONSTANTS.thresholds.mer.scale
            ? "MER acima da zona de escala. Sugerir +20% de budget ao gestor."
            : "MER em zona operacional. Operar escala com monitoramento horario.",
    },
    fortress: {
      vault: next.integrations.fortress.vault,
      pixelSync: {
        realPurchases,
        metaReportedPurchases,
        discrepancyPct,
        status: pixelStatus,
        lastCheckAt: nowLabel(),
        note:
          pixelStatus === "unhealthy"
            ? `Divergencia > ${WAR_ROOM_OPS_CONSTANTS.thresholds.pixel.maxDiscrepancyPct}% entre vendas reais e Meta. Revisar CAPI/Pixel imediatamente.`
            : pixelStatus === "no_data"
              ? "Sem dados suficientes para comparar Pixel vs vendas reais."
              : "Sincronia CAPI/Pixel em faixa saudavel.",
      },
      backEndLtv: {
        upsellFlowMap,
        upsellTree,
        attachRateAlerts,
        revenueBySource: {
          paidTraffic: paidTrafficRevenue,
          crmEmail: crmEmailRevenue,
          crmSms: crmSmsRevenue,
          crmWhatsapp: crmWhatsappRevenue,
          crmTotal,
          total: revenueBySourceTotal,
          crmSharePct,
        },
        ltvTracker: {
          d7: ltvD7,
          d30: ltvD30,
          d90: ltvD90,
        },
        predictiveModel: {
          predictedLtv90d,
          baselineFromD7: ltvBaselineFromD7,
          confidencePct,
          drivers: predictiveDrivers,
        },
        cohort90d: [
          { cohortLabel: "Atual", projectedRevenue: Math.round(revenueBySourceTotal * 0.34), source: "paid" },
          { cohortLabel: "Atual", projectedRevenue: Math.round(crmTotal * 0.34), source: "crm" },
          { cohortLabel: "D-30", projectedRevenue: Math.round(revenueBySourceTotal * 0.31), source: "paid" },
          { cohortLabel: "D-30", projectedRevenue: Math.round(crmTotal * 0.31), source: "crm" },
          { cohortLabel: "D-60", projectedRevenue: Math.round(revenueBySourceTotal * 0.27), source: "paid" },
          { cohortLabel: "D-60", projectedRevenue: Math.round(crmTotal * 0.27), source: "crm" },
        ],
      },
      scaleSimulator: {
        defaultAdSpend: spendTotal || next.globalOverview.investment,
        defaultCpa,
        projectedPurchases,
        projectedNetProfit: simulatedNetProfit,
        roiPct: simulatedRoiPct,
      },
      executiveBriefing: next.integrations.fortress.executiveBriefing,
      siren: next.integrations.fortress.siren,
    },
    operations: {
      opportunityLost: {
        estimatedLossToday: Math.round(lossPerMinute * 30),
        currentLossPerMinute: Math.round(lossPerMinute),
        currentlyLosing: lossPerMinute > 0,
        incidents: currentIncidents,
      },
      reconciliation: {
        status: reconciliationStatus,
        lastCheckedAt: nowLabel(),
        ledger: reconciliationLedger,
      },
      worker: next.integrations.operations.worker,
    },
  };

  if (consolidatedGross > 0) {
    next.globalOverview.revenue = consolidatedGross;
    next.enterprise.ceoFinance.grossRevenue = consolidatedGross;
  }
  if (consolidatedNet > 0) {
    next.finance.netRevenue = consolidatedNet;
  }

  if (next.integrations.gateway.appmaxCardApprovalRate > 0) {
    next.finance.approvalCard = next.integrations.gateway.appmaxCardApprovalRate;
  }
  if (next.integrations.gateway.yampiCartAbandonmentRate > 0) {
    next.enterprise.techCro.checkout.cartAbandonment = next.integrations.gateway.yampiCartAbandonmentRate;
    next.enterprise.techCro.checkout.gatewayAlert =
      next.integrations.gateway.yampiCartAbandonmentRate >
      WAR_ROOM_OPS_CONSTANTS.thresholds.yampi.abandonmentCriticalPct;
  }

  next.enterprise.techCro.upsellFlow = [
    { step: "Upsell 1", clickRate: next.integrations.gateway.kiwifyUpsellTakeRates.upsell1 },
    { step: "Upsell 2", clickRate: next.integrations.gateway.kiwifyUpsellTakeRates.upsell2 },
    { step: "Upsell 3", clickRate: next.integrations.gateway.kiwifyUpsellTakeRates.upsell3 },
  ];
  next.finance.upsellTakeRate =
    (next.integrations.gateway.kiwifyUpsellTakeRates.upsell1 +
      next.integrations.gateway.kiwifyUpsellTakeRates.upsell2 +
      next.integrations.gateway.kiwifyUpsellTakeRates.upsell3) /
    3;

  if (state.appmax.recoveryAgents.length > 0) {
    next.enterprise.ceoFinance.recoveryLeaderboard = state.appmax.recoveryAgents;
  }

  if (next.integrations.attribution.realRoiLeaderboard.length > 0) {
    const attributionById = new Map(next.enterprise.trafficAttribution.deepAttribution.map((entry) => [entry.creativeId, entry]));
    for (const item of next.integrations.attribution.realRoiLeaderboard.slice(0, 10)) {
      attributionById.set(item.creativeId, {
        creativeId: item.creativeId,
        source: item.source,
        netProfit: item.realProfit,
        ltv: attributionById.get(item.creativeId)?.ltv ?? 0,
      });
    }
    next.enterprise.trafficAttribution.deepAttribution = [...attributionById.values()];
    const roasByCreative = new Map(next.integrations.attribution.realRoiLeaderboard.map((item) => [item.creativeId, item.realRoas]));
    next.liveAdsTracking = next.liveAdsTracking.map((row) => {
      const realRoas = roasByCreative.get(row.id);
      if (!realRoas || !Number.isFinite(realRoas) || realRoas <= 0) {
        return row;
      }
      const trendRoas = row.trend24h.roas.length > 0 ? [...row.trend24h.roas.slice(0, -1), realRoas] : [realRoas];
      return {
        ...row,
        roas: realRoas,
        trend24h: {
          ...row.trend24h,
          roas: trendRoas,
        },
      };
    });
  }

  if (next.integrations.merCross.value > 0) {
    next.enterprise.ceoFinance.mer = next.integrations.merCross.value;
    next.enterprise.trafficAttribution.scaleCalculator = {
      suggestedIncreasePct: next.integrations.merCross.value > 4 ? 20 : 0,
      reason: next.integrations.merCross.recommendation,
    };
  }

  const adSpendForSquads =
    next.integrations.merCross.totalSpend > 0 ? next.integrations.merCross.totalSpend : next.enterprise.ceoFinance.adSpend;
  const squadRevenue = {
    copy: consolidatedNet * 0.22 + crmTotal * 0.18,
    media: paidTrafficRevenue * 0.88,
    tech: Math.max(0, consolidatedNet - (consolidatedNet * 0.22 + crmTotal * 0.18) - paidTrafficRevenue * 0.88),
  };
  const squadCost = {
    copy: adSpendForSquads * 0.08 + 90_000,
    media: adSpendForSquads * 0.62,
    tech: adSpendForSquads * 0.06 + 70_000,
  };
  const toMargin = (revenue: number, cost: number) => safeDivide(revenue - cost, revenue || 1) * 100;
  const toEfficiency = (revenue: number, cost: number) =>
    Math.max(1, Math.min(99, safeDivide(revenue, cost || 1) * 35 + toMargin(revenue, cost) * 0.45));
  const multiTenantSquads = [
    {
      id: "copy" as const,
      name: "Copy Subsidiaria",
      head: "Head Copy - Ana",
      cost: squadCost.copy,
      revenue: squadRevenue.copy,
      profit: squadRevenue.copy - squadCost.copy,
      marginPct: toMargin(squadRevenue.copy, squadCost.copy),
      efficiencyScore: toEfficiency(squadRevenue.copy, squadCost.copy),
    },
    {
      id: "media" as const,
      name: "Midia Subsidiaria",
      head: "Head Midia - Caio",
      cost: squadCost.media,
      revenue: squadRevenue.media,
      profit: squadRevenue.media - squadCost.media,
      marginPct: toMargin(squadRevenue.media, squadCost.media),
      efficiencyScore: toEfficiency(squadRevenue.media, squadCost.media),
    },
    {
      id: "tech" as const,
      name: "Tech/CRO Subsidiaria",
      head: "Head Tech - Bruno",
      cost: squadCost.tech,
      revenue: squadRevenue.tech,
      profit: squadRevenue.tech - squadCost.tech,
      marginPct: toMargin(squadRevenue.tech, squadCost.tech),
      efficiencyScore: toEfficiency(squadRevenue.tech, squadCost.tech),
    },
  ];
  const bestSquad = [...multiTenantSquads].sort((a, b) => b.efficiencyScore - a.efficiencyScore)[0]?.id ?? "media";
  next.enterprise.multiTenant = {
    squads: multiTenantSquads,
    bestSquadId: bestSquad,
    lastCalculatedAt: nowLabel(),
  };

  const taxes = (next.integrations.gateway.consolidatedGrossRevenue * next.integrations.gateway.taxRatePct) / 100;
  const adSpend = next.integrations.merCross.totalSpend > 0 ? next.integrations.merCross.totalSpend : next.enterprise.ceoFinance.adSpend;
  const fixedCosts = next.integrations.gateway.fixedCosts;
  const realNetProfit = Math.max(
    0,
    next.integrations.gateway.consolidatedGrossRevenue -
      next.enterprise.ceoFinance.gatewayFees -
      taxes -
      adSpend -
      fixedCosts,
  );
  next.enterprise.ceoFinance.nfseTaxes = taxes;
  next.enterprise.ceoFinance.taxProvision = taxes;
  next.enterprise.ceoFinance.adSpend = adSpend;
  next.enterprise.ceoFinance.netProfit = realNetProfit;
  next.enterprise.ceoFinance.ltvCohorts.d30 = ltvD30;
  next.enterprise.ceoFinance.ltvCohorts.d60 = Math.round((ltvD30 + ltvD90) / 2);
  next.enterprise.ceoFinance.ltvCohorts.d90 = ltvD90;
  next.finance.ltv = ltvD90;
  next.finance.netRevenue = realNetProfit;

  if (
    next.integrations.gateway.appmaxPreviousDayApprovalRate > 0 &&
    next.integrations.gateway.appmaxCardApprovalRate < approvalDropThreshold
  ) {
    next.integrations.apiStatus.appmax.status = "error";
    next.integrations.apiStatus.appmax.errorMessage = `Queda >${WAR_ROOM_OPS_CONSTANTS.thresholds.appmax.approvalDropAlertPct}% vs media D-1 (possivel shadowban/processador).`;
  }

  if (next.integrations.fortress.pixelSync.status === "unhealthy") {
    next.integrations.apiStatus.utmify.status = "error";
    next.integrations.apiStatus.utmify.errorMessage = `Divergencia de Pixel/CAPI acima de ${WAR_ROOM_OPS_CONSTANTS.thresholds.pixel.maxDiscrepancyPct}%.`;
  }

  if (attachRateAlerts.length > 0) {
    const attachOrder: WarRoomData["squadSync"]["commandOrders"][number] = {
      id: `ORD-ATTACH-${Date.now()}`,
      audience: "copywriters",
      status: "failing",
      title: "Attach Rate abaixo do benchmark",
      diagnosis: attachRateAlerts.join(" | "),
      action: "Reforcar mecanismo de transicao e provas de valor no trecho de upsell.",
      createdAt: nowLabel(),
    };
    next.squadSync.commandOrders = [attachOrder, ...next.squadSync.commandOrders].slice(0, 25);
  }

  return next;
}

export async function enrichWarRoomOperations(input: WarRoomData): Promise<WarRoomData> {
  const next = structuredClone(input);
  const stats = await getOpsJobStats();
  next.integrations.operations.worker = stats;
  return next;
}
