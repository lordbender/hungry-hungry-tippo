create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  billing_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  keycloak_subject text not null unique,
  username text not null,
  email text,
  roles text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prompt_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references app_users(id),
  client_session_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

alter table prompt_logs
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists user_id uuid references app_users(id),
  add column if not exists session_id uuid references prompt_sessions(id);

create index if not exists idx_prompt_logs_organization_period
  on prompt_logs (organization_id, created_at desc);

create index if not exists idx_prompt_logs_user_period
  on prompt_logs (user_id, created_at desc);

create index if not exists idx_prompt_logs_session_period
  on prompt_logs (session_id, created_at desc);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  organization_id uuid not null references organizations(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'void')),
  request_count integer not null default 0,
  failed_request_count integer not null default 0,
  subtotal_tokens integer not null default 0,
  amount_cents integer not null default 0,
  created_by_user_id uuid references app_users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);

create index if not exists idx_invoices_organization_period
  on invoices (organization_id, period_start desc, period_end desc);

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  request_count integer not null default 0,
  input_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  amount_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
