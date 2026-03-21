import { Pool, type PoolClient } from "pg";
import { buildDefaultPredictiveModelState } from "@/lib/offers/predictive-ltv";
import type {
  LtvSampleRecord,
  OfferRecord,
  OffersLabSyncState,
  PredictiveLtvModelState,
  QuarantinedTrafficEventRecord,
  TrafficEventRecord,
  UtmAliasRecord,
} from "@/lib/offers/types";

declare global {
  var __offersLabDbPool: Pool | undefined;
  var __offersLabDbSchemaReady: Promise<void> | undefined;
}

function asIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function asObject(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada para persistencia do Offers Lab.");
  }
  if (!globalThis.__offersLabDbPool) {
    globalThis.__offersLabDbPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 12,
    });
  }
  return globalThis.__offersLabDbPool;
}

async function ensureSchema() {
  if (!globalThis.__offersLabDbSchemaReady) {
    globalThis.__offersLabDbSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        create table if not exists offers_lab_offers (
          id text primary key,
          name text not null default '',
          status text not null,
          niche text not null default '',
          owner_id text not null default '',
          min_roas_target numeric not null default 1.8,
          traffic_source text not null default 'unknown',
          utm_brought_by text not null default '',
          big_idea text not null default '',
          unique_mechanism text not null default '',
          sophistication_level integer not null default 3,
          hook_variations jsonb not null default '[]'::jsonb,
          launch_candidate boolean not null default false,
          created_at timestamptz not null,
          updated_at timestamptz not null,
          last_validated_at timestamptz null
        );
        create index if not exists offers_lab_offers_status_idx
          on offers_lab_offers (status, updated_at desc);
        create index if not exists offers_lab_offers_niche_owner_idx
          on offers_lab_offers (niche, owner_id);
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'offers_lab_offers_networking_brought_by_ck'
          ) then
            alter table offers_lab_offers
            add constraint offers_lab_offers_networking_brought_by_ck
            check (
              traffic_source <> 'networking'
              or length(trim(utm_brought_by)) > 0
            ) not valid;
          end if;
        end $$;

        create table if not exists offers_lab_traffic_events (
          id text primary key,
          offer_id text not null,
          event_type text not null,
          gateway text not null,
          traffic_source text not null,
          occurred_at timestamptz not null,
          utm_source text not null default '',
          utm_campaign text not null default '',
          utm_medium text not null default '',
          utm_content text not null default '',
          utm_term text not null default '',
          campaign_name text not null default '',
          campaign_id text not null default '',
          content_name text not null default '',
          content_id text not null default '',
          term_name text not null default '',
          term_id text not null default '',
          utm_brought_by text not null default '',
          device text not null default '',
          network text not null default '',
          keyword text not null default '',
          revenue numeric not null default 0,
          spend numeric not null default 0,
          currency text not null default 'BRL',
          raw_payload jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        );
        create index if not exists offers_lab_traffic_events_offer_occ_idx
          on offers_lab_traffic_events (offer_id, occurred_at desc);
        create index if not exists offers_lab_traffic_events_source_idx
          on offers_lab_traffic_events (traffic_source, occurred_at desc);
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'offers_lab_traffic_events_networking_brought_by_ck'
          ) then
            alter table offers_lab_traffic_events
            add constraint offers_lab_traffic_events_networking_brought_by_ck
            check (
              traffic_source <> 'networking'
              or length(trim(utm_brought_by)) > 0
            ) not valid;
          end if;
        end $$;

        create table if not exists offers_lab_sync_state (
          state_key text primary key,
          last_sync_at timestamptz null,
          last_status text not null default 'idle',
          last_message text not null default ''
        );

        create table if not exists offers_lab_utm_aliases (
          id text primary key,
          raw_source text not null unique,
          canonical_source text not null,
          approved_by text not null default '',
          created_at timestamptz not null,
          updated_at timestamptz not null
        );
        create index if not exists offers_lab_utm_aliases_canonical_idx
          on offers_lab_utm_aliases (canonical_source, updated_at desc);

        create table if not exists offers_lab_quarantine_events (
          id text primary key,
          event_id text not null default '',
          offer_id text not null default '',
          raw_source text not null default '',
          normalized_source text not null default 'unknown',
          reason text not null,
          detail text not null default '',
          status text not null default 'open',
          payload jsonb not null default '{}'::jsonb,
          detected_at timestamptz not null
        );
        create index if not exists offers_lab_quarantine_status_idx
          on offers_lab_quarantine_events (status, detected_at desc);

        create table if not exists offers_lab_ltv_samples (
          id text primary key,
          offer_id text not null,
          ltv_d7 numeric not null default 0,
          ltv_d90 numeric not null default 0,
          captured_at timestamptz not null,
          source text not null default 'utmify'
        );
        create index if not exists offers_lab_ltv_samples_offer_idx
          on offers_lab_ltv_samples (offer_id, captured_at desc);

        create table if not exists offers_lab_predictive_ltv_state (
          state_key text primary key,
          trained_at timestamptz null,
          sample_size integer not null default 0,
          slope numeric not null default 0,
          intercept numeric not null default 0,
          r2 numeric not null default 0,
          mae numeric not null default 0,
          drift_ratio numeric not null default 0,
          drift_status text not null default 'stable'
        );
      `);
    })();
  }
  await globalThis.__offersLabDbSchemaReady;
}

async function withClient<T>(handler: (client: PoolClient) => Promise<T>) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

function toOffer(row: Record<string, unknown>): OfferRecord {
  const sophisticationLevel = Math.max(1, Math.min(5, Math.round(asNumber(row.sophistication_level)))) as 1 | 2 | 3 | 4 | 5;
  const hookVariations = Array.isArray(row.hook_variations)
    ? row.hook_variations.map((item) => String(item))
    : [];
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? "teste") as OfferRecord["status"],
    niche: String(row.niche ?? ""),
    ownerId: String(row.owner_id ?? ""),
    minRoasTarget: asNumber(row.min_roas_target),
    trafficSource: String(row.traffic_source ?? "unknown") as OfferRecord["trafficSource"],
    utmBroughtBy: String(row.utm_brought_by ?? ""),
    bigIdea: String(row.big_idea ?? ""),
    uniqueMechanism: String(row.unique_mechanism ?? ""),
    sophisticationLevel,
    hookVariations,
    launchCandidate: Boolean(row.launch_candidate),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    lastValidatedAt: asIso(row.last_validated_at),
  };
}

function toTrafficEvent(row: Record<string, unknown>): TrafficEventRecord {
  return {
    id: String(row.id ?? ""),
    offerId: String(row.offer_id ?? ""),
    eventType: String(row.event_type ?? "sale") as TrafficEventRecord["eventType"],
    gateway: String(row.gateway ?? "manual") as TrafficEventRecord["gateway"],
    trafficSource: String(row.traffic_source ?? "unknown") as TrafficEventRecord["trafficSource"],
    occurredAt: asIso(row.occurred_at),
    utmSource: String(row.utm_source ?? ""),
    utmCampaign: String(row.utm_campaign ?? ""),
    utmMedium: String(row.utm_medium ?? ""),
    utmContent: String(row.utm_content ?? ""),
    utmTerm: String(row.utm_term ?? ""),
    campaignName: String(row.campaign_name ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    contentName: String(row.content_name ?? ""),
    contentId: String(row.content_id ?? ""),
    termName: String(row.term_name ?? ""),
    termId: String(row.term_id ?? ""),
    utmBroughtBy: String(row.utm_brought_by ?? ""),
    device: String(row.device ?? ""),
    network: String(row.network ?? ""),
    keyword: String(row.keyword ?? ""),
    revenue: asNumber(row.revenue),
    spend: asNumber(row.spend),
    currency: String(row.currency ?? "BRL"),
    rawPayload: asObject(row.raw_payload),
    createdAt: asIso(row.created_at),
  };
}

function toSyncState(row: Record<string, unknown> | undefined): OffersLabSyncState {
  if (!row) {
    return {
      lastSyncAt: "",
      lastStatus: "idle",
      lastMessage: "",
    };
  }
  return {
    lastSyncAt: asIso(row.last_sync_at),
    lastStatus:
      String(row.last_status) === "ok" || String(row.last_status) === "error" || String(row.last_status) === "idle"
        ? (String(row.last_status) as OffersLabSyncState["lastStatus"])
        : "idle",
    lastMessage: String(row.last_message ?? ""),
  };
}

function toUtmAlias(row: Record<string, unknown>): UtmAliasRecord {
  return {
    id: String(row.id ?? ""),
    rawSource: String(row.raw_source ?? ""),
    canonicalSource: String(row.canonical_source ?? "unknown") as UtmAliasRecord["canonicalSource"],
    approvedBy: String(row.approved_by ?? ""),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function toQuarantine(row: Record<string, unknown>): QuarantinedTrafficEventRecord {
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? ""),
    offerId: String(row.offer_id ?? ""),
    rawSource: String(row.raw_source ?? ""),
    normalizedSource: String(row.normalized_source ?? "unknown") as QuarantinedTrafficEventRecord["normalizedSource"],
    reason: String(row.reason ?? "invalid_payload") as QuarantinedTrafficEventRecord["reason"],
    detail: String(row.detail ?? ""),
    status: String(row.status ?? "open") as QuarantinedTrafficEventRecord["status"],
    payload: asObject(row.payload),
    detectedAt: asIso(row.detected_at),
  };
}

function toLtvSample(row: Record<string, unknown>): LtvSampleRecord {
  return {
    id: String(row.id ?? ""),
    offerId: String(row.offer_id ?? ""),
    ltvD7: asNumber(row.ltv_d7),
    ltvD90: asNumber(row.ltv_d90),
    capturedAt: asIso(row.captured_at),
    source: String(row.source ?? ""),
  };
}

function toPredictiveModel(row: Record<string, unknown> | undefined): PredictiveLtvModelState {
  if (!row) {
    return buildDefaultPredictiveModelState();
  }
  const driftStatusRaw = String(row.drift_status ?? "stable");
  return {
    trainedAt: asIso(row.trained_at),
    sampleSize: Number(row.sample_size ?? 0),
    slope: asNumber(row.slope),
    intercept: asNumber(row.intercept),
    r2: asNumber(row.r2),
    mae: asNumber(row.mae),
    driftRatio: asNumber(row.drift_ratio),
    driftStatus: driftStatusRaw === "warning" || driftStatusRaw === "critical" ? driftStatusRaw : "stable",
  };
}

export async function readOffer(offerId: string) {
  return withClient(async (client) => {
    const result = await client.query(`select * from offers_lab_offers where id = $1 limit 1`, [offerId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toOffer(row) : null;
  });
}

export async function listOffers() {
  return withClient(async (client) => {
    const result = await client.query(`select * from offers_lab_offers order by updated_at desc`);
    return result.rows.map((row) => toOffer(row as Record<string, unknown>));
  });
}

export async function upsertOffer(record: OfferRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_offers
        (id, name, status, niche, owner_id, min_roas_target, traffic_source, utm_brought_by, big_idea, unique_mechanism, sophistication_level, hook_variations, launch_candidate, created_at, updated_at, last_validated_at)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::timestamptz, $15::timestamptz, nullif($16, '')::timestamptz)
      on conflict (id) do update set
        name = excluded.name,
        status = excluded.status,
        niche = excluded.niche,
        owner_id = excluded.owner_id,
        min_roas_target = excluded.min_roas_target,
        traffic_source = excluded.traffic_source,
        utm_brought_by = excluded.utm_brought_by,
        big_idea = excluded.big_idea,
        unique_mechanism = excluded.unique_mechanism,
        sophistication_level = excluded.sophistication_level,
        hook_variations = excluded.hook_variations,
        launch_candidate = excluded.launch_candidate,
        updated_at = excluded.updated_at,
        last_validated_at = excluded.last_validated_at
      `,
      [
        record.id,
        record.name,
        record.status,
        record.niche,
        record.ownerId,
        record.minRoasTarget,
        record.trafficSource,
        record.utmBroughtBy,
        record.bigIdea,
        record.uniqueMechanism,
        record.sophisticationLevel,
        JSON.stringify(record.hookVariations),
        record.launchCandidate,
        record.createdAt,
        record.updatedAt,
        record.lastValidatedAt,
      ],
    );
    return record;
  });
}

