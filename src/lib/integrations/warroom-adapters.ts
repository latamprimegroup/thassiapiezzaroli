import type { TrafficSourceKey } from "@/lib/war-room/types";

export type ProviderName = "utmify" | "appmax" | "kiwify" | "yampi";

export type RecoveryAgent = {
  agent: string;
  boletoRecoveryRate: number;
  pixRecoveryRate: number;
  recoveredRevenue: number;
};

export type UtmifyCreativeMetric = {
  creativeId: string;
  source: TrafficSourceKey;
  spend: number;
  profit: number;
  roas: number;
  clickToPurchaseCpa: number;
};

export type UnifiedProviderEvent = {
  provider: ProviderName;
  receivedAt: string;
  valor_bruto: number;
  valor_liquido: number;
  spend: number;
  real_purchase_count: number;
  meta_reported_purchase_count: number;
  paid_traffic_revenue: number;
  crm_email_revenue: number;
  crm_sms_revenue: number;
  crm_whatsapp_revenue: number;
  ltv_7d: number;
  ltv_30d: number;
  ltv_90d: number;
  cart_abandonment_rate: number;
  card_approval_rate: number;
  appmax_previous_day_approval_rate: number;
  upsell_take_rates: {
    upsell1: number;
    upsell2: number;
    upsell3: number;
  };
  creatives: UtmifyCreativeMetric[];
  recovery_agents: RecoveryAgent[];
};

