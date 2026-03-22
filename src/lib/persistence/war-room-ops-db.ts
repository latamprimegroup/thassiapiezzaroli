import { Pool, type PoolClient } from "pg";
import type {
  OpsIncidentRecord,
  OpsIncidentStatus,
  OpsJobRecord,
  TaskApprovalRecord,
  WebhookEventRecord,
} from "@/lib/persistence/war-room-ops-store";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";
import type { ProviderName } from "@/lib/integrations/warroom-adapters";
import type { WarRoomData } from "@/lib/war-room/types";

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

declare global {
  var __warRoomOpsDbPool: Pool | undefined;
  var __warRoomOpsDbSchemaReady: Promise<void> | undefined;
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

function toWebhookEvent(row: Record<string, unknown>): WebhookEventRecord {
  return {
    id: String(row.id ?? ""),
    provider: String(row.provider ?? "") as ProviderName,
    eventId: String(row.event_id ?? ""),
    status: String(row.status ?? "") as WebhookEventRecord["status"],
    attempts: Number(row.attempts ?? 0),
    receivedAt: asIso(row.received_at),
    processedAt: asIso(row.processed_at),
    nextRetryAt: asIso(row.next_retry_at),
    lastError: String(row.last_error ?? ""),
    signatureValid: Boolean(row.signature_valid),
    payload: asObject(row.payload),
  };
}

function toOpsJob(row: Record<string, unknown>): OpsJobRecord {
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? "") as OpsJobRecord["type"],
    status: String(row.status ?? "") as OpsJobRecord["status"],
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 0),
    runAt: asIso(row.run_at),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    processedAt: asIso(row.processed_at),
    lastError: String(row.last_error ?? ""),
    payload: asObject(row.payload),
  };
}

function toIncident(row: Record<string, unknown>): OpsIncidentRecord {
  return {
    id: String(row.id ?? ""),
    key: String(row.incident_key ?? ""),
    squad: String(row.squad ?? "") as OpsIncidentRecord["squad"],
    severity: String(row.severity ?? "") as OpsIncidentRecord["severity"],
    status: String(row.status ?? "") as OpsIncidentRecord["status"],
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    source: String(row.source ?? ""),
    startedAt: asIso(row.started_at),
    lastSeenAt: asIso(row.last_seen_at),
    resolvedAt: asIso(row.resolved_at),
    resolutionMinutes: Number(row.resolution_minutes ?? 0),
    resolutionNote: String(row.resolution_note ?? ""),
    resolvedBy: String(row.resolved_by ?? ""),
    slaTargetMinutes: Number(row.sla_target_minutes ?? 0),
    slaBreached: Boolean(row.sla_breached),
  };
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada para persistencia database.");
  }
  if (!globalThis.__warRoomOpsDbPool) {
    globalThis.__warRoomOpsDbPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 12,
    });
  }
  return globalThis.__warRoomOpsDbPool;
}

