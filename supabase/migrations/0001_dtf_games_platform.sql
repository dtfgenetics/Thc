-- DTF Games Platform Supabase Schema
-- Supports High Land multiplayer, invite links, player names, saved state, game content, assets, and Codex task tracking.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  slug text not null unique,
  game_type text not null,
  status text not null default 'planning',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  room_code text not null unique,
  host_user_id uuid,
  status text not null default 'waiting',
  max_players int not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.game_rooms(id) on delete cascade,
  player_name text not null,
  user_id uuid,
  turn_order int,
  current_position int default 0,
  is_host boolean default false,
  joined_at timestamptz not null default now()
);

create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.game_rooms(id) on delete cascade,
  invite_code text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.game_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.game_rooms(id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  asset_type text not null,
  title text not null,
  drive_url text,
  github_path text,
  status text not null default 'needs_review',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  card_type text not null,
  title text,
  category text,
  effect_text text,
  data jsonb default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  category text not null,
  difficulty text not null,
  question text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct_choice text not null check (correct_choice in ('A','B','C','D')),
  explanation text,
  source_url text,
  status text not null default 'needs_fact_check',
  created_at timestamptz not null default now()
);

create table if not exists public.board_spaces (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  space_index int not null,
  space_type text not null,
  label text,
  color text,
  effect jsonb default '{}'::jsonb,
  orientation text,
  created_at timestamptz not null default now(),
  unique(game_id, space_index)
);

create table if not exists public.codex_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  title text not null,
  priority text not null default 'medium',
  status text not null default 'todo',
  prompt text not null,
  result_notes text,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.games enable row level security;
alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;
alter table public.game_invites enable row level security;
alter table public.game_state_snapshots enable row level security;
alter table public.assets enable row level security;
alter table public.cards enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.board_spaces enable row level security;
alter table public.codex_tasks enable row level security;

create policy "public read projects" on public.projects for select using (true);
create policy "public read games" on public.games for select using (true);
create policy "public read approved cards" on public.cards for select using (status in ('approved','published'));
create policy "public read approved trivia" on public.trivia_questions for select using (status in ('approved','published'));
create policy "public read board spaces" on public.board_spaces for select using (true);

-- Temporary early-build room policies. Tighten before public launch.
create policy "public create rooms" on public.game_rooms for insert with check (true);
create policy "public read rooms" on public.game_rooms for select using (true);
create policy "public update rooms" on public.game_rooms for update using (true);
create policy "public join rooms" on public.game_players for insert with check (true);
create policy "public read players" on public.game_players for select using (true);
create policy "public update players" on public.game_players for update using (true);
create policy "public create invites" on public.game_invites for insert with check (true);
create policy "public read invites" on public.game_invites for select using (true);
create policy "public create snapshots" on public.game_state_snapshots for insert with check (true);
create policy "public read snapshots" on public.game_state_snapshots for select using (true);