export type GatewayAdapter = {
  provider: ProviderName;
  canHandle: (payload: Record<string, unknown>) => boolean;
  adapt: (payload: Record<string, unknown>) => UnifiedProviderEvent;
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toPercent(value: unknown, fallback = 0): number {
  const numeric = toNumber(value, fallback);
  if (numeric <= 1 && numeric >= 0) {
    return numeric * 100;
  }
  return numeric;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function inferSource(value: unknown): TrafficSourceKey {
  const normalized = toString(value).toLowerCase();
  if (normalized.includes("goog")) {
    return "google";
  }
  if (normalized.includes("native") || normalized.includes("taboola") || normalized.includes("outbrain")) {
    return "native";
  }
  return "meta";
}

function buildBaseEvent(provider: ProviderName): UnifiedProviderEvent {
  return {
    provider,
    receivedAt: new Date().toISOString(),
    valor_bruto: 0,
    valor_liquido: 0,
    spend: 0,
    real_purchase_count: 0,
    meta_reported_purchase_count: 0,
    paid_traffic_revenue: 0,
    crm_email_revenue: 0,
    crm_sms_revenue: 0,
    crm_whatsapp_revenue: 0,
    ltv_7d: 0,
    ltv_30d: 0,
    ltv_90d: 0,
    cart_abandonment_rate: 0,
    card_approval_rate: 0,
    appmax_previous_day_approval_rate: 0,
    upsell_take_rates: {
      upsell1: 0,
      upsell2: 0,
      upsell3: 0,
    },
    creatives: [],
    recovery_agents: [],
  };
}

const utmifyAdapter: GatewayAdapter = {
  provider: "utmify",
  canHandle: (payload) => {
    return "utmify" in payload || "creative_id" in payload || "creatives" in payload || "roas_real" in payload;
  },
  adapt: (payload) => {
    const base = buildBaseEvent("utmify");
    const root = asObject(payload.utmify ?? payload);
    const creativesInput = asArray(root.creatives ?? root.items ?? payload.creatives);

    base.spend = toNumber(root.spend_total ?? root.spend ?? root.total_spend, 0);
    base.valor_bruto = toNumber(root.revenue_total ?? root.revenue ?? root.valor_bruto, 0);
    base.valor_liquido = toNumber(root.net_revenue ?? root.valor_liquido ?? root.profit_total, 0);
    base.meta_reported_purchase_count = toNumber(
      root.meta_reported_purchase_count ?? root.meta_purchase_events ?? root.pixel_purchases,
      0,
    );
    base.paid_traffic_revenue = toNumber(root.paid_traffic_revenue ?? root.revenue_paid ?? root.net_revenue_paid, 0);
    base.ltv_7d = toNumber(root.ltv_7d ?? root.customer_ltv_7d, 0);
    base.ltv_30d = toNumber(root.ltv_30d ?? root.customer_ltv_30d, 0);
    base.ltv_90d = toNumber(root.ltv_90d ?? root.customer_ltv_90d, 0);
    base.creatives = creativesInput.map((item) => {
      const row = asObject(item);
      return {
        creativeId: toString(row.creative_id ?? row.creativeId ?? row.id_criativo ?? row.ad_id, "N/A"),
        source: inferSource(row.source ?? row.network ?? row.traffic_source),
        spend: toNumber(row.spend ?? row.gasto, 0),
        profit: toNumber(row.profit ?? row.net_profit ?? row.lucro, 0),
        roas: toNumber(row.roas ?? row.roas_real ?? row.roi, 0),
        clickToPurchaseCpa: toNumber(row.click_to_purchase_cpa ?? row.c2p_cpa ?? row.cpa_utmify, 0),
      };
    });
    return base;
  },
};

const appmaxAdapter: GatewayAdapter = {
  provider: "appmax",
  canHandle: (payload) => {
    return "appmax" in payload || "total_value" in payload || "card_approval_rate" in payload || "recovery_agents" in payload;
  },
  adapt: (payload) => {
    const base = buildBaseEvent("appmax");
    const root = asObject(payload.appmax ?? payload);
    base.valor_bruto = toNumber(root.total_value ?? root.amount ?? root.valor_bruto, 0);
    base.valor_liquido = toNumber(root.net_value ?? root.net_amount ?? root.valor_liquido, 0);
    base.real_purchase_count = toNumber(root.purchase_count ?? root.sales_count ?? root.total_orders, 0);
    base.crm_email_revenue = toNumber(root.crm_email_revenue ?? root.email_revenue, 0);
    base.crm_sms_revenue = toNumber(root.crm_sms_revenue ?? root.sms_revenue, 0);
    base.crm_whatsapp_revenue = toNumber(root.crm_whatsapp_revenue ?? root.whatsapp_revenue, 0);
    base.card_approval_rate = toPercent(root.card_approval_rate ?? root.approval_card ?? root.approval_rate_card, 0);
    base.appmax_previous_day_approval_rate = toPercent(
      root.previous_day_approval_rate ?? root.approval_rate_yesterday ?? root.approval_card_d1,
      0,
    );

    base.recovery_agents = asArray(root.recovery_agents ?? root.televendas ?? root.recovery).map((item) => {
      const row = asObject(item);
      return {
        agent: toString(row.agent ?? row.agent_name ?? row.nome, "Agente"),
        boletoRecoveryRate: toPercent(row.boleto_recovery_rate ?? row.boleto_rate, 0),
        pixRecoveryRate: toPercent(row.pix_recovery_rate ?? row.pix_rate, 0),
        recoveredRevenue: toNumber(row.recovered_revenue ?? row.recovered_value ?? row.valor_recuperado, 0),
      };
    });

    return base;
  },
};

const kiwifyAdapter: GatewayAdapter = {
  provider: "kiwify",
  canHandle: (payload) => {
    return "kiwify" in payload || "upsell1_take_rate" in payload || "post_sale" in payload || "net_amount" in payload;
  },
  adapt: (payload) => {
    const base = buildBaseEvent("kiwify");
    const root = asObject(payload.kiwify ?? payload);
    const upsell = asObject(root.upsell ?? root.post_sale ?? {});

    base.valor_bruto = toNumber(root.amount ?? root.gross_amount ?? root.valor_bruto, 0);
    base.valor_liquido = toNumber(root.net_amount ?? root.valor_liquido ?? root.net_revenue, 0);
    base.real_purchase_count = toNumber(root.purchase_count ?? root.orders_count ?? root.total_orders, 0);
    base.upsell_take_rates = {
      upsell1: toPercent(upsell.upsell1 ?? root.upsell1_take_rate, 0),
      upsell2: toPercent(upsell.upsell2 ?? root.upsell2_take_rate, 0),
      upsell3: toPercent(upsell.upsell3 ?? root.upsell3_take_rate, 0),
    };
    return base;
  },
};

const yampiAdapter: GatewayAdapter = {
  provider: "yampi",
  canHandle: (payload) => {
    return "yampi" in payload || "cart_abandonment_rate" in payload || "checkout_abandonment" in payload;
  },
  adapt: (payload) => {
    const base = buildBaseEvent("yampi");
    const root = asObject(payload.yampi ?? payload);
    base.cart_abandonment_rate = toPercent(
      root.cart_abandonment_rate ?? root.checkout_abandonment ?? root.cart_abandonment,
      0,
    );
    return base;
  },
};

const adapters: GatewayAdapter[] = [utmifyAdapter, appmaxAdapter, kiwifyAdapter, yampiAdapter];

export function resolveAdapterByProvider(provider: string | undefined) {
  if (!provider) {
    return null;
  }
  return adapters.find((adapter) => adapter.provider === provider.toLowerCase()) ?? null;
}

export function resolveAdapterByPayload(payload: Record<string, unknown>) {
  return adapters.find((adapter) => adapter.canHandle(payload)) ?? null;
}