async function ensureSchema() {
  if (!globalThis.__warRoomOpsDbSchemaReady) {
    globalThis.__warRoomOpsDbSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        create table if not exists war_room_webhook_events (
          id text primary key,
          provider text not null,
          event_id text not null,
          status text not null,
          attempts integer not null default 0,
          received_at timestamptz not null,
          processed_at timestamptz null,
          next_retry_at timestamptz null,
          last_error text not null default '',
          signature_valid boolean not null default false,
          payload jsonb not null default '{}'::jsonb
        );
        create unique index if not exists war_room_webhook_events_provider_event_uidx
          on war_room_webhook_events (provider, event_id);
        create index if not exists war_room_webhook_events_retry_idx
          on war_room_webhook_events (status, next_retry_at);

        create table if not exists war_room_ops_jobs (
          id text primary key,
          type text not null,
          status text not null,
          attempts integer not null default 0,
          max_attempts integer not null default 6,
          run_at timestamptz not null,
          created_at timestamptz not null,
          updated_at timestamptz not null,
          processed_at timestamptz null,
          last_error text not null default '',
          payload jsonb not null default '{}'::jsonb
        );
        create index if not exists war_room_ops_jobs_pending_idx
          on war_room_ops_jobs (status, run_at);

        create table if not exists war_room_command_center_state (
          state_key text primary key,
          tasks jsonb not null default '[]'::jsonb
        );

        create table if not exists war_room_task_approvals (
          id bigserial primary key,
          task_id text not null,
          approved_by text not null,
          approved_role text not null,
          approved_at timestamptz not null,
          note text not null default ''
        );
        create index if not exists war_room_task_approvals_task_idx
          on war_room_task_approvals (task_id, approved_at desc);

        create table if not exists war_room_ops_incidents (
          id text primary key,
          incident_key text not null,
          squad text not null,
          severity text not null,
          status text not null,
          title text not null,
          description text not null,
          source text not null,
          started_at timestamptz not null,
          last_seen_at timestamptz not null,
          resolved_at timestamptz null,
          resolution_minutes integer not null default 0,
          resolution_note text not null default '',
          resolved_by text not null default '',
          sla_target_minutes integer not null default 0,
          sla_breached boolean not null default false
        );
        create index if not exists war_room_ops_incidents_status_idx
          on war_room_ops_incidents (status, last_seen_at desc);
        create unique index if not exists war_room_ops_incidents_open_key_uidx
          on war_room_ops_incidents (incident_key) where status = 'open';
      `);
    })();
  }
  await globalThis.__warRoomOpsDbSchemaReady;
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

function nowIso() {
  return new Date().toISOString();
}

export async function readWebhookEvent(provider: ProviderName, eventId: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `select * from war_room_webhook_events where provider = $1 and event_id = $2 limit 1`,
      [provider, eventId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toWebhookEvent(row) : null;
  });
}

export async function upsertWebhookEvent(record: WebhookEventRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into war_room_webhook_events
        (id, provider, event_id, status, attempts, received_at, processed_at, next_retry_at, last_error, signature_valid, payload)
      values
        ($1, $2, $3, $4, $5, $6::timestamptz, nullif($7, '')::timestamptz, nullif($8, '')::timestamptz, $9, $10, $11::jsonb)
      on conflict (id) do update set
        provider = excluded.provider,
        event_id = excluded.event_id,
        status = excluded.status,
        attempts = excluded.attempts,
        received_at = excluded.received_at,
        processed_at = excluded.processed_at,
        next_retry_at = excluded.next_retry_at,
        last_error = excluded.last_error,
        signature_valid = excluded.signature_valid,
        payload = excluded.payload
      `,
      [
        record.id,
        record.provider,
        record.eventId,
        record.status,
        record.attempts,
        record.receivedAt || nowIso(),
        record.processedAt || "",
        record.nextRetryAt || "",
        record.lastError || "",
        record.signatureValid,
        JSON.stringify(record.payload ?? {}),
      ],
    );
    return record;
  });
}

export async function listDueRetryEvents(limit = 50) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select * from war_room_webhook_events
      where status = 'retry' and next_retry_at is not null and next_retry_at <= now()
      order by next_retry_at asc
      limit $1
      `,
      [limit],
    );
    return result.rows.map((row) => toWebhookEvent(row as Record<string, unknown>));
  });
}

export async function listDeadLetterEvents(limit = 50) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select * from war_room_webhook_events
      where status = 'dead_letter'
      order by received_at desc
      limit $1
      `,
      [limit],
    );
    return result.rows.map((row) => toWebhookEvent(row as Record<string, unknown>));
  });
}

export async function readPersistedCommandCenterTasks() {
  return withClient(async (client) => {
    const result = await client.query(
      `select tasks from war_room_command_center_state where state_key = 'singleton' limit 1`,
    );
    const tasks = result.rows[0]?.tasks;
    return Array.isArray(tasks) ? (tasks as DemandTask[]) : [];
  });
}

