create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists prompt_logs (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  response text,
  model text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prompt_logs_created_at on prompt_logs (created_at desc);
create index if not exists idx_prompt_logs_status on prompt_logs (status);

create table if not exists rag_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_uri text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references rag_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists idx_rag_chunks_document_id on rag_chunks (document_id);
