-- ============================================================
-- Migration: Agent Actions audit table
-- ============================================================

create table if not exists public.agent_actions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  trace_id      text        not null,
  thread_id     text,
  tool_name     text        not null,
  input         jsonb       not null default '{}'::jsonb,
  output        jsonb,
  status        text        not null default 'success'
    constraint agent_actions_status_check check (status in ('success', 'error')),
  error_message text,
  duration_ms   integer     not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.agent_actions enable row level security;

create policy "Users manage own agent_actions"
  on public.agent_actions for all
  using (auth.uid() = user_id);

create index idx_agent_actions_user_created
  on public.agent_actions (user_id, created_at desc);

create index idx_agent_actions_trace
  on public.agent_actions (trace_id);

grant all on public.agent_actions to authenticated;
