import { Pool, type PoolClient } from "pg";
import type {
  ChurnPlaybookAction,
  LeadEventRecord,
  RoutingRule,
  TriggerPerformanceRecord,
} from "@/lib/persistence/lead-intelligence-store";

declare global {
  var __leadIntelligenceDbPool: Pool | undefined;
  var __leadIntelligenceDbSchemaReady: Promise<void> | undefined;
}

function nowIso() {
  return new Date().toISOString();
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

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asObject(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada para persistencia de Lead Intelligence.");
  }
  if (!globalThis.__leadIntelligenceDbPool) {
    globalThis.__leadIntelligenceDbPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return globalThis.__leadIntelligenceDbPool;
}

async function ensureSchema() {
  if (!globalThis.__leadIntelligenceDbSchemaReady) {
    globalThis.__leadIntelligenceDbSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        create table if not exists lead_intelligence_events (
          id text primary key,
          lead_id text not null,
          session_id text not null,
          offer_id text not null,
          utm_source text not null default 'unknown',
          utm_campaign text not null default '',
          utm_content text not null default 'unknown',
          event_type text not null,
          value numeric not null default 0,
          revenue numeric not null default 0,
          ad_cost numeric not null default 0,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null
        );
        create index if not exists lead_intelligence_events_lead_idx
          on lead_intelligence_events (lead_id, created_at desc);
        create index if not exists lead_intelligence_events_content_idx
          on lead_intelligence_events (utm_content, created_at desc);

        create table if not exists lead_intelligence_playbook_actions (
          id text primary key,
          lead_id text not null,
          action text not null,
          note text not null default '',
          triggered_by text not null default '',
          created_at timestamptz not null
        );
        create index if not exists lead_intelligence_playbooks_lead_idx
          on lead_intelligence_playbook_actions (lead_id, created_at desc);

        create table if not exists lead_intelligence_trigger_performance (
          id text primary key,
          trigger_id text not null,
          trigger_name text not null,
          niche text not null default 'geral',
          utm_content text not null default 'unknown',
          hook_rate numeric not null default 0,
          hold_rate numeric not null default 0,
          cpa numeric not null default 0,
          roas numeric not null default 0,
          ltv90 numeric not null default 0,
          recorded_at timestamptz not null
        );
        create index if not exists lead_intelligence_trigger_name_idx
          on lead_intelligence_trigger_performance (trigger_name, recorded_at desc);

        create table if not exists lead_intelligence_routing_rules (
          id text primary key,
          offer_id text not null,
          primary_url text not null,
          backup_urls jsonb not null default '[]'::jsonb,
          active_url text not null,
          mode text not null,
          reason text not null default '',
          last_switch_at timestamptz not null
        );
        create unique index if not exists lead_intelligence_routing_offer_unique
          on lead_intelligence_routing_rules (offer_id);
      `);
    })();
  }
  await globalThis.__leadIntelligenceDbSchemaReady;
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

function toLeadEvent(row: Record<string, unknown>): LeadEventRecord {
  return {
    id: String(row.id ?? ""),
    leadId: String(row.lead_id ?? ""),
    sessionId: String(row.session_id ?? ""),
    offerId: String(row.offer_id ?? ""),
    utmSource: String(row.utm_source ?? "unknown"),
    utmCampaign: String(row.utm_campaign ?? ""),
    utmContent: String(row.utm_content ?? "unknown"),
    eventType: String(row.event_type ?? "landing_view") as LeadEventRecord["eventType"],
    value: asNumber(row.value),
    revenue: asNumber(row.revenue),
    adCost: asNumber(row.ad_cost),
    createdAt: asIso(row.created_at),
    metadata: asObject(row.metadata),
  };
}

function toPlaybookAction(row: Record<string, unknown>): ChurnPlaybookAction {
  return {
    id: String(row.id ?? ""),
    leadId: String(row.lead_id ?? ""),
    action: String(row.action ?? "support_ticket") as ChurnPlaybookAction["action"],
    note: String(row.note ?? ""),
    triggeredBy: String(row.triggered_by ?? ""),
    createdAt: asIso(row.created_at),
  };
}

function toTriggerPerformance(row: Record<string, unknown>): TriggerPerformanceRecord {
  return {
    id: String(row.id ?? ""),
    triggerId: String(row.trigger_id ?? ""),
    triggerName: String(row.trigger_name ?? ""),
    niche: String(row.niche ?? "geral"),
    utmContent: String(row.utm_content ?? "unknown"),
    hookRate: asNumber(row.hook_rate),
    holdRate: asNumber(row.hold_rate),
    cpa: asNumber(row.cpa),
    roas: asNumber(row.roas),
    ltv90: asNumber(row.ltv90),
    recordedAt: asIso(row.recorded_at),
  };
}

function toRoutingRule(row: Record<string, unknown>): RoutingRule {
  return {
    id: String(row.id ?? ""),
    offerId: String(row.offer_id ?? "global"),
    primaryUrl: String(row.primary_url ?? ""),
    backupUrls: asStringArray(row.backup_urls),
    activeUrl: String(row.active_url ?? ""),
    mode: String(row.mode ?? "primary") as RoutingRule["mode"],
    reason: String(row.reason ?? ""),
    lastSwitchAt: asIso(row.last_switch_at),
  };
}

export async function listLeadEvents(limit = 5000) {
  const safeLimit = Math.max(1, Math.min(200_000, limit));
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from lead_intelligence_events
      order by created_at desc
      limit $1
      `,
      [safeLimit],
    );
    return result.rows.map((row) => toLeadEvent(row as Record<string, unknown>));
  });
}

