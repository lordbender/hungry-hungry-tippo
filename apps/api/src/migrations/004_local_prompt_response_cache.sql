create table if not exists prompt_response_cache (
  cache_key text primary key,
  model text not null,
  prompt text not null,
  augmentation_mode text not null,
  response text not null,
  workflow jsonb not null,
  usage jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_prompt_response_cache_expires_at
  on prompt_response_cache (expires_at);
