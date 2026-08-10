-- ============================================================
-- Migration: Add MCP Servers support
-- ============================================================

create table if not exists public.mcp_servers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  url                   text not null,
  transport             text not null check (transport in ('sse', 'http')),
  auth_header_encrypted text,
  enabled               boolean not null default true,
  created_at            timestamptz not null default now()
);

alter table public.mcp_servers enable row level security;

create policy "Users manage own mcp_servers"
  on public.mcp_servers for all
  using (auth.uid() = user_id);
