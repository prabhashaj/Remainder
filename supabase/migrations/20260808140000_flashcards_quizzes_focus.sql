-- ============================================================
-- Migration: Flashcards, Quizzes, and Focus Session Enhancements
-- ============================================================

-- 1. Flashcards table (SM-2 Spaced Repetition)
create table if not exists public.flashcards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  roadmap_item_id uuid references public.roadmap_items(id) on delete set null,
  front           text not null,
  back            text not null,
  ease            real not null default 2.5,
  interval_days   integer not null default 0,
  repetitions     integer not null default 0,
  due_date        date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.flashcards enable row level security;

create policy "Users manage own flashcards"
  on public.flashcards for all
  using (auth.uid() = user_id);

-- 2. Quiz attempts table
create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  roadmap_item_id uuid references public.roadmap_items(id) on delete set null,
  questions       jsonb not null default '[]'::jsonb,
  score           real not null default 0,
  total           integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.quiz_attempts enable row level security;

create policy "Users manage own quiz_attempts"
  on public.quiz_attempts for all
  using (auth.uid() = user_id);

-- 3. Focus session enhancements
alter table public.focus_sessions
  add column if not exists intention text,
  add column if not exists reflection text,
  add column if not exists stayed_on_task boolean,
  add column if not exists tab_away_count integer not null default 0,
  add column if not exists tab_away_seconds integer not null default 0,
  add column if not exists session_type text not null default 'single',
  add column if not exists work_minutes integer not null default 25,
  add column if not exists break_minutes integer not null default 5;
