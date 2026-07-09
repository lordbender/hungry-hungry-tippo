create table if not exists billing_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  name text not null,
  description text,
  module_type text not null check (module_type in ('conductor', 'rag', 'model', 'tool', 'platform')),
  default_unit_name text not null,
  is_billable boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pricing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  currency text not null default 'USD',
  default_markup_rate numeric(8, 4) not null default 0.5,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pricing_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pricing_plans(id),
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

create table if not exists pricing_cost_components (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references pricing_plan_versions(id) on delete cascade,
  component_key text not null,
  name text not null,
  category text not null check (category in ('api_usage', 'hosting', 'operations', 'engineering', 'support', 'margin')),
  monthly_cost_cents integer not null default 0,
  unit_cost_usd numeric(18, 8) not null default 0,
  allocation_method text not null default 'per_credit' check (allocation_method in ('per_credit', 'monthly_flat', 'manual')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_version_id, component_key)
);

create table if not exists pricing_rates (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references pricing_plan_versions(id) on delete cascade,
  module_id uuid not null references billing_modules(id),
  unit_name text not null,
  cost_per_unit_usd numeric(18, 8) not null default 0,
  markup_rate numeric(8, 4) not null default 0.5,
  price_per_unit_usd numeric(18, 8) not null default 0,
  minimum_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_version_id, module_id, unit_name)
);

create table if not exists organization_billing_profiles (
  organization_id uuid primary key references organizations(id) on delete cascade,
  plan_version_id uuid not null references pricing_plan_versions(id),
  billing_status text not null default 'active' check (billing_status in ('active', 'paused', 'manual_review', 'disabled')),
  invoice_terms text not null default 'due_on_receipt',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists module_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references app_users(id),
  session_id uuid references prompt_sessions(id),
  prompt_log_id uuid references prompt_logs(id),
  module_id uuid not null references billing_modules(id),
  pricing_rate_id uuid references pricing_rates(id),
  conductor_run_id uuid,
  bpmn_process_id text,
  bpmn_activity_id text,
  unit_name text not null,
  unit_count integer not null default 0,
  input_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_per_unit_usd numeric(18, 8) not null default 0,
  price_per_unit_usd numeric(18, 8) not null default 0,
  markup_rate numeric(8, 4) not null default 0.5,
  cost_cents integer not null default 0,
  amount_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (prompt_log_id, module_id, unit_name, bpmn_activity_id)
);

create index if not exists idx_module_usage_org_period
  on module_usage_events (organization_id, occurred_at desc);

create index if not exists idx_module_usage_user_period
  on module_usage_events (user_id, occurred_at desc);

alter table invoices
  add column if not exists plan_version_id uuid references pricing_plan_versions(id),
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;

alter table invoice_line_items
  add column if not exists module_id uuid references billing_modules(id),
  add column if not exists pricing_rate_id uuid references pricing_rates(id),
  add column if not exists unit_name text not null default 'credit',
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;

insert into billing_modules (module_key, name, description, module_type, default_unit_name, metadata)
values
  ('prompt_workflow', 'Prompt Workflow Conductor', 'Base conductor orchestration request for a prompt workflow.', 'conductor', 'request', '{"bpmnReady": true}'::jsonb),
  ('claude_completion', 'Claude Completion', 'Model token usage for Claude prompt completion.', 'model', 'credit', '{"creditSource": "tokens"}'::jsonb),
  ('web_search', 'Web Search Tool', 'External web-search tool calls made during prompt augmentation.', 'tool', 'request', '{"bpmnReady": true}'::jsonb),
  ('rag_context', 'RAG Context Augmentation', 'Client-specific retrieval and context augmentation module.', 'rag', 'credit', '{"bpmnReady": true, "clientConfigurable": true}'::jsonb),
  ('local_response_cache', 'Local Response Cache', 'Local cache hit handling for repeated prompts.', 'platform', 'request', '{"billableDefault": false}'::jsonb)
on conflict (module_key) do update
set name = excluded.name,
    description = excluded.description,
    module_type = excluded.module_type,
    default_unit_name = excluded.default_unit_name,
    metadata = billing_modules.metadata || excluded.metadata,
    updated_at = now();

