alter table invoices
  add column if not exists subtotal_credits integer not null default 0,
  add column if not exists cost_per_credit_usd numeric(18, 8) not null default 0,
  add column if not exists price_per_credit_usd numeric(18, 8) not null default 0,
  add column if not exists markup_rate numeric(8, 4) not null default 0.5,
  add column if not exists cost_cents integer not null default 0;

alter table invoice_line_items
  add column if not exists user_id uuid references app_users(id),
  add column if not exists credit_count integer not null default 0,
  add column if not exists cost_per_credit_usd numeric(18, 8) not null default 0,
  add column if not exists price_per_credit_usd numeric(18, 8) not null default 0,
  add column if not exists markup_rate numeric(8, 4) not null default 0.5,
  add column if not exists cost_cents integer not null default 0;

update invoices
set subtotal_credits = subtotal_tokens
where subtotal_credits = 0 and subtotal_tokens > 0;

update invoice_line_items
set credit_count = total_tokens
where credit_count = 0 and total_tokens > 0;
