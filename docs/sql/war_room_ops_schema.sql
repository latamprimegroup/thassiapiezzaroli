-- WAR ROOM OS - Operational Persistence Schema (PostgreSQL)
-- Apply this schema when using WAR_ROOM_OPS_PERSISTENCE_MODE=database.

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