insert into pricing_plans (plan_key, name, status, currency, default_markup_rate, metadata)
values (
  'production-standard',
  'Production Standard',
  'active',
  'USD',
  0.5,
  '{"description": "Default production pricing with API, hosting, operations, and engineering cost components."}'::jsonb
)
on conflict (plan_key) do update
set name = excluded.name,
    status = excluded.status,
    currency = excluded.currency,
    default_markup_rate = excluded.default_markup_rate,
    metadata = pricing_plans.metadata || excluded.metadata,
    updated_at = now();

insert into pricing_plan_versions (plan_id, version, status, effective_at, metadata)
select id, 1, 'active', now(), '{"seeded": true}'::jsonb
from pricing_plans
where plan_key = 'production-standard'
on conflict (plan_id, version) do update
set status = excluded.status,
    metadata = pricing_plan_versions.metadata || excluded.metadata;

with active_version as (
  select ppv.id
  from pricing_plan_versions ppv
  join pricing_plans pp on pp.id = ppv.plan_id
  where pp.plan_key = 'production-standard' and ppv.version = 1
)
insert into pricing_cost_components (
  plan_version_id,
  component_key,
  name,
  category,
  monthly_cost_cents,
  unit_cost_usd,
  allocation_method,
  metadata
)
select id, component_key, name, category, monthly_cost_cents, unit_cost_usd, allocation_method, metadata
from active_version
cross join (
  values
    ('api-credit-cost', 'API usage cost per credit', 'api_usage', 0, 0.000001::numeric, 'per_credit', '{"notes": "Provider token cost normalized to one internal credit."}'::jsonb),
    ('hosting-allocation', 'Hosting allocation', 'hosting', 25000, 0.00000020::numeric, 'per_credit', '{"notes": "Blended hosting allocation for persistent app, database, and identity services."}'::jsonb),
    ('operations-allocation', 'Operations allocation', 'operations', 15000, 0.00000015::numeric, 'per_credit', '{"notes": "Monitoring, incident response, and administrative operations."}'::jsonb),
    ('engineering-allocation', 'Engineering allocation', 'engineering', 50000, 0.00000040::numeric, 'per_credit', '{"notes": "Ongoing module integration and maintenance allocation."}'::jsonb)
) as component(component_key, name, category, monthly_cost_cents, unit_cost_usd, allocation_method, metadata)
on conflict (plan_version_id, component_key) do update
set name = excluded.name,
    category = excluded.category,
    monthly_cost_cents = excluded.monthly_cost_cents,
    unit_cost_usd = excluded.unit_cost_usd,
    allocation_method = excluded.allocation_method,
    metadata = pricing_cost_components.metadata || excluded.metadata;

with active_version as (
  select ppv.id as plan_version_id
  from pricing_plan_versions ppv
  join pricing_plans pp on pp.id = ppv.plan_id
  where pp.plan_key = 'production-standard' and ppv.version = 1
),
rate_seed as (
  select *
  from (
    values
      ('prompt_workflow', 'request', 0.000100::numeric, 0.5::numeric, '{"costBasis": "Conductor request overhead."}'::jsonb),
      ('claude_completion', 'credit', 0.00000175::numeric, 0.5::numeric, '{"costBasis": "API plus hosting, operations, and engineering per-credit allocation."}'::jsonb),
      ('web_search', 'request', 0.001000::numeric, 0.5::numeric, '{"costBasis": "Tool request with operations overhead."}'::jsonb),
      ('rag_context', 'credit', 0.00000225::numeric, 0.5::numeric, '{"costBasis": "Retrieval, vector storage, hosting, operations, and engineering per-credit allocation."}'::jsonb),
      ('local_response_cache', 'request', 0.000000::numeric, 0.0::numeric, '{"costBasis": "Cache hits are tracked for reporting but zero-rated by default."}'::jsonb)
  ) as seed(module_key, unit_name, cost_per_unit_usd, markup_rate, metadata)
)
insert into pricing_rates (
  plan_version_id,
  module_id,
  unit_name,
  cost_per_unit_usd,
  markup_rate,
  price_per_unit_usd,
  metadata
)
select
  active_version.plan_version_id,
  billing_modules.id,
  rate_seed.unit_name,
  rate_seed.cost_per_unit_usd,
  rate_seed.markup_rate,
  round((rate_seed.cost_per_unit_usd * (1 + rate_seed.markup_rate))::numeric, 8),
  rate_seed.metadata