export async function writePersistedCommandCenterTasks(tasks: DemandTask[]) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into war_room_command_center_state (state_key, tasks)
      values ('singleton', $1::jsonb)
      on conflict (state_key) do update set tasks = excluded.tasks
      `,
      [JSON.stringify(tasks)],
    );
    return tasks;
  });
}

export async function appendTaskApproval(approval: TaskApprovalRecord) {
  return withClient(async (client) => {
    await client.query(
      `
      insert into war_room_task_approvals (task_id, approved_by, approved_role, approved_at, note)
      values ($1, $2, $3, $4::timestamptz, $5)
      `,
      [approval.taskId, approval.approvedBy, approval.approvedRole, approval.approvedAt || nowIso(), approval.note || ""],
    );
    return approval;
  });
}

export async function readTaskApprovals(taskId: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select task_id, approved_by, approved_role, approved_at, note
      from war_room_task_approvals
      where task_id = $1
      order by approved_at asc
      `,
      [taskId],
    );
    return result.rows.map((row) => ({
      taskId: String(row.task_id),
      approvedBy: String(row.approved_by),
      approvedRole: String(row.approved_role),
      approvedAt: asIso(row.approved_at),
      note: String(row.note ?? ""),
    })) satisfies TaskApprovalRecord[];
  });
}

export async function enqueueOpsJob(params: {
  id: string;
  type: OpsJobRecord["type"];
  payload: Record<string, unknown>;
  runAt?: string;
  maxAttempts?: number;
}) {
  return withClient(async (client) => {
    const now = nowIso();
    const record: OpsJobRecord = {
      id: params.id,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 6,
      runAt: params.runAt ?? now,
      createdAt: now,
      updatedAt: now,
      processedAt: "",
      lastError: "",
      payload: params.payload,
    };
    await client.query(
      `
      insert into war_room_ops_jobs
        (id, type, status, attempts, max_attempts, run_at, created_at, updated_at, processed_at, last_error, payload)
      values
        ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, null, $9, $10::jsonb)
      on conflict (id) do update set
        type = excluded.type,
        status = excluded.status,
        attempts = excluded.attempts,
        max_attempts = excluded.max_attempts,
        run_at = excluded.run_at,
        updated_at = excluded.updated_at,
        processed_at = excluded.processed_at,
        last_error = excluded.last_error,
        payload = excluded.payload
      `,
      [
        record.id,
        record.type,
        record.status,
        record.attempts,
        record.maxAttempts,
        record.runAt,
        record.createdAt,
        record.updatedAt,
        record.lastError,
        JSON.stringify(record.payload),
      ],
    );
    return record;
  });
}

