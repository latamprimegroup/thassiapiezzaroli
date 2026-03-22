import { randomUUID } from "node:crypto";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import { redisDelete, redisGetString, redisIncrementWithWindow, redisSetStringEx } from "@/lib/infra/redis";
import * as offersRepo from "@/lib/offers/offers-lab-repository";
import {
  buildDefaultPredictiveModelState,
  evaluateDrift,
  trainLinearLtvModel,
} from "@/lib/offers/predictive-ltv";
import type {
  LtvSampleRecord,
  OfferMetrics7d,
  OfferRecord,
  OffersLabDashboard,
  OffersLabSyncState,
  OfferWithMetrics,
  PredictiveLtvModelState,
  QuarantinedTrafficEventRecord,
  TrafficEventRecord,
  TrafficSourceSummary,
  UtmAliasRecord,
} from "@/lib/offers/types";
import { normalizeGatewayPayload, normalizeTrafficSource } from "@/lib/offers/utm-normalization";
import { captureServerError } from "@/lib/observability/error-monitoring";
import { rollingDaysStartIsoByBusinessDay } from "@/lib/time/war-room-clock";

type UpsertOfferInput = {
  id?: string;
  name: string;
  status?: OfferRecord["status"];
  niche?: string;
  ownerId?: string;
  minRoasTarget?: number;
  trafficSource?: string;
  utmBroughtBy?: string;
  bigIdea?: string;
  uniqueMechanism?: string;
  sophisticationLevel?: number;
  hookVariations?: string[];
};

type DashboardFilters = {
  niche?: string;
  ownerId?: string;
  minRoas?: number;
  validatedOnly?: boolean;
};

declare global {
  var __offersLabDashboardCache: Map<string, { expiresAtMs: number; value: OffersLabDashboard }> | undefined;
  var __offersLabCacheVersion: number | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function resolveOffersDashboardEventLimit() {
  const configured = Number(process.env.WAR_ROOM_OFFERS_DASHBOARD_EVENTS_LIMIT ?? 150_000);
  if (!Number.isFinite(configured)) {
    return 150_000;
  }
  return Math.max(10_000, Math.min(500_000, Math.floor(configured)));
}

function getCacheStore() {
  if (!globalThis.__offersLabDashboardCache) {
    globalThis.__offersLabDashboardCache = new Map<string, { expiresAtMs: number; value: OffersLabDashboard }>();
  }
  return globalThis.__offersLabDashboardCache;
}

function buildDashboardCacheKey(filters?: DashboardFilters) {
  return JSON.stringify({
    niche: filters?.niche ?? "",
    ownerId: filters?.ownerId ?? "",
    minRoas: typeof filters?.minRoas === "number" ? Number(filters.minRoas.toFixed(4)) : "",
    validatedOnly: Boolean(filters?.validatedOnly),
  });
}

function localCacheVersion() {
  if (typeof globalThis.__offersLabCacheVersion !== "number") {
    globalThis.__offersLabCacheVersion = 1;
  }
  return globalThis.__offersLabCacheVersion;
}

async function resolveCacheVersion() {
  const redisKey = `${WAR_ROOM_OPS_CONSTANTS.offersLab.redis.keyPrefix}:cache-version`;
  const raw = await redisGetString(redisKey);
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    globalThis.__offersLabCacheVersion = parsed;
    return parsed;
  }
  return localCacheVersion();
}

async function invalidateDashboardCache() {
  const redisKey = `${WAR_ROOM_OPS_CONSTANTS.offersLab.redis.keyPrefix}:cache-version`;
  const redisResult = await redisIncrementWithWindow(redisKey, 60 * 60 * 24 * 365);
  if (redisResult) {
    globalThis.__offersLabCacheVersion = redisResult.count;
  } else {
    globalThis.__offersLabCacheVersion = localCacheVersion() + 1;
  }
  getCacheStore().clear();
}

function buildRedisDashboardCacheKey(version: number, filters?: DashboardFilters) {
  return `${WAR_ROOM_OPS_CONSTANTS.offersLab.redis.keyPrefix}:dashboard:v${version}:${buildDashboardCacheKey(filters)}`;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function clampSophistication(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(toNumber(value, 3));
  return Math.max(1, Math.min(5, rounded)) as 1 | 2 | 3 | 4 | 5;
}

function normalizeHookVariations(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const sanitized = values
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);
  return [...new Set(sanitized)];
}

