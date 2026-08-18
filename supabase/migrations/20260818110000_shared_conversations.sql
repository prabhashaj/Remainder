-- Shared conversations (ChatGPT-style conversation sharing)
-- Stores snapshots of chat threads so users can share a public link with anyone.

create table if not exists public.shared_conversations (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null default encode(gen_random_bytes(16), 'base64url'),
  thread_id    uuid not null references public.chat_threads(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Shared Conversation',
  messages     jsonb not null default '[]'::jsonb,
  is_anonymous boolean not null default false,
  user_name    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for fast lookup by token and by thread_id
create index if not exists idx_shared_conversations_token on public.shared_conversations(token);
create index if not exists idx_shared_conversations_thread_id on public.shared_conversations(thread_id);

comment on table public.shared_conversations is
  'Public snapshots of conversations shared via link. Anyone with the token can view.';

-- Enable Row Level Security (RLS)
alter table public.shared_conversations enable row level security;

-- Policy 1: Anyone (anon + authenticated) can view shared conversations by token
create policy "Anyone can read shared conversations by token"
  on public.shared_conversations for select
  using (true);

-- Policy 2: Authenticated users can insert their own shares
create policy "Authenticated users can create shared conversations"
  on public.shared_conversations for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy 3: Users can update their own shared conversations
create policy "Users can update their own shared conversations"
  on public.shared_conversations for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy 4: Users can delete their own shared conversations
create policy "Users can delete their own shared conversations"
  on public.shared_conversations for delete
  to authenticated
  using (auth.uid() = user_id);