export async function claimDueOpsJobs(limit = 25) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const ids = await client.query(
        `
        select id
        from war_room_ops_jobs
        where status = 'pending' and run_at <= now()
        order by run_at asc
        limit $1
        for update skip locked
        `,
        [limit],
      );
      if (ids.rows.length === 0) {
        await client.query("commit");
        return [] satisfies OpsJobRecord[];
      }
      const idList = ids.rows.map((row) => String(row.id));
      const updated = await client.query(
        `
        update war_room_ops_jobs
        set status = 'processing',
            attempts = attempts + 1,
            updated_at = now()
        where id = any($1::text[])
        returning *
        `,
        [idList],
      );
      await client.query("commit");
      return updated.rows.map((row) => toOpsJob(row as Record<string, unknown>));
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function completeOpsJob(jobId: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      update war_room_ops_jobs
      set status = 'completed',
          updated_at = now(),
          processed_at = now(),
          last_error = ''
      where id = $1
      returning *
      `,
      [jobId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toOpsJob(row) : null;
  });
}

export async function failOpsJob(jobId: string, errorMessage: string) {
  return withClient(async (client) => {
    const currentRes = await client.query(`select * from war_room_ops_jobs where id = $1 limit 1`, [jobId]);
    const current = currentRes.rows[0] as Record<string, unknown> | undefined;
    if (!current) {
      return null;
    }
    const attempts = Number(current.attempts ?? 0);
    const maxAttempts = Number(current.max_attempts ?? 6);
    const shouldDeadLetter = attempts >= maxAttempts;
    const backoffMinutes = Math.min(
      WAR_ROOM_OPS_CONSTANTS.queue.webhook.maxBackoffMinutes,
      WAR_ROOM_OPS_CONSTANTS.queue.webhook.retryBaseMinutes ** Math.max(1, attempts),
    );
    const result = await client.query(
      `
      update war_room_ops_jobs
      set status = $2,
          run_at = case when $2 = 'dead_letter' then run_at else now() + ($3::text || ' minutes')::interval end,
          updated_at = now(),
          last_error = $4
      where id = $1
      returning *
      `,
      [jobId, shouldDeadLetter ? "dead_letter" : "pending", String(backoffMinutes), errorMessage],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toOpsJob(row) : null;
  });
}

export async function deadLetterOpsJob(jobId: string, errorMessage: string) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      update war_room_ops_jobs
      set status = 'dead_letter',
          updated_at = now(),
          processed_at = now(),
          last_error = $2
      where id = $1
      returning *
      `,
      [jobId, errorMessage],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toOpsJob(row) : null;
  });
}

export async function getOpsJobStats() {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select
        count(*) filter (where status in ('pending','processing'))::int as queue_depth,
        count(*) filter (where status in ('failed','dead_letter'))::int as failed_jobs,
        count(*) filter (where status = 'completed' and processed_at::date = current_date)::int as processed_today,
        max(updated_at) as last_run_at
      from war_room_ops_jobs
      `,
    );
    const row = result.rows[0] as Record<string, unknown>;
    return {
      queueDepth: Number(row.queue_depth ?? 0),
      failedJobs: Number(row.failed_jobs ?? 0),
      processedToday: Number(row.processed_today ?? 0),
      lastRunAt: asIso(row.last_run_at),
    };
  });
}

function buildIncidentId() {
  return `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSlaBreached(startedAt: string, targetMinutes: number) {
  const startedMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedMs) || targetMinutes <= 0) {
    return false;
  }
  return Date.now() - startedMs > targetMinutes * 60_000;
}