export async function appendTrafficEvent(event: TrafficEventRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_traffic_events
        (id, offer_id, event_type, gateway, traffic_source, occurred_at, utm_source, utm_campaign, utm_medium, utm_content, utm_term, campaign_name, campaign_id, content_name, content_id, term_name, term_id, utm_brought_by, device, network, keyword, revenue, spend, currency, raw_payload, created_at)
      values
        ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb, $26::timestamptz)
      on conflict (id) do nothing
      `,
      [
        event.id,
        event.offerId,
        event.eventType,
        event.gateway,
        event.trafficSource,
        event.occurredAt,
        event.utmSource,
        event.utmCampaign,
        event.utmMedium,
        event.utmContent,
        event.utmTerm,
        event.campaignName,
        event.campaignId,
        event.contentName,
        event.contentId,
        event.termName,
        event.termId,
        event.utmBroughtBy,
        event.device,
        event.network,
        event.keyword,
        event.revenue,
        event.spend,
        event.currency,
        JSON.stringify(event.rawPayload ?? {}),
        event.createdAt,
      ],
    );
    return event;
  });
}

export async function appendTrafficEventsBatch(events: TrafficEventRecord[]) {
  if (events.length === 0) {
    return { inserted: 0, attempted: 0 };
  }
  return withClient(async (client) => {
    const payload = events.map((event) => ({
      id: event.id,
      offer_id: event.offerId,
      event_type: event.eventType,
      gateway: event.gateway,
      traffic_source: event.trafficSource,
      occurred_at: event.occurredAt,
      utm_source: event.utmSource,
      utm_campaign: event.utmCampaign,
      utm_medium: event.utmMedium,
      utm_content: event.utmContent,
      utm_term: event.utmTerm,
      campaign_name: event.campaignName,
      campaign_id: event.campaignId,
      content_name: event.contentName,
      content_id: event.contentId,
      term_name: event.termName,
      term_id: event.termId,
      utm_brought_by: event.utmBroughtBy,
      device: event.device,
      network: event.network,
      keyword: event.keyword,
      revenue: event.revenue,
      spend: event.spend,
      currency: event.currency,
      raw_payload: event.rawPayload ?? {},
      created_at: event.createdAt,
    }));
    const result = await client.query(
      `
      with source_rows as (
        select *
        from jsonb_to_recordset($1::jsonb) as x(
          id text,
          offer_id text,
          event_type text,
          gateway text,
          traffic_source text,
          occurred_at timestamptz,
          utm_source text,
          utm_campaign text,
          utm_medium text,
          utm_content text,
          utm_term text,
          campaign_name text,
          campaign_id text,
          content_name text,
          content_id text,
          term_name text,
          term_id text,
          utm_brought_by text,
          device text,
          network text,
          keyword text,
          revenue numeric,
          spend numeric,
          currency text,
          raw_payload jsonb,
          created_at timestamptz
        )
      ),
      inserted as (
        insert into offers_lab_traffic_events
          (id, offer_id, event_type, gateway, traffic_source, occurred_at, utm_source, utm_campaign, utm_medium, utm_content, utm_term, campaign_name, campaign_id, content_name, content_id, term_name, term_id, utm_brought_by, device, network, keyword, revenue, spend, currency, raw_payload, created_at)
        select
          id, offer_id, event_type, gateway, traffic_source, occurred_at, utm_source, utm_campaign, utm_medium, utm_content, utm_term, campaign_name, campaign_id, content_name, content_id, term_name, term_id, utm_brought_by, device, network, keyword, revenue, spend, currency, raw_payload, created_at
        from source_rows
        on conflict (id) do nothing
        returning id
      )
      select count(*)::int as inserted from inserted
      `,
      [JSON.stringify(payload)],
    );
    return {
      inserted: Number(result.rows[0]?.inserted ?? 0),
      attempted: events.length,
    };
  });
}

export async function listTrafficEvents(params?: {
  offerId?: string;
  sinceIso?: string;
  eventType?: TrafficEventRecord["eventType"];
  limit?: number;
}) {
  return withClient(async (client) => {
    const limit = params?.limit ?? 100_000;
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (params?.offerId) {
      values.push(params.offerId);
      clauses.push(`offer_id = $${values.length}`);
    }
    if (params?.sinceIso) {
      values.push(params.sinceIso);
      clauses.push(`occurred_at >= $${values.length}::timestamptz`);
    }
    if (params?.eventType) {
      values.push(params.eventType);
      clauses.push(`event_type = $${values.length}`);
    }
    values.push(limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await client.query(
      `select * from offers_lab_traffic_events ${where} order by occurred_at desc limit $${values.length}`,
      values,
    );
    return result.rows.map((row) => toTrafficEvent(row as Record<string, unknown>));
  });
}

export async function readSyncState() {
  return withClient(async (client) => {
    const result = await client.query(`select * from offers_lab_sync_state where state_key = 'singleton' limit 1`);
    return toSyncState(result.rows[0] as Record<string, unknown> | undefined);
  });
}

export async function writeSyncState(state: OffersLabSyncState) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_sync_state (state_key, last_sync_at, last_status, last_message)
      values ('singleton', nullif($1, '')::timestamptz, $2, $3)
      on conflict (state_key) do update set
        last_sync_at = excluded.last_sync_at,
        last_status = excluded.last_status,
        last_message = excluded.last_message
      `,
      [state.lastSyncAt, state.lastStatus, state.lastMessage],
    );
    return state;
  });
}

