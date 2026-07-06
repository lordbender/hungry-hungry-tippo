alter table prompt_logs
  add column if not exists cache_creation_input_tokens integer,
  add column if not exists cache_read_input_tokens integer;
