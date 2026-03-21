import { randomUUID } from "node:crypto";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import * as offersRepo from "@/lib/offers/offers-lab-repository";
import type {
  OfferMetrics7d,
  OfferRecord,
  OffersLabDashboard,
  OffersLabSyncState,
  OfferWithMetrics,
  TrafficEventRecord,
  TrafficSourceSummary,
} from "@/lib/offers/types";
import { normalizeGatewayPayload, normalizeTrafficSource } from "@/lib/offers/utm-normalization";

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

function nowIso() {
  return new Date().toISOString();
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

  await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/notify-squad`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }).catch(() => undefined);
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
  const revenue7d = events.reduce((acc, event) => acc + event.revenue, 0);
  const spend7d = events.reduce((acc, event) => acc + event.spend, 0);
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
  return record;
}

export async function registerTrafficEvent(payload: Record<string, unknown>) {
  const normalized = normalizeGatewayPayload(payload);
  if (!normalized.offerId) {
    throw new Error("offer_id obrigatorio para registrar traffic_event.");
  }
  if (normalized.trafficSource === "networking" && !normalized.utmBroughtBy) {
    throw new Error("utm_brought_by obrigatorio para eventos de networking.");
  }
  const event: TrafficEventRecord = {
    id:
      String(payload.event_id || payload.id || "").trim() ||
      `TE-${normalized.offerId}-${normalized.eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    offerId: normalized.offerId,
    eventType: normalized.eventType,
    gateway: normalized.gateway,
    trafficSource: normalized.trafficSource,
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
  return event;
}

export async function getOffersLabDashboard(filters?: DashboardFilters): Promise<OffersLabDashboard> {
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [offers, events7d, sync] = await Promise.all([
    offersRepo.listOffers(),
    offersRepo.listTrafficEvents({ sinceIso: windowStart }),
    offersRepo.readSyncState(),
  ]);
  const evaluated = await autoValidateOffers(offers, events7d);
  const filtered = applyDashboardFilters(evaluated, filters);
  const ids = new Set(filtered.map((offer) => offer.id));
  const sourceSummary = buildSourceSummary(events7d.filter((event) => ids.has(event.offerId)));
  const validatedOffers = filtered.filter((offer) => offer.validatedForScale);
  return {
    offers: filtered,
    validatedOffers,
    sources: sourceSummary,
    sync,
  };
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
    let syncedEvents = 0;
    for (const row of rows) {
      await registerTrafficEvent({
        ...row,
        gateway: row.gateway ?? "utmify",
        provider: "utmify",
        event_type: row.event_type ?? "sale",
      });
      syncedEvents += 1;
    }
    const state: OffersLabSyncState = {
      lastSyncAt: now,
      lastStatus: "ok",
      lastMessage: `${syncedEvents} eventos sincronizados com UTMify.`,
    };
    await offersRepo.writeSyncState(state);
    return { syncedEvents, state };
  } catch (error) {
    const state: OffersLabSyncState = {
      lastSyncAt: now,
      lastStatus: "error",
      lastMessage: error instanceof Error ? error.message : "Erro desconhecido no sync UTMify.",
    };
    await offersRepo.writeSyncState(state);
    return { syncedEvents: 0, state };
  }
}

