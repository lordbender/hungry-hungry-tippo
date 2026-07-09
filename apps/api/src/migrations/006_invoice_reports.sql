create table if not exists invoice_reports (
  invoice_id uuid primary key references invoices(id) on delete cascade,
  filename text not null,
  content_type text not null default 'application/pdf',
  content bytea not null,
  generated_at timestamptz not null default now()
);