function composeOfferId(input?: string) {
  const source = String(input || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (source) {
    return source;
  }
  return `OFF-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toTrafficSource(value: string | undefined) {
  return normalizeTrafficSource(value || "");
}

function resolveEventId(payload: Record<string, unknown>, normalizedOfferId: string, normalizedEventType: "click" | "sale") {
  const directIdCandidates = [
    payload.event_id,
    payload.id,
    payload.webhook_id,
    payload.transaction_id,
    payload.transactionId,
    payload.order_id,
    payload.orderId,
    payload.sale_id,
    payload.purchase_id,
  ].map((value) => String(value ?? "").trim());

  const direct = directIdCandidates.find(Boolean);
  if (direct) {
    return direct;
  }
  const utmSignature = [
    String(payload.utm_source ?? "").trim(),
    String(payload.utm_campaign ?? "").trim(),
    String(payload.utm_content ?? "").trim(),
    String(payload.utm_term ?? "").trim(),
    String(payload.timestamp ?? payload.occurred_at ?? "").trim(),
    String(payload.revenue ?? payload.amount ?? payload.valor_bruto ?? "").trim(),
  ].join("|");
  if (utmSignature.replace(/\|/g, "").length > 0) {
    const signatureKey = Buffer.from(utmSignature).toString("base64url").slice(0, 24);
    return `TE-${normalizedOfferId}-${normalizedEventType}-${signatureKey}`;
  }
  return `TE-${normalizedOfferId}-${normalizedEventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPaidSource(source: TrafficEventRecord["trafficSource"]) {
  return source === "meta" || source === "google" || source === "tiktok" || source === "kwai";
}

async function warnIfUtmPatternWeak(event: TrafficEventRecord) {
  if (!isPaidSource(event.trafficSource)) {
    return;
  }
  if (event.campaignId && event.contentId) {
    return;
  }
  await captureServerError({
    route: "/offers-lab/utm-parser",
    error: "UTM padrao Nome|ID incompleto para campanha ou criativo.",
    context: {
      offerId: event.offerId,
      trafficSource: event.trafficSource,
      campaign: event.utmCampaign,
      content: event.utmContent,
      campaignId: event.campaignId,
      contentId: event.contentId,
      eventId: event.id,
    },
    level: "warning",
  });
}

function normalizeAliasToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

function parseLtvSampleFromPayload(payload: Record<string, unknown>, offerId: string): LtvSampleRecord | null {
  const ltvD7 = toNumber(payload.ltv_7d ?? payload.customer_ltv_7d ?? payload.ltv7d, 0);
  const ltvD90 = toNumber(payload.ltv_90d ?? payload.customer_ltv_90d ?? payload.ltv90d, 0);
  if (!(ltvD7 > 0 && ltvD90 > 0)) {
    return null;
  }
  const capturedAtRaw = String(payload.timestamp ?? payload.occurred_at ?? payload.created_at ?? nowIso());
  const parsedDate = new Date(capturedAtRaw);
  const capturedAt = Number.isNaN(parsedDate.getTime()) ? nowIso() : parsedDate.toISOString();
  const source = String(payload.provider ?? payload.gateway ?? "utmify").trim() || "utmify";
  const signature = Buffer.from(`${offerId}|${capturedAt}|${ltvD7}|${ltvD90}`).toString("base64url").slice(0, 22);
  return {
    id: `LTVS-${signature}`,
    offerId,
    ltvD7,
    ltvD90,
    capturedAt,
    source,
  };
}

function buildQuarantineRecord(params: {
  payload: Record<string, unknown>;
  eventId: string;
  offerId: string;
  rawSource: string;
  normalizedSource: TrafficEventRecord["trafficSource"];
  reason: QuarantinedTrafficEventRecord["reason"];
  detail: string;
}): QuarantinedTrafficEventRecord {
  return {
    id: `Q-${Buffer.from(`${params.eventId}|${params.reason}|${params.offerId}`).toString("base64url").slice(0, 28)}`,
    eventId: params.eventId,
    offerId: params.offerId,
    rawSource: params.rawSource,
    normalizedSource: params.normalizedSource,
    reason: params.reason,
    detail: params.detail,
    status: "open",
    payload: params.payload,
    detectedAt: nowIso(),
  };
}

function requiresNameIdPattern(source: TrafficEventRecord["trafficSource"]) {
  return source === "meta" || source === "google" || source === "tiktok" || source === "kwai";
}

async function buildAliasMap() {
  const aliases = await offersRepo.listUtmAliases();
  const map = new Map<string, TrafficEventRecord["trafficSource"]>();
  aliases.forEach((alias) => {
    const normalized = normalizeTrafficSource(alias.canonicalSource);
    if (normalized !== "unknown") {
      map.set(normalizeAliasToken(alias.rawSource), normalized);
    }
  });
  return { aliases, map };
}

function resolveSourceWithAliases(
  rawSource: string,
  normalizedSource: TrafficEventRecord["trafficSource"],
  aliasMap: Map<string, TrafficEventRecord["trafficSource"]>,
) {
  if (normalizedSource !== "unknown") {
    return normalizedSource;
  }
  const alias = aliasMap.get(normalizeAliasToken(rawSource));
  return alias ?? normalizedSource;
}

async function notifyScaleReached(offer: OfferWithMetrics) {
  const message = [
    "OFFERS LAB: oferta validada para escala.",
    `Oferta: ${offer.name || offer.id}`,
    `Revenue 7D: ${offer.revenue7d.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    `ROAS 7D: ${offer.roas7d.toFixed(2)}x`,
    offer.candidateLaunch ? "Status: candidata a lancamento (networking)." : "Status: validada para escala.",
  ].join(" | ");

  const payload = {
    text: message,
    source: "offers-lab",
    offerId: offer.id,
    roas7d: offer.roas7d,
    revenue7d: offer.revenue7d,
  };

  const hookUrl = process.env.OFFERS_LAB_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (hookUrl) {
    await fetch(hookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const internalApiKey = process.env.WAR_ROOM_WEBHOOK_API_KEY || process.env.OFFERS_LAB_API_KEY;
    await fetch(`${appUrl}/api/notify-squad`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalApiKey ? { "x-api-key": internalApiKey } : {}),
      },
      body: JSON.stringify({ message }),
    }).catch(() => undefined);
  }
}

async function ensureOfferExistsFromEvent(event: TrafficEventRecord) {
  const existing = await offersRepo.readOffer(event.offerId);
  if (existing) {
    return existing;
  }
  const createdAt = nowIso();
  const fallback: OfferRecord = {
    id: event.offerId,
    name: `Oferta ${event.offerId}`,
    status: "teste",
    niche: "nao-classificado",
    ownerId: "squad-growth",
    minRoasTarget: WAR_ROOM_OPS_CONSTANTS.offersLab.validation.minRoas,
    trafficSource: event.trafficSource,
    utmBroughtBy: event.utmBroughtBy,
    bigIdea: "",
    uniqueMechanism: "",
    sophisticationLevel: 3,
    hookVariations: [],
    launchCandidate: false,
    createdAt,
    updatedAt: createdAt,
    lastValidatedAt: "",
  };
  await offersRepo.upsertOffer(fallback);
  return fallback;
}

function computeMetricsForOffer(offer: OfferRecord, events: TrafficEventRecord[]): OfferMetrics7d {
  const saleEvents = events.filter((event) => event.eventType === "sale");
  const revenue7d = saleEvents.reduce((acc, event) => acc + event.revenue, 0);
  const spend7d = saleEvents.reduce((acc, event) => acc + event.spend, 0);
  const roas7d = spend7d > 0 ? revenue7d / spend7d : 0;
  const targetRoas = Math.max(offer.minRoasTarget, WAR_ROOM_OPS_CONSTANTS.offersLab.validation.minRoas);
  const validatedForScale =
    revenue7d >= WAR_ROOM_OPS_CONSTANTS.offersLab.validation.minRevenue7d && roas7d >= targetRoas;
  const networkingTraffic = events.some((event) => event.trafficSource === "networking");
  const candidateLaunch =
    validatedForScale && (offer.trafficSource === "networking" || networkingTraffic || Boolean(offer.utmBroughtBy));
  const statusSuggestion =
    offer.status === "arquivada"
      ? "arquivada"
      : validatedForScale
        ? offer.status === "escala"
          ? "escala"
          : "validada"
        : offer.status === "validada" || offer.status === "escala"
          ? "validada"
          : "teste";
  return {
    offerId: offer.id,
    revenue7d,
    spend7d,
    roas7d,
    validatedForScale,
    candidateLaunch,
    statusSuggestion,
  };
}

async function autoValidateOffers(offers: OfferRecord[], events7d: TrafficEventRecord[]) {
  const byOffer = new Map<string, TrafficEventRecord[]>();
  for (const event of events7d) {
    if (!byOffer.has(event.offerId)) {
      byOffer.set(event.offerId, []);
    }
    byOffer.get(event.offerId)?.push(event);
  }

  const evaluated: OfferWithMetrics[] = [];
  for (const offer of offers) {
    const metrics = computeMetricsForOffer(offer, byOffer.get(offer.id) ?? []);
    const next: OfferWithMetrics = {
      ...offer,
      ...metrics,
    };
    evaluated.push(next);

    const statusChanged = offer.status !== metrics.statusSuggestion;
    const candidateChanged = offer.launchCandidate !== metrics.candidateLaunch;
    const shouldSetValidatedAt = metrics.validatedForScale && !offer.lastValidatedAt;
    if (statusChanged || candidateChanged || shouldSetValidatedAt) {
      const updated: OfferRecord = {
        ...offer,
        status: metrics.statusSuggestion,
        launchCandidate: metrics.candidateLaunch,
        lastValidatedAt: shouldSetValidatedAt ? nowIso() : offer.lastValidatedAt,
        updatedAt: nowIso(),
      };
      await offersRepo.upsertOffer(updated);
      if (!offer.lastValidatedAt && metrics.validatedForScale) {
        await notifyScaleReached(next);
      }
    }
  }
  return evaluated;
}

function buildSourceSummary(events: TrafficEventRecord[]): TrafficSourceSummary[] {
  const acc = new Map<TrafficSourceSummary["source"], TrafficSourceSummary>();
  for (const event of events) {
    if (event.eventType !== "sale") {
      continue;
    }
    const current =
      acc.get(event.trafficSource) ??
      ({
        source: event.trafficSource,
        salesCount: 0,
        revenue: 0,
        spend: 0,
        roas: 0,
      } satisfies TrafficSourceSummary);
    current.salesCount += 1;
    current.revenue += event.revenue;
    current.spend += event.spend;
    current.roas = current.spend > 0 ? current.revenue / current.spend : 0;
    acc.set(event.trafficSource, current);
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue);
}

function applyDashboardFilters(offers: OfferWithMetrics[], filters?: DashboardFilters) {
  return offers
    .filter((offer) => (filters?.niche ? offer.niche === filters.niche : true))
    .filter((offer) => (filters?.ownerId ? offer.ownerId === filters.ownerId : true))
    .filter((offer) => (typeof filters?.minRoas === "number" ? offer.roas7d >= filters.minRoas : true))
    .filter((offer) => (filters?.validatedOnly ? offer.validatedForScale : true))
    .sort((a, b) => b.revenue7d - a.revenue7d);
}

function extractEventRowsFromUtmify(payload: Record<string, unknown>) {
  if (Array.isArray(payload.events)) {
    return payload.events.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }
  if (Array.isArray(payload.data)) {
    return payload.data.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }
  return [];
}

export async function listUtmAliases() {
  return offersRepo.listUtmAliases();
}

export async function upsertUtmAlias(input: {
  rawSource: string;
  canonicalSource: UtmAliasRecord["canonicalSource"];
  approvedBy: string;
}) {
  const rawSource = normalizeAliasToken(input.rawSource);
  const canonicalSource = normalizeTrafficSource(input.canonicalSource);
  if (!rawSource) {
    throw new Error("raw_source obrigatorio.");
  }
  if (canonicalSource === "unknown") {
    throw new Error("canonical_source invalido para alias.");
  }
  const now = nowIso();
  const record: UtmAliasRecord = {
    id: `ALIAS-${Buffer.from(rawSource).toString("base64url").slice(0, 18)}`,
    rawSource,
    canonicalSource,
    approvedBy: input.approvedBy || "system",
    createdAt: now,
    updatedAt: now,
  };
  await offersRepo.upsertUtmAlias(record);
  await invalidateDashboardCache();
  return record;
}

export async function listQuarantine(params?: { status?: QuarantinedTrafficEventRecord["status"]; limit?: number }) {
  return offersRepo.listQuarantine({
    status: params?.status,
    limit: Math.min(params?.limit ?? WAR_ROOM_OPS_CONSTANTS.offersLab.attributionGovernance.quarantineListLimit, 1000),
  });
}

export async function trainPredictiveLtvModel() {
  const samples = await offersRepo.listLtvSamples({ limit: 50_000 });
  if (samples.length < WAR_ROOM_OPS_CONSTANTS.offersLab.predictiveLtv.minSamplesForTraining) {
    const existing = await offersRepo.readPredictiveLtvModel();
    return existing.sampleSize > 0 ? existing : buildDefaultPredictiveModelState();
  }
  const stats = trainLinearLtvModel(samples);
  const drift = evaluateDrift(samples, stats.mae, {
    warningRatio: WAR_ROOM_OPS_CONSTANTS.offersLab.predictiveLtv.driftWarningRatio,
    criticalRatio: WAR_ROOM_OPS_CONSTANTS.offersLab.predictiveLtv.driftCriticalRatio,
  });
  const model: PredictiveLtvModelState = {
    trainedAt: nowIso(),
    sampleSize: samples.length,
    slope: stats.slope,
    intercept: stats.intercept,
    r2: stats.r2,
    mae: stats.mae,
    driftRatio: drift.driftRatio,
    driftStatus: drift.driftStatus,
  };
  await offersRepo.writePredictiveLtvModel(model);
  await invalidateDashboardCache();
  return model;
}

export async function upsertOffer(input: UpsertOfferInput) {
  const existing = input.id ? await offersRepo.readOffer(input.id) : null;
  const createdAt = existing?.createdAt ?? nowIso();
  const id = composeOfferId(input.id ?? existing?.id);
  const trafficSource = toTrafficSource(input.trafficSource ?? existing?.trafficSource);
  const utmBroughtBy = String(input.utmBroughtBy ?? existing?.utmBroughtBy ?? "").trim();
  if (trafficSource === "networking" && !utmBroughtBy) {
    throw new Error("utm_brought_by e obrigatorio para ofertas de networking.");
  }

  const record: OfferRecord = {
    id,
    name: String(input.name || existing?.name || "").trim(),
    status: input.status ?? existing?.status ?? "teste",
    niche: String(input.niche ?? existing?.niche ?? "").trim() || "geral",
    ownerId: String(input.ownerId ?? existing?.ownerId ?? "").trim() || "unassigned",
    minRoasTarget: Math.max(0.1, toNumber(input.minRoasTarget ?? existing?.minRoasTarget, 1.8)),
    trafficSource,
    utmBroughtBy,
    bigIdea: String(input.bigIdea ?? existing?.bigIdea ?? "").trim(),
    uniqueMechanism: String(input.uniqueMechanism ?? existing?.uniqueMechanism ?? "").trim(),
    sophisticationLevel: clampSophistication(input.sophisticationLevel ?? existing?.sophisticationLevel),
    hookVariations: normalizeHookVariations(input.hookVariations ?? existing?.hookVariations ?? []),
    launchCandidate: existing?.launchCandidate ?? false,
    createdAt,
    updatedAt: nowIso(),
    lastValidatedAt: existing?.lastValidatedAt ?? "",
  };
  if (!record.name) {
    throw new Error("Nome da oferta e obrigatorio.");
  }
  await offersRepo.upsertOffer(record);
  await invalidateDashboardCache();
  return record;
}

async function registerTrafficEventInternal(payload: Record<string, unknown>, options?: { invalidateCache?: boolean }) {
  const normalized = normalizeGatewayPayload(payload);
  const rawSource = String(payload.utm_source ?? payload.source ?? payload.traffic_source ?? "").trim();
  const eventId = resolveEventId(payload, normalized.offerId || "UNKNOWN", normalized.eventType);
  const { map: aliasMap } = await buildAliasMap();
  const canonicalSource = resolveSourceWithAliases(rawSource || normalized.utmSource, normalized.trafficSource, aliasMap);

  if (!normalized.offerId) {
    const quarantine = buildQuarantineRecord({
      payload,
      eventId,
      offerId: "",
      rawSource,
      normalizedSource: canonicalSource,
      reason: "missing_offer_id",
      detail: "Evento recebido sem offer_id.",
    });
    await offersRepo.appendQuarantine(quarantine);
    throw new Error("offer_id obrigatorio para registrar traffic_event.");
  }

  const quarantineReasons: Array<{ reason: QuarantinedTrafficEventRecord["reason"]; detail: string }> = [];
  if (canonicalSource === "unknown") {
    quarantineReasons.push({
      reason: "unknown_source",
      detail: "Nao foi possivel identificar a origem de trafego e nao ha alias canonico.",
    });
  }
  if (requiresNameIdPattern(canonicalSource) && (!normalized.campaignId || !normalized.contentId)) {
    quarantineReasons.push({
      reason: "missing_name_id_pattern",
      detail: "utm_campaign/utm_content sem padrao Nome|ID para canal pago.",
    });
  }
  if (canonicalSource === "networking" && !normalized.utmBroughtBy) {
    quarantineReasons.push({
      reason: "networking_missing_brought_by",
      detail: "Evento networking sem utm_brought_by.",
    });
  }

  if (
    WAR_ROOM_OPS_CONSTANTS.offersLab.attributionGovernance.strictMode &&
    quarantineReasons.length > 0
  ) {
    await Promise.all(
      quarantineReasons.map((entry, index) =>
        offersRepo.appendQuarantine(
          buildQuarantineRecord({
            payload,
            eventId: `${eventId}-${index + 1}`,
            offerId: normalized.offerId,
            rawSource,
            normalizedSource: canonicalSource,
            reason: entry.reason,
            detail: entry.detail,
          }),
        ),
      ),
    );
    throw new Error(`Evento em quarentena: ${quarantineReasons.map((entry) => entry.reason).join(", ")}`);
  }

  const event: TrafficEventRecord = {
    id: eventId,
    offerId: normalized.offerId,
    eventType: normalized.eventType,
    gateway: normalized.gateway,
    trafficSource: canonicalSource,
    occurredAt: normalized.occurredAt,
    utmSource: normalized.utmSource,
    utmCampaign: normalized.utmCampaign,
    utmMedium: normalized.utmMedium,
    utmContent: normalized.utmContent,
    utmTerm: normalized.utmTerm,
    campaignName: normalized.campaignName,
    campaignId: normalized.campaignId,
    contentName: normalized.contentName,
    contentId: normalized.contentId,
    termName: normalized.termName,
    termId: normalized.termId,
    utmBroughtBy: normalized.utmBroughtBy,
    device: normalized.device,
    network: normalized.network,
    keyword: normalized.keyword,
    revenue: normalized.revenue,
    spend: normalized.spend,
    currency: normalized.currency,
    rawPayload: normalized.rawPayload,
    createdAt: nowIso(),
  };
  await ensureOfferExistsFromEvent(event);
  await offersRepo.appendTrafficEvent(event);
  await warnIfUtmPatternWeak(event);
  const ltvSample = parseLtvSampleFromPayload(payload, event.offerId);
  if (ltvSample) {
    await offersRepo.appendLtvSample(ltvSample);
  }
  if (options?.invalidateCache !== false) {
    await invalidateDashboardCache();
  }
  return event;
}

export async function registerTrafficEvent(payload: Record<string, unknown>) {
  return registerTrafficEventInternal(payload, { invalidateCache: true });
}

export async function registerTrafficEventsBatch(payloads: Record<string, unknown>[]) {
  const maxBatch = WAR_ROOM_OPS_CONSTANTS.offersLab.maxBatchEventsPerRequest;
  const cappedPayloads = payloads.slice(0, maxBatch);
  const existingOffers = new Map((await offersRepo.listOffers()).map((offer) => [offer.id, offer]));
  const { map: aliasMap } = await buildAliasMap();
  const toInsert: TrafficEventRecord[] = [];
  const ltvSamples: LtvSampleRecord[] = [];
  const failures: Array<{ index: number; message: string }> = [];

  for (let index = 0; index < cappedPayloads.length; index += 1) {
    const payload = cappedPayloads[index];
    try {
      const normalized = normalizeGatewayPayload(payload);
      const rawSource = String(payload.utm_source ?? payload.source ?? payload.traffic_source ?? "").trim();
      const eventId = resolveEventId(payload, normalized.offerId || "UNKNOWN", normalized.eventType);
      const canonicalSource = resolveSourceWithAliases(rawSource || normalized.utmSource, normalized.trafficSource, aliasMap);

      if (!normalized.offerId) {
        const quarantine = buildQuarantineRecord({
          payload,
          eventId,
          offerId: "",
          rawSource,
          normalizedSource: canonicalSource,
          reason: "missing_offer_id",
          detail: "Evento recebido sem offer_id.",
        });
        await offersRepo.appendQuarantine(quarantine);
        throw new Error("offer_id obrigatorio.");
      }

      const quarantineReasons: Array<{ reason: QuarantinedTrafficEventRecord["reason"]; detail: string }> = [];
      if (canonicalSource === "unknown") {
        quarantineReasons.push({
          reason: "unknown_source",
          detail: "Nao foi possivel identificar source e nao existe alias.",
        });
      }
      if (requiresNameIdPattern(canonicalSource) && (!normalized.campaignId || !normalized.contentId)) {
        quarantineReasons.push({
          reason: "missing_name_id_pattern",
          detail: "utm_campaign/utm_content sem padrao Nome|ID em canal pago.",
        });
      }
      if (canonicalSource === "networking" && !normalized.utmBroughtBy) {
        quarantineReasons.push({
          reason: "networking_missing_brought_by",
          detail: "Evento networking sem utm_brought_by.",
        });
      }
      if (WAR_ROOM_OPS_CONSTANTS.offersLab.attributionGovernance.strictMode && quarantineReasons.length > 0) {
        await Promise.all(
          quarantineReasons.map((entry, reasonIndex) =>
            offersRepo.appendQuarantine(
              buildQuarantineRecord({
                payload,
                eventId: `${eventId}-${reasonIndex + 1}`,
                offerId: normalized.offerId,
                rawSource,
                normalizedSource: canonicalSource,
                reason: entry.reason,
                detail: entry.detail,
              }),
            ),
          ),
        );
        throw new Error(`Evento em quarentena: ${quarantineReasons.map((entry) => entry.reason).join(", ")}`);
      }

      const event: TrafficEventRecord = {
        id: eventId,
        offerId: normalized.offerId,
        eventType: normalized.eventType,
        gateway: normalized.gateway,
        trafficSource: canonicalSource,
        occurredAt: normalized.occurredAt,
        utmSource: normalized.utmSource,
        utmCampaign: normalized.utmCampaign,
        utmMedium: normalized.utmMedium,
        utmContent: normalized.utmContent,
        utmTerm: normalized.utmTerm,
        campaignName: normalized.campaignName,
        campaignId: normalized.campaignId,
        contentName: normalized.contentName,
        contentId: normalized.contentId,
        termName: normalized.termName,
        termId: normalized.termId,
        utmBroughtBy: normalized.utmBroughtBy,
        device: normalized.device,
        network: normalized.network,
        keyword: normalized.keyword,
        revenue: normalized.revenue,
        spend: normalized.spend,
        currency: normalized.currency,
        rawPayload: normalized.rawPayload,
        createdAt: nowIso(),
      };
      if (!existingOffers.has(event.offerId)) {
        const createdAt = nowIso();
        const fallback: OfferRecord = {
          id: event.offerId,
          name: `Oferta ${event.offerId}`,
          status: "teste",
          niche: "nao-classificado",
          ownerId: "squad-growth",
          minRoasTarget: WAR_ROOM_OPS_CONSTANTS.offersLab.validation.minRoas,
          trafficSource: event.trafficSource,
          utmBroughtBy: event.utmBroughtBy,
          bigIdea: "",
          uniqueMechanism: "",
          sophisticationLevel: 3,
          hookVariations: [],
          launchCandidate: false,
          createdAt,
          updatedAt: createdAt,
          lastValidatedAt: "",
        };
        await offersRepo.upsertOffer(fallback);
        existingOffers.set(fallback.id, fallback);
      }
      toInsert.push(event);
      const ltvSample = parseLtvSampleFromPayload(payload, event.offerId);
      if (ltvSample) {
        ltvSamples.push(ltvSample);
      }
      void warnIfUtmPatternWeak(event);
    } catch (error) {
      failures.push({
        index,
        message: error instanceof Error ? error.message : "Falha desconhecida.",
      });
    }
  }
  const insertion = await offersRepo.appendTrafficEventsBatch(toInsert);
  if (ltvSamples.length > 0) {
    await Promise.all(ltvSamples.map((sample) => offersRepo.appendLtvSample(sample)));
  }
  const created = insertion.inserted;
  const duplicates = Math.max(0, insertion.attempted - insertion.inserted);
  const failed = failures.length;
  await invalidateDashboardCache();
  return {
    created,
    failed,
    duplicates,
    failures,
  };
}

export async function getOffersLabDashboard(filters?: DashboardFilters): Promise<OffersLabDashboard> {
  const cacheVersion = await resolveCacheVersion();
  const cacheKey = `${cacheVersion}:${buildDashboardCacheKey(filters)}`;
  const redisCacheKey = buildRedisDashboardCacheKey(cacheVersion, filters);
  const cacheTtlMs = WAR_ROOM_OPS_CONSTANTS.offersLab.cacheTtlSeconds * 1000;
  const redisCached = await redisGetString(redisCacheKey);
  if (redisCached) {
    try {
      const parsed = JSON.parse(redisCached) as OffersLabDashboard;
      getCacheStore().set(cacheKey, {
        value: parsed,
        expiresAtMs: nowMs() + cacheTtlMs,
      });
      return parsed;
    } catch {
      await redisDelete(redisCacheKey);
    }
  }
  const cached = getCacheStore().get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs()) {
    return cached.value;
  }

  const windowStart = rollingDaysStartIsoByBusinessDay(7);
  const dashboardEventLimit = resolveOffersDashboardEventLimit();
  const [offers, events7d, sync, aliases, recentQuarantine, openQuarantine, predictiveModel] = await Promise.all([
    offersRepo.listOffers(),
    offersRepo.listTrafficEvents({ sinceIso: windowStart, eventType: "sale", limit: dashboardEventLimit }),
    offersRepo.readSyncState(),
    offersRepo.listUtmAliases(),
    offersRepo.listQuarantine({ limit: WAR_ROOM_OPS_CONSTANTS.offersLab.attributionGovernance.quarantineListLimit }),
    offersRepo.listQuarantine({ status: "open", limit: 5_000 }),
    offersRepo.readPredictiveLtvModel(),
  ]);
  const evaluated = await autoValidateOffers(offers, events7d);
  const filtered = applyDashboardFilters(evaluated, filters);
  const ids = new Set(filtered.map((offer) => offer.id));
  const sourceSummary = buildSourceSummary(events7d.filter((event) => ids.has(event.offerId)));
  const validatedOffers = filtered.filter((offer) => offer.validatedForScale);
  const dashboard: OffersLabDashboard = {
    offers: filtered,
    validatedOffers,
    sources: sourceSummary,
    sync,
    governance: {
      aliases: aliases.slice(0, 200),
      openQuarantineCount: openQuarantine.length,
      recentQuarantine,
    },
    predictiveLtv: predictiveModel,
  };
  getCacheStore().set(cacheKey, {
    value: dashboard,
    expiresAtMs: nowMs() + cacheTtlMs,
  });
  await redisSetStringEx(
    redisCacheKey,
    JSON.stringify(dashboard),
    WAR_ROOM_OPS_CONSTANTS.offersLab.cacheTtlSeconds,
  );
  return dashboard;
}

export async function syncOffersFromUtmify() {
  const now = nowIso();
  const endpoint = process.env.UTMIFY_SYNC_URL || process.env.UTMIFY_API_URL;
  if (!endpoint) {
    const state: OffersLabSyncState = {
      lastSyncAt: now,
      lastStatus: "error",
      lastMessage: "UTMIFY_SYNC_URL/UTMIFY_API_URL nao configurada.",
    };
    await offersRepo.writeSyncState(state);
    return { syncedEvents: 0, state };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const apiKey = process.env.UTMIFY_API_KEY || process.env.WAR_ROOM_WEBHOOK_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      const state: OffersLabSyncState = {
        lastSyncAt: now,
        lastStatus: "error",
        lastMessage: `Falha UTMify sync (${response.status}).`,
      };
      await offersRepo.writeSyncState(state);
      return { syncedEvents: 0, state };
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const rows = extractEventRowsFromUtmify(payload);
    const batch = await registerTrafficEventsBatch(
      rows.map((row) => ({
        ...row,
        gateway: row.gateway ?? "utmify",
        provider: "utmify",
        event_type: row.event_type ?? "sale",
      })),
    );
    if (WAR_ROOM_OPS_CONSTANTS.offersLab.predictiveLtv.retrainEverySync) {
      await trainPredictiveLtvModel();
    }
    const syncedEvents = batch.created;
    const state: OffersLabSyncState = {
      lastSyncAt: now,
      lastStatus: "ok",
      lastMessage:
        batch.failed > 0
          ? `${syncedEvents} eventos sincronizados com UTMify (${batch.failed} falhas, ${batch.duplicates} duplicados).`
          : `${syncedEvents} eventos sincronizados com UTMify (${batch.duplicates} duplicados).`,
    };
    await offersRepo.writeSyncState(state);
    return { syncedEvents, state };
  } catch (error) {
    await captureServerError({
      route: "/api/offers-lab/sync",
      error,
      context: {
        source: "syncOffersFromUtmify",
      },
    });
    const state: OffersLabSyncState = {
      lastSyncAt: now,
      lastStatus: "error",
      lastMessage: error instanceof Error ? error.message : "Erro desconhecido no sync UTMify.",
    };
    await offersRepo.writeSyncState(state);
    return { syncedEvents: 0, state };
  }
}