from active_version
join rate_seed on true
join billing_modules on billing_modules.module_key = rate_seed.module_key
on conflict (plan_version_id, module_id, unit_name) do update
set cost_per_unit_usd = excluded.cost_per_unit_usd,
    markup_rate = excluded.markup_rate,
    price_per_unit_usd = excluded.price_per_unit_usd,
    metadata = pricing_rates.metadata || excluded.metadata;

insert into organization_billing_profiles (organization_id, plan_version_id)
select organizations.id, pricing_plan_versions.id
from organizations
cross join pricing_plan_versions
join pricing_plans on pricing_plans.id = pricing_plan_versions.plan_id
where pricing_plans.plan_key = 'production-standard'
  and pricing_plan_versions.version = 1
on conflict (organization_id) do nothing;

insert into module_usage_events (
  organization_id,
  user_id,
  session_id,
  prompt_log_id,
  module_id,
  pricing_rate_id,
  bpmn_process_id,
  bpmn_activity_id,
  unit_name,
  unit_count,
  input_tokens,
  cache_creation_input_tokens,
  cache_read_input_tokens,
  output_tokens,
  total_tokens,
  cost_per_unit_usd,
  price_per_unit_usd,
  markup_rate,
  cost_cents,
  amount_cents,
  metadata,
  occurred_at
)
select
  pl.organization_id,
  pl.user_id,
  pl.session_id,
  pl.id,
  bm.id,
  pr.id,
  'prompt-workflow',
  'claude-completion',
  pr.unit_name,
  (
    coalesce(pl.input_tokens, 0) +
    coalesce(pl.cache_creation_input_tokens, 0) +
    coalesce(pl.cache_read_input_tokens, 0) +
    coalesce(pl.output_tokens, 0)
  )::int,
  coalesce(pl.input_tokens, 0)::int,
  coalesce(pl.cache_creation_input_tokens, 0)::int,
  coalesce(pl.cache_read_input_tokens, 0)::int,
  coalesce(pl.output_tokens, 0)::int,
  (
    coalesce(pl.input_tokens, 0) +
    coalesce(pl.cache_creation_input_tokens, 0) +
    coalesce(pl.cache_read_input_tokens, 0) +
    coalesce(pl.output_tokens, 0)
  )::int,
  pr.cost_per_unit_usd,
  pr.price_per_unit_usd,
  pr.markup_rate,
  round((
    coalesce(pl.input_tokens, 0) +
    coalesce(pl.cache_creation_input_tokens, 0) +
    coalesce(pl.cache_read_input_tokens, 0) +
    coalesce(pl.output_tokens, 0)
  ) * pr.cost_per_unit_usd * 100)::int,
  round((
    coalesce(pl.input_tokens, 0) +
    coalesce(pl.cache_creation_input_tokens, 0) +
    coalesce(pl.cache_read_input_tokens, 0) +
    coalesce(pl.output_tokens, 0)
  ) * pr.price_per_unit_usd * 100)::int,
  '{"backfilled": true}'::jsonb,
  pl.created_at
from prompt_logs pl
join billing_modules bm on bm.module_key = 'claude_completion'
join organization_billing_profiles obp on obp.organization_id = pl.organization_id
join pricing_rates pr on pr.plan_version_id = obp.plan_version_id
  and pr.module_id = bm.id
  and pr.unit_name = 'credit'
where pl.organization_id is not null
  and pl.user_id is not null
  and pl.status = 'succeeded'
  and (
    coalesce(pl.input_tokens, 0) +
    coalesce(pl.cache_creation_input_tokens, 0) +
    coalesce(pl.cache_read_input_tokens, 0) +
    coalesce(pl.output_tokens, 0)
  ) > 0
on conflict (prompt_log_id, module_id, unit_name, bpmn_activity_id) do nothing;
