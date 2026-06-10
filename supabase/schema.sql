create extension if not exists "uuid-ossp";

-- WARNING: This reset script deletes the tournament data and rebuilds the structure.
drop view if exists public.leaderboard;

drop table if exists public.point_events;
drop table if exists public.game_rounds;
drop table if exists public.games;
drop table if exists public.players;

create table public.players (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  pin text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table public.games (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  created_at timestamptz default now()
);

create table public.game_rounds (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid references public.games(id) on delete cascade,
  round_number int not null,
  place_1_points int not null default 100,
  place_2_points int not null default 80,
  place_3_points int not null default 60,
  place_4_points int not null default 50,
  place_5_points int not null default 40,
  place_6_points int not null default 30,
  place_7_points int not null default 20,
  place_8_points int not null default 10,
  created_at timestamptz default now(),
  unique(game_id, round_number)
);

create table public.point_events (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references public.players(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  game_round_id uuid references public.game_rounds(id) on delete set null,
  round_number int,
  type text not null check (type in ('game','achievement','steps','heart_rate','bonus','penalty')),
  title text not null,
  points int not null,
  note text,
  created_at timestamptz default now()
);

create or replace view public.leaderboard as
select
  p.id,
  p.name,
  p.pin,
  p.avatar_url,
  coalesce(sum(e.points), 0)::int as total_points,
  coalesce(sum(case when e.type = 'game' then e.points else 0 end), 0)::int as game_points,
  coalesce(sum(case when e.type = 'achievement' then e.points else 0 end), 0)::int as achievement_points,
  coalesce(sum(case when e.type = 'steps' then e.points else 0 end), 0)::int as steps_points,
  coalesce(sum(case when e.type = 'heart_rate' then e.points else 0 end), 0)::int as heart_rate_points,
  coalesce(sum(case when e.type in ('bonus','penalty') then e.points else 0 end), 0)::int as bonus_points
from public.players p
left join public.point_events e on e.player_id = p.id
group by p.id, p.name, p.pin, p.avatar_url
order by total_points desc;

alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_rounds enable row level security;
alter table public.point_events enable row level security;

drop policy if exists "public read players" on public.players;
drop policy if exists "public insert players" on public.players;
drop policy if exists "public update players" on public.players;
drop policy if exists "public delete players" on public.players;

drop policy if exists "public read games" on public.games;
drop policy if exists "public insert games" on public.games;
drop policy if exists "public update games" on public.games;
drop policy if exists "public delete games" on public.games;

drop policy if exists "public read game rounds" on public.game_rounds;
drop policy if exists "public insert game rounds" on public.game_rounds;
drop policy if exists "public update game rounds" on public.game_rounds;
drop policy if exists "public delete game rounds" on public.game_rounds;

drop policy if exists "public read point events" on public.point_events;
drop policy if exists "public insert point events" on public.point_events;
drop policy if exists "public update point events" on public.point_events;
drop policy if exists "public delete point events" on public.point_events;

-- MVP policies: open read/write through the app. Tighten these before production.
create policy "public read players" on public.players for select using (true);
create policy "public insert players" on public.players for insert with check (true);
create policy "public update players" on public.players for update using (true) with check (true);
create policy "public delete players" on public.players for delete using (true);

create policy "public read games" on public.games for select using (true);
create policy "public insert games" on public.games for insert with check (true);
create policy "public update games" on public.games for update using (true) with check (true);
create policy "public delete games" on public.games for delete using (true);

create policy "public read game rounds" on public.game_rounds for select using (true);
create policy "public insert game rounds" on public.game_rounds for insert with check (true);
create policy "public update game rounds" on public.game_rounds for update using (true) with check (true);
create policy "public delete game rounds" on public.game_rounds for delete using (true);

create policy "public read point events" on public.point_events for select using (true);
create policy "public insert point events" on public.point_events for insert with check (true);
create policy "public update point events" on public.point_events for update using (true) with check (true);
create policy "public delete point events" on public.point_events for delete using (true);

-- Public storage bucket for participant profile photos.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "public read avatars" on storage.objects;
drop policy if exists "public upload avatars" on storage.objects;
drop policy if exists "public update avatars" on storage.objects;
drop policy if exists "public delete avatars" on storage.objects;

create policy "public read avatars" on storage.objects
for select using (bucket_id = 'avatars');

create policy "public upload avatars" on storage.objects
for insert with check (bucket_id = 'avatars');

create policy "public update avatars" on storage.objects
for update using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

create policy "public delete avatars" on storage.objects
for delete using (bucket_id = 'avatars');

do $$
begin
  begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.games; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game_rounds; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.point_events; exception when duplicate_object then null; end;
end $$;
