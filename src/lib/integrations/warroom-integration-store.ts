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
    creatives: Record<string, { source: TrafficSourceKey; profit: number; roas: number }>;
  };
  appmax: {
    gross: number;
    net: number;
    cardApprovalRate: number;
    recoveryAgents: RecoveryAgent[];
  };
  kiwify: {
    gross: number;
    net: number;
    upsellTakeRates: {
      upsell1: number;
      upsell2: number;
      upsell3: number;
    };
  };
  yampi: {
    cartAbandonmentRate: number;
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
    },
    appmax: {
      gross: 0,
      net: 0,
      cardApprovalRate: 0,
      recoveryAgents: [],
    },
    kiwify: {
      gross: 0,
      net: 0,
      upsellTakeRates: {
        upsell1: 0,
        upsell2: 0,
        upsell3: 0,
      },
    },
    yampi: {
      cartAbandonmentRate: 0,
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
    for (const creative of event.creatives) {
      if (!creative.creativeId || creative.creativeId === "N/A") {
        continue;
      }
      state.utmify.creatives[creative.creativeId] = {
        source: creative.source,
        profit: creative.profit,
        roas: creative.roas,
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
  const merValue = safeDivide(consolidatedGross || next.globalOverview.revenue, spendTotal || 1);

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
    },
    gateway: {
      consolidatedGrossRevenue:
        consolidatedGross > 0 ? consolidatedGross : next.integrations.gateway.consolidatedGrossRevenue,
      consolidatedNetRevenue: consolidatedNet > 0 ? consolidatedNet : next.integrations.gateway.consolidatedNetRevenue,
      appmaxCardApprovalRate:
        state.appmax.cardApprovalRate > 0 ? state.appmax.cardApprovalRate : next.integrations.gateway.appmaxCardApprovalRate,
      yampiCartAbandonmentRate:
        state.yampi.cartAbandonmentRate > 0
          ? state.yampi.cartAbandonmentRate
          : next.integrations.gateway.yampiCartAbandonmentRate,
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

  return next;
}