export async function appendLeadEvents(records: Omit<LeadEventRecord, "id" | "createdAt">[]) {
  if (records.length === 0) {
    return [];
  }
  return withClient(async (client) => {
    const created = records.map((record) => ({
      ...record,
      id: `LE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: nowIso(),
    }));
    for (const row of created) {
      await client.query(
        `
        insert into lead_intelligence_events (
          id, lead_id, session_id, offer_id, utm_source, utm_campaign, utm_content, event_type, value, revenue, ad_cost, metadata, created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::timestamptz)
        on conflict (id) do nothing
        `,
        [
          row.id,
          row.leadId,
          row.sessionId,
          row.offerId,
          row.utmSource,
          row.utmCampaign,
          row.utmContent,
          row.eventType,
          Number.isFinite(row.value) ? row.value : 0,
          Number.isFinite(row.revenue) ? row.revenue : 0,
          Number.isFinite(row.adCost) ? row.adCost : 0,
          JSON.stringify(row.metadata ?? {}),
          row.createdAt,
        ],
      );
    }
    return created;
  });
}

export async function listPlaybookActions(limit = 500) {
  const safeLimit = Math.max(1, Math.min(50_000, limit));
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from lead_intelligence_playbook_actions
      order by created_at desc
      limit $1
      `,
      [safeLimit],
    );
    return result.rows.map((row) => toPlaybookAction(row as Record<string, unknown>));
  });
}

export async function appendPlaybookAction(input: Omit<ChurnPlaybookAction, "id" | "createdAt">) {
  return withClient(async (client) => {
    const created: ChurnPlaybookAction = {
      ...input,
      id: `PA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: nowIso(),
    };
    await client.query(
      `
      insert into lead_intelligence_playbook_actions (
        id, lead_id, action, note, triggered_by, created_at
      ) values ($1,$2,$3,$4,$5,$6::timestamptz)
      on conflict (id) do nothing
      `,
      [created.id, created.leadId, created.action, created.note, created.triggeredBy, created.createdAt],
    );
    return created;
  });
}

export async function listTriggerPerformance(limit = 2000) {
  const safeLimit = Math.max(1, Math.min(100_000, limit));
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from lead_intelligence_trigger_performance
      order by recorded_at desc
      limit $1
      `,
      [safeLimit],
    );
    return result.rows.map((row) => toTriggerPerformance(row as Record<string, unknown>));
  });
}

export async function appendTriggerPerformance(records: Omit<TriggerPerformanceRecord, "id" | "recordedAt">[]) {
  if (records.length === 0) {
    return [];
  }
  return withClient(async (client) => {
    const created = records.map((record) => ({
      ...record,
      id: `TP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: nowIso(),
    }));
    for (const row of created) {
      await client.query(
        `
        insert into lead_intelligence_trigger_performance (
          id, trigger_id, trigger_name, niche, utm_content, hook_rate, hold_rate, cpa, roas, ltv90, recorded_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz)
        on conflict (id) do nothing
        `,
        [
          row.id,
          row.triggerId,
          row.triggerName,
          row.niche,
          row.utmContent,
          Number.isFinite(row.hookRate) ? row.hookRate : 0,
          Number.isFinite(row.holdRate) ? row.holdRate : 0,
          Number.isFinite(row.cpa) ? row.cpa : 0,
          Number.isFinite(row.roas) ? row.roas : 0,
          Number.isFinite(row.ltv90) ? row.ltv90 : 0,
          row.recordedAt,
        ],
      );
    }
    return created;
  });
}

export async function listRoutingRules() {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from lead_intelligence_routing_rules
      order by offer_id asc
      `,
    );
    return result.rows.map((row) => toRoutingRule(row as Record<string, unknown>));
  });
}

export async function upsertRoutingRule(input: RoutingRule) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into lead_intelligence_routing_rules (
        id, offer_id, primary_url, backup_urls, active_url, mode, reason, last_switch_at
      ) values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::timestamptz)
      on conflict (id) do update
      set
        offer_id = excluded.offer_id,
        primary_url = excluded.primary_url,
        backup_urls = excluded.backup_urls,
        active_url = excluded.active_url,
        mode = excluded.mode,
        reason = excluded.reason,
        last_switch_at = excluded.last_switch_at
      `,
      [
        input.id,
        input.offerId,
        input.primaryUrl,
        JSON.stringify(input.backupUrls ?? []),
        input.activeUrl,
        input.mode,
        input.reason,
        input.lastSwitchAt,
      ],
    );
    return input;
  });
}

export async function updateRoutingRule(id: string, patch: Partial<RoutingRule> & { reason?: string }) {
  return withClient(async (client) => {
    const currentQuery = await client.query(
      `
      select *
      from lead_intelligence_routing_rules
      where id = $1
      limit 1
      `,
      [id],
    );
    if (currentQuery.rows.length === 0) {
      return null;
    }
    const current = toRoutingRule(currentQuery.rows[0] as Record<string, unknown>);
    const updated: RoutingRule = {
      ...current,
      ...patch,
      reason: typeof patch.reason === "string" && patch.reason.trim().length > 0 ? patch.reason : current.reason,
      lastSwitchAt: patch.activeUrl && patch.activeUrl !== current.activeUrl ? nowIso() : current.lastSwitchAt,
    };
    await client.query(
      `
      update lead_intelligence_routing_rules
      set
        offer_id = $2,
        primary_url = $3,
        backup_urls = $4::jsonb,
        active_url = $5,
        mode = $6,
        reason = $7,
        last_switch_at = $8::timestamptz
      where id = $1
      `,
      [
        id,
        updated.offerId,
        updated.primaryUrl,
        JSON.stringify(updated.backupUrls ?? []),
        updated.activeUrl,
        updated.mode,
        updated.reason,
        updated.lastSwitchAt,
      ],
    );
    return updated;
  });
}