export async function listUtmAliases() {
  return withClient(async (client) => {
    const result = await client.query(`select * from offers_lab_utm_aliases order by updated_at desc`);
    return result.rows.map((row) => toUtmAlias(row as Record<string, unknown>));
  });
}

export async function upsertUtmAlias(record: UtmAliasRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_utm_aliases
        (id, raw_source, canonical_source, approved_by, created_at, updated_at)
      values
        ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)
      on conflict (raw_source) do update set
        id = excluded.id,
        canonical_source = excluded.canonical_source,
        approved_by = excluded.approved_by,
        updated_at = excluded.updated_at
      `,
      [record.id, record.rawSource, record.canonicalSource, record.approvedBy, record.createdAt, record.updatedAt],
    );
    return record;
  });
}

export async function appendQuarantine(record: QuarantinedTrafficEventRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_quarantine_events
        (id, event_id, offer_id, raw_source, normalized_source, reason, detail, status, payload, detected_at)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
      on conflict (id) do nothing
      `,
      [
        record.id,
        record.eventId,
        record.offerId,
        record.rawSource,
        record.normalizedSource,
        record.reason,
        record.detail,
        record.status,
        JSON.stringify(record.payload ?? {}),
        record.detectedAt,
      ],
    );
    return record;
  });
}

export async function listQuarantine(params?: { status?: QuarantinedTrafficEventRecord["status"]; limit?: number }) {
  return withClient(async (client) => {
    const limit = params?.limit ?? 500;
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (params?.status) {
      values.push(params.status);
      clauses.push(`status = $${values.length}`);
    }
    values.push(limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await client.query(
      `select * from offers_lab_quarantine_events ${where} order by detected_at desc limit $${values.length}`,
      values,
    );
    return result.rows.map((row) => toQuarantine(row as Record<string, unknown>));
  });
}

export async function appendLtvSample(sample: LtvSampleRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_ltv_samples
        (id, offer_id, ltv_d7, ltv_d90, captured_at, source)
      values
        ($1, $2, $3, $4, $5::timestamptz, $6)
      on conflict (id) do nothing
      `,
      [sample.id, sample.offerId, sample.ltvD7, sample.ltvD90, sample.capturedAt, sample.source],
    );
    return sample;
  });
}

export async function listLtvSamples(params?: { offerId?: string; limit?: number }) {
  return withClient(async (client) => {
    const limit = params?.limit ?? 20_000;
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (params?.offerId) {
      values.push(params.offerId);
      clauses.push(`offer_id = $${values.length}`);
    }
    values.push(limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await client.query(
      `select * from offers_lab_ltv_samples ${where} order by captured_at desc limit $${values.length}`,
      values,
    );
    return result.rows.map((row) => toLtvSample(row as Record<string, unknown>));
  });
}

export async function readPredictiveLtvModel() {
  return withClient(async (client) => {
    const result = await client.query(`select * from offers_lab_predictive_ltv_state where state_key = 'singleton' limit 1`);
    return toPredictiveModel(result.rows[0] as Record<string, unknown> | undefined);
  });
}

export async function writePredictiveLtvModel(model: PredictiveLtvModelState) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into offers_lab_predictive_ltv_state
        (state_key, trained_at, sample_size, slope, intercept, r2, mae, drift_ratio, drift_status)
      values
        ('singleton', nullif($1, '')::timestamptz, $2, $3, $4, $5, $6, $7, $8)
      on conflict (state_key) do update set
        trained_at = excluded.trained_at,
        sample_size = excluded.sample_size,
        slope = excluded.slope,
        intercept = excluded.intercept,
        r2 = excluded.r2,
        mae = excluded.mae,
        drift_ratio = excluded.drift_ratio,
        drift_status = excluded.drift_status
      `,
      [
        model.trainedAt,
        model.sampleSize,
        model.slope,
        model.intercept,
        model.r2,
        model.mae,
        model.driftRatio,
        model.driftStatus,
      ],
    );
    return model;
  });
}

