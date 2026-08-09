-- ============================================================
-- Migration: Background Jobs table
-- ============================================================

create table if not exists public.background_jobs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  job_type      text        not null,
  resource_id   text,
  status        text        not null default 'pending'
    constraint background_jobs_status_check check (status in ('pending', 'running', 'done', 'failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

alter table public.background_jobs enable row level security;

create policy "Users manage own background_jobs"
  on public.background_jobs for all
  using (auth.uid() = user_id);

create index idx_background_jobs_user
  on public.background_jobs (user_id, created_at desc);

grant all on public.background_jobs to authenticated;
