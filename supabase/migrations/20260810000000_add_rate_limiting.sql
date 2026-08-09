create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  created_at timestamp with time zone default now() not null
);

-- Index for sliding window queries
create index idx_rate_limit_events_lookup on public.rate_limit_events (user_id, event_type, created_at);

alter table public.rate_limit_events enable row level security;

-- Only users can insert their own events and read their own events
create policy "Users can insert their own rate limit events"
  on public.rate_limit_events for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own rate limit events"
  on public.rate_limit_events for select
  using (auth.uid() = user_id);
