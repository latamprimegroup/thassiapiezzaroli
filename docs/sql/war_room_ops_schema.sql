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

-- OFFERS LAB - Production & Offers Engine
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
