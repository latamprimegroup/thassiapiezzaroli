import { safeDivide } from "@/lib/metrics/kpis";
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
  const pixelStatus = realPurchases === 0 ? "no_data" : discrepancyPct > 20 ? "unhealthy" : "healthy";
  const paidTrafficRevenue = state.utmify.paidTrafficRevenue > 0 ? state.utmify.paidTrafficRevenue : consolidatedNet * 0.86;
  const crmEmailRevenue = state.appmax.crmEmailRevenue > 0 ? state.appmax.crmEmailRevenue : consolidatedNet * 0.05;
  const crmSmsRevenue = state.appmax.crmSmsRevenue > 0 ? state.appmax.crmSmsRevenue : consolidatedNet * 0.03;
  const crmWhatsappRevenue = state.appmax.crmWhatsappRevenue > 0 ? state.appmax.crmWhatsappRevenue : consolidatedNet * 0.04;
  const crmTotal = crmEmailRevenue + crmSmsRevenue + crmWhatsappRevenue;
  const revenueBySourceTotal = paidTrafficRevenue + crmTotal;
  const ltvD7 = state.utmify.ltv7d > 0 ? state.utmify.ltv7d : Math.max(0, next.finance.ltv24h * 1.35);
  const ltvD30 = state.utmify.ltv30d > 0 ? state.utmify.ltv30d : Math.max(ltvD7, next.enterprise.ceoFinance.ltvCohorts.d30);
  const ltvD90 = state.utmify.ltv90d > 0 ? state.utmify.ltv90d : Math.max(ltvD30, next.enterprise.ceoFinance.ltvCohorts.d90);
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
      status: merValue < 2.5 ? "critical" : merValue > 4.0 ? "elite" : "stable",
      trend12h: state.merTrend12h.length > 1 ? state.merTrend12h : next.integrations.merCross.trend12h,
      recommendation:
        merValue < 2.5
          ? "CRITICAL: MER abaixo de 2.5x. Travar escala imediatamente."
          : merValue > 4.0
            ? "MER acima de 4.0x. Sugerir +20% de budget ao gestor."
            : "MER entre 2.5x e 4.0x. Operar escala com monitoramento horario.",
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
            ? "Divergencia > 20% entre vendas reais e Meta. Revisar CAPI/Pixel imediatamente."
            : pixelStatus === "no_data"
              ? "Sem dados suficientes para comparar Pixel vs vendas reais."
              : "Sincronia CAPI/Pixel em faixa saudavel.",
      },
      backEndLtv: {
        upsellFlowMap,
        revenueBySource: {
          paidTraffic: paidTrafficRevenue,
          crmEmail: crmEmailRevenue,
          crmSms: crmSmsRevenue,
          crmWhatsapp: crmWhatsappRevenue,
          crmTotal,
          total: revenueBySourceTotal,
          crmSharePct: safeDivide(crmTotal, revenueBySourceTotal || 1) * 100,
        },
        ltvTracker: {
          d7: ltvD7,
          d30: ltvD30,
          d90: ltvD90,
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
    next.enterprise.techCro.checkout.gatewayAlert = next.integrations.gateway.yampiCartAbandonmentRate > 60;
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

  const approvalDropThreshold = next.integrations.gateway.appmaxPreviousDayApprovalRate * 0.9;
  if (
    next.integrations.gateway.appmaxPreviousDayApprovalRate > 0 &&
    next.integrations.gateway.appmaxCardApprovalRate < approvalDropThreshold
  ) {
    next.integrations.apiStatus.appmax.status = "error";
    next.integrations.apiStatus.appmax.errorMessage = "Queda >10% vs media D-1 (possivel shadowban/processador).";
  }

  if (next.integrations.fortress.pixelSync.status === "unhealthy") {
    next.integrations.apiStatus.utmify.status = "error";
    next.integrations.apiStatus.utmify.errorMessage = "Divergencia de Pixel/CAPI acima de 20%.";
  }

  return next;
}
