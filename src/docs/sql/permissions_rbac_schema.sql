-- RBAC + workflow schema for WAR ROOM OS (9D standard)

create table if not exists app_roles (
  id text primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id text primary key,
  email text unique,
  full_name text not null,
  role_id text not null references app_roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id text not null references app_roles(id),
  resource text not null,
  action text not null check (action in ('read', 'write', 'approve', 'admin')),
  primary key (role_id, resource, action)
);

create table if not exists daily_task_logs (
  id text primary key,
  user_id text not null references app_users(id),
  role_id text not null references app_roles(id),
  summary text not null,
  blockers text not null default '',
  impact_note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists asset_workflow (
  id text primary key,
  title text not null,
  offer_id text not null,
  status text not null check (status in ('aguardando_edicao', 'pronto_para_trafego')),
  created_by_user_id text not null references app_users(id),
  assigned_editor_user_id text references app_users(id),
  creative_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists asset_workflow_history (
  id bigserial primary key,
  asset_id text not null references asset_workflow(id) on delete cascade,
  actor_user_id text references app_users(id),
  action text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_task_logs_created_at on daily_task_logs (created_at desc);
create index if not exists idx_asset_workflow_status on asset_workflow (status);