export async function upsertOpsIncident(params: {
  key: string;
  squad: OpsIncidentRecord["squad"];
  severity: OpsIncidentRecord["severity"];
  title: string;
  description: string;
  source: string;
  slaTargetMinutes: number;
}) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const updateRes = await client.query(
        `
        update war_room_ops_incidents
        set
          severity = $3,
          title = $4,
          description = $5,
          source = $6,
          sla_target_minutes = $7,
          last_seen_at = now(),
          sla_breached = case
            when (extract(epoch from (now() - started_at)) / 60.0) > $7 then true
            else sla_breached
          end
        where incident_key = $1 and status = 'open'
        returning *
        `,
        [params.key, params.squad, params.severity, params.title, params.description, params.source, params.slaTargetMinutes],
      );
      if (updateRes.rows[0]) {
        await client.query("commit");
        return toIncident(updateRes.rows[0] as Record<string, unknown>);
      }

      const insertRes = await client.query(
        `
        insert into war_room_ops_incidents
          (id, incident_key, squad, severity, status, title, description, source, started_at, last_seen_at, resolved_at, resolution_minutes, resolution_note, resolved_by, sla_target_minutes, sla_breached)
        values
          ($1, $2, $3, $4, 'open', $5, $6, $7, now(), now(), null, 0, '', '', $8, false)
        returning *
        `,
        [buildIncidentId(), params.key, params.squad, params.severity, params.title, params.description, params.source, params.slaTargetMinutes],
      );
      await client.query("commit");
      return toIncident(insertRes.rows[0] as Record<string, unknown>);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function resolveOpsIncidentByKey(key: string, note = "Resolvido automaticamente pelo sistema.", resolvedBy = "war-room-automation") {
  return withClient(async (client) => {
    const result = await client.query(
      `
      update war_room_ops_incidents
      set
        status = 'resolved',
        resolved_at = now(),
        resolution_minutes = greatest(0, round(extract(epoch from (now() - started_at)) / 60.0)::int),
        resolution_note = $2,
        resolved_by = $3,
        last_seen_at = now(),
        sla_breached = case
          when (extract(epoch from (now() - started_at)) / 60.0) > sla_target_minutes then true
          else sla_breached
        end
      where incident_key = $1 and status = 'open'
      returning *
      `,
      [key, note, resolvedBy],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toIncident(row) : null;
  });
}

export async function resolveOpsIncidentById(incidentId: string, note = "Resolvido manualmente.", resolvedBy = "operator") {
  return withClient(async (client) => {
    const result = await client.query(
      `
      update war_room_ops_incidents
      set
        status = 'resolved',
        resolved_at = now(),
        resolution_minutes = greatest(0, round(extract(epoch from (now() - started_at)) / 60.0)::int),
        resolution_note = $2,
        resolved_by = $3,
        last_seen_at = now(),
        sla_breached = case
          when (extract(epoch from (now() - started_at)) / 60.0) > sla_target_minutes then true
          else sla_breached
        end
      where id = $1 and status = 'open'
      returning *
      `,
      [incidentId, note, resolvedBy],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toIncident(row) : null;
  });
}

export async function listOpsIncidents(params?: { limit?: number; status?: OpsIncidentStatus }) {
  return withClient(async (client) => {
    const limit = params?.limit ?? WAR_ROOM_OPS_CONSTANTS.observability.incidents.maxRecentItems;
    const status = params?.status;
    const result = status
      ? await client.query(
          `
          select *
          from war_room_ops_incidents
          where status = $1
          order by coalesce(resolved_at, last_seen_at) desc
          limit $2
          `,
          [status, limit],
        )
      : await client.query(
          `
          select *
          from war_room_ops_incidents
          order by coalesce(resolved_at, last_seen_at) desc
          limit $1
          `,
          [limit],
        );
    return result.rows.map((row) => toIncident(row as Record<string, unknown>));
  });
}

export async function getOpsIncidentMetrics(days = WAR_ROOM_OPS_CONSTANTS.observability.incidents.historyRetentionDays) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      select *
      from war_room_ops_incidents
      where coalesce(resolved_at, started_at) >= now() - ($1::text || ' days')::interval
      `,
      [String(days)],
    );
    const incidents = result.rows.map((row) => toIncident(row as Record<string, unknown>));
    const open = incidents.filter((incident) => incident.status === "open");
    const resolved = incidents.filter((incident) => incident.status === "resolved");
    const breachedOpen = open.filter(
      (incident) => incident.slaBreached || isSlaBreached(incident.startedAt, incident.slaTargetMinutes),
    ).length;

    const squads: OpsIncidentRecord["squad"][] = ["techCro", "trafficMedia", "copyResearch", "ceoFinance", "platform"];
    const mttrBySquad = squads.map((squad) => {
      const rows = resolved.filter((incident) => incident.squad === squad && incident.resolutionMinutes > 0);
      const avg = rows.length > 0 ? rows.reduce((acc, row) => acc + row.resolutionMinutes, 0) / rows.length : 0;
      return {
        squad,
        incidents: rows.length,
        mttrMinutes: Number(avg.toFixed(1)),
      };
    });
    return {
      openCount: open.length,
      resolvedCount: resolved.length,
      breachedOpenCount: breachedOpen,
      mttrBySquad,
    };
  });
}
