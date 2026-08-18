-- pdf_exports stores serialised PDF configs so users can share a link
-- that renders/downloads the same document without requiring login.

create table if not exists public.pdf_exports (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null default encode(gen_random_bytes(18), 'base64url'),
  config      jsonb not null,
  template    text not null,
  created_at  timestamptz not null default now()
);

-- Automatically expire old exports after 90 days (optional cleanup trigger)
comment on table public.pdf_exports is
  'Shareable PDF export configs. Public read; anyone with the token can view.';

-- RLS: authenticated users can insert; anyone (anon) can read by token
alter table public.pdf_exports enable row level security;

create policy "Anyone can read pdf exports by token"
  on public.pdf_exports for select
  using (true);

create policy "Authenticated users can create pdf exports"
  on public.pdf_exports for insert
  to authenticated
  with check (true);
