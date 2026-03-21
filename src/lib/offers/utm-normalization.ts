import type { TrafficSource } from "@/lib/offers/types";

const SOURCE_ALIASES: Record<string, TrafficSource> = {
  meta: "meta",
  fb: "meta",
  facebook: "meta",
  ig: "meta",
  instagram: "meta",
  google: "google",
  gads: "google",
  adwords: "google",
  youtube: "google",
  tiktok: "tiktok",
  tt: "tiktok",
  kwai: "kwai",
  kw: "kwai",
  networking: "networking",
  partner: "networking",
  parceiro: "networking",
  manual: "networking",
};

function cleanToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

export function normalizeTrafficSource(input: string): TrafficSource {
  const token = cleanToken(input);
  return SOURCE_ALIASES[token] ?? "unknown";
}

function cleanPart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function splitNameAndId(rawValue: string) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return { name: "", id: "" };
  }
  const separatorIndex = value.lastIndexOf("|");
  if (separatorIndex < 0) {
    return { name: cleanPart(value), id: "" };
  }
  const name = cleanPart(value.slice(0, separatorIndex));
  const id = value
    .slice(separatorIndex + 1)
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  return { name, id };
}

function toStringSafe(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNumberSafe(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

export type NormalizedUtmPayload = {
  offerId: string;
  eventType: "click" | "sale";
  gateway: "utmify" | "appmax" | "kiwify" | "yampi" | "manual";
  trafficSource: TrafficSource;
  occurredAt: string;
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  utmContent: string;
  utmTerm: string;
  campaignName: string;
  campaignId: string;
  contentName: string;
  contentId: string;
  termName: string;
  termId: string;
  utmBroughtBy: string;
  device: string;
  network: string;
  keyword: string;
  revenue: number;
  spend: number;
  currency: string;
  rawPayload: Record<string, unknown>;
};

export function normalizeGatewayPayload(payload: Record<string, unknown>): NormalizedUtmPayload {
  const utmSource = toStringSafe(payload.utm_source || payload.source || payload.traffic_source);
  const trafficSource = normalizeTrafficSource(utmSource);
  const campaign = splitNameAndId(toStringSafe(payload.utm_campaign || payload.campaign || payload.campaign_name));
  const content = splitNameAndId(toStringSafe(payload.utm_content || payload.content || payload.creative));
  const term = splitNameAndId(toStringSafe(payload.utm_term || payload.term || payload.keyword));
  const offerId = toStringSafe(payload.offer_id || payload.offerId || payload.product_id || payload.productId).trim();
  const eventTypeRaw = toStringSafe(payload.event_type || payload.event || payload.type).toLowerCase();
  const gatewayRaw = toStringSafe(payload.gateway || payload.provider).toLowerCase();
  const occurredRaw = toStringSafe(payload.occurred_at || payload.timestamp || payload.created_at);
  const eventType = eventTypeRaw === "click" ? "click" : "sale";
  const gateway =
    gatewayRaw === "utmify" || gatewayRaw === "appmax" || gatewayRaw === "kiwify" || gatewayRaw === "yampi"
      ? gatewayRaw
      : "manual";
  const occurredAt = (() => {
    const parsed = new Date(occurredRaw);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  })();

  return {
    offerId,
    eventType,
    gateway,
    trafficSource,
    occurredAt,
    utmSource,
    utmCampaign: toStringSafe(payload.utm_campaign || payload.campaign),
    utmMedium: toStringSafe(payload.utm_medium || payload.medium),
    utmContent: toStringSafe(payload.utm_content || payload.content),
    utmTerm: toStringSafe(payload.utm_term || payload.term),
    campaignName: campaign.name,
    campaignId: campaign.id,
    contentName: content.name,
    contentId: content.id,
    termName: term.name,
    termId: term.id,
    utmBroughtBy: toStringSafe(payload.utm_brought_by || payload.partner || payload.brought_by).trim(),
    device: toStringSafe(payload.device || payload.device_type),
    network: toStringSafe(payload.network || payload.placement_network),
    keyword: toStringSafe(payload.keyword || payload.search_term || payload.kw),
    revenue: toNumberSafe(payload.revenue || payload.amount || payload.valor_bruto || payload.total_value),
    spend: toNumberSafe(payload.spend || payload.cost || payload.ad_spend || payload.valor_investido),
    currency: toStringSafe(payload.currency || payload.moeda).trim() || "BRL",
    rawPayload: payload,
  };
}

