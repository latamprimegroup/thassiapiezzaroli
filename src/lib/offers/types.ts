export type OfferStatus = "teste" | "validada" | "escala" | "arquivada";

export type TrafficSource = "meta" | "google" | "tiktok" | "kwai" | "networking" | "unknown";

export type GatewayName = "utmify" | "appmax" | "kiwify" | "yampi" | "manual";

export type TrafficEventType = "click" | "sale";

export type OfferRecord = {
  id: string;
  name: string;
  status: OfferStatus;
  niche: string;
  ownerId: string;
  minRoasTarget: number;
  trafficSource: TrafficSource;
  utmBroughtBy: string;
  bigIdea: string;
  uniqueMechanism: string;
  sophisticationLevel: 1 | 2 | 3 | 4 | 5;
  hookVariations: string[];
  launchCandidate: boolean;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt: string;
};

export type TrafficEventRecord = {
  id: string;
  offerId: string;
  eventType: TrafficEventType;
  gateway: GatewayName;
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
  createdAt: string;
};

export type OfferMetrics7d = {
  offerId: string;
  revenue7d: number;
  spend7d: number;
  roas7d: number;
  validatedForScale: boolean;
  candidateLaunch: boolean;
  statusSuggestion: OfferStatus;
};

export type OfferWithMetrics = OfferRecord & OfferMetrics7d;

export type TrafficSourceSummary = {
  source: TrafficSource;
  salesCount: number;
  revenue: number;
  spend: number;
  roas: number;
};

export type OffersLabSyncState = {
  lastSyncAt: string;
  lastStatus: "idle" | "ok" | "error";
  lastMessage: string;
};

export type UtmAliasRecord = {
  id: string;
  rawSource: string;
  canonicalSource: TrafficSource;
  approvedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type QuarantineReason =
  | "unknown_source"
  | "missing_name_id_pattern"
  | "networking_missing_brought_by"
  | "missing_offer_id"
  | "invalid_payload";

export type QuarantinedTrafficEventRecord = {
  id: string;
  eventId: string;
  offerId: string;
  rawSource: string;
  normalizedSource: TrafficSource;
  reason: QuarantineReason;
  detail: string;
  status: "open" | "resolved";
  payload: Record<string, unknown>;
  detectedAt: string;
};

export type LtvSampleRecord = {
  id: string;
  offerId: string;
  ltvD7: number;
  ltvD90: number;
  capturedAt: string;
  source: string;
};

export type PredictiveLtvModelState = {
  trainedAt: string;
  sampleSize: number;
  slope: number;
  intercept: number;
  r2: number;
  mae: number;
  driftRatio: number;
  driftStatus: "stable" | "warning" | "critical";
};

export type OffersLabDashboard = {
  offers: OfferWithMetrics[];
  validatedOffers: OfferWithMetrics[];
  sources: TrafficSourceSummary[];
  sync: OffersLabSyncState;
  governance: {
    aliases: UtmAliasRecord[];
    openQuarantineCount: number;
    recentQuarantine: QuarantinedTrafficEventRecord[];
  };
  predictiveLtv: PredictiveLtvModelState;
};

