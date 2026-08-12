-- Migration: Focus Session Integrity
alter table public.focus_sessions
  add column if not exists counted_minutes integer;

-- For existing records, assume they were perfectly focused to avoid losing historical stats
update public.focus_sessions
set counted_minutes = minutes
where counted_minutes is null;
