alter table prompt_logs
  add column if not exists augmented_prompt text;

create unique index if not exists idx_rag_documents_source_uri_unique
  on rag_documents (source_uri)
  where source_uri is not null;

create index if not exists idx_rag_documents_source_uri
  on rag_documents (source_uri);
