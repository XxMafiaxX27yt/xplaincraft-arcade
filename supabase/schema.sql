-- XplainCraft Arcade - online database (Supabase / Postgres).
-- Run the whole file in the Supabase SQL editor. Safe to run again (it drops + recreates the functions,
-- tables are only created if missing).
--
-- Model: the arcade logic runs in the browser (same code as the this-device backend). The server keeps
-- the data, decides who may read/write what (row level security), and guards the parts that matter:
-- operator/ban flags, usernames, coin/XP jumps, operator-only actions.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  bio text not null default '',
  xp bigint not null default 0,
  equipped jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  owned_count int not null default 0,
  coins_earned bigint not null default 0,
  achievements int not null default 0,
  operator boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index if not exists players_username_lower on public.players (lower(username));
create index if not exists players_xp on public.players (xp desc);

create table if not exists public.player_state (
  id uuid primary key references public.players(id) on delete cascade,
  state jsonb not null,
  coins bigint not null default 0,
  login_email text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.scores (
  game text not null,
  user_id uuid not null references public.players(id) on delete cascade,
  value double precision not null,
  updated_at timestamptz not null default now(),
  primary key (game, user_id)
);
create index if not exists scores_game_value on public.scores (game, value);

create table if not exists public.friend_requests (
  from_id uuid not null references public.players(id) on delete cascade,
  to_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

create table if not exists public.friends (
  a uuid not null references public.players(id) on delete cascade,
  b uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b)
);

-- gifts (shown in the inbox) and operator changes (applied automatically) waiting for a player
create table if not exists public.patches (
  id uuid primary key default gen_random_uuid(),
  to_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('gift', 'op')),
  data jsonb not null default '{}'::jsonb,
  from_name text,
  msg text not null default '',
  coins bigint not null default 0,
  xp bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists patches_to on public.patches (to_id);

create table if not exists public.arcade_config (
  id int primary key default 1 check (id = 1),
  custom_events jsonb not null default '[]'::jsonb,
  overrides jsonb not null default '{}'::jsonb
);
insert into public.arcade_config (id) values (1) on conflict do nothing;

create table if not exists public.op_log (
  id bigserial primary key,
  ts timestamptz not null default now(),
  by_name text,
  msg text
);

-- multiplayer rooms (the live game traffic goes over Realtime channels; this is the room list)
create table if not exists public.rooms (
  code text primary key,
  host_id uuid not null references public.players(id) on delete cascade,
  game text,
  kind text not null default 'party' check (kind in ('party', 'game')),
  public boolean not null default false,
  state text not null default 'open',
  players int not null default 1,
  max_players int not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row level security
alter table public.players enable row level security;
alter table public.player_state enable row level security;
alter table public.scores enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;
alter table public.patches enable row level security;
alter table public.arcade_config enable row level security;
alter table public.op_log enable row level security;
alter table public.rooms enable row level security;

create or replace function public.is_op() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select operator from public.players where id = auth.uid()), false);
$$;

drop policy if exists players_read on public.players;
create policy players_read on public.players for select using (not banned or id = auth.uid() or public.is_op());

drop policy if exists state_read on public.player_state;
create policy state_read on public.player_state for select using (id = auth.uid());

drop policy if exists scores_read on public.scores;
create policy scores_read on public.scores for select using (true);
drop policy if exists scores_write on public.scores;
create policy scores_write on public.scores for insert with check (user_id = auth.uid());
drop policy if exists scores_update on public.scores;
create policy scores_update on public.scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists fr_read on public.friend_requests;
create policy fr_read on public.friend_requests for select using (auth.uid() in (from_id, to_id));
drop policy if exists fr_insert on public.friend_requests;
create policy fr_insert on public.friend_requests for insert with check (from_id = auth.uid());
drop policy if exists fr_delete on public.friend_requests;
create policy fr_delete on public.friend_requests for delete using (auth.uid() in (from_id, to_id));

drop policy if exists friends_read on public.friends;
create policy friends_read on public.friends for select using (true);

drop policy if exists patches_read on public.patches;
create policy patches_read on public.patches for select using (to_id = auth.uid());

drop policy if exists config_read on public.arcade_config;
create policy config_read on public.arcade_config for select using (true);

drop policy if exists oplog_read on public.op_log;
create policy oplog_read on public.op_log for select using (public.is_op());

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select using (true);
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert with check (host_id = auth.uid());
drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms for update using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms for delete using (host_id = auth.uid());

-- ---------------------------------------------------------------- account functions
create or replace function public.login_email(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select s.login_email from public.players p join public.player_state s on s.id = p.id
  where lower(p.username) = lower(trim(p_username));
$$;

create or replace function public.create_player(p_username text, p_email text, p_state jsonb, p_profile jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  p_username := trim(p_username);
  if p_username !~ '^[A-Za-z0-9_\-]{3,16}$' then raise exception 'Callsign must be 3-16 letters, numbers, _ or -'; end if;
  if exists (select 1 from public.players where lower(username) = lower(p_username) and id <> uid) then
    raise exception 'That callsign is taken';
  end if;
  insert into public.players (id, username, xp, equipped, stats, owned_count)
  values (uid, p_username, 0, coalesce(p_profile->'equipped', '{}'::jsonb), coalesce(p_profile->'stats', '{}'::jsonb),
          coalesce((p_profile->>'owned_count')::int, 0))
  on conflict (id) do nothing;
  insert into public.player_state (id, state, coins, login_email)
  values (uid, p_state, coalesce((p_state->>'coins')::bigint, 0), p_email)
  on conflict (id) do nothing;
end $$;

create or replace function public.save_me(p_profile jsonb, p_state jsonb, p_consumed uuid[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pl public.players%rowtype;
  old_coins bigint;
  new_coins bigint;
  new_xp bigint;
  allow_c bigint := 0;
  allow_x bigint := 0;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  select * into pl from public.players where id = uid for update;
  if not found then raise exception 'No player for this login'; end if;
  if pl.banned then raise exception 'This account is banned by an operator'; end if;
  select coins into old_coins from public.player_state where id = uid for update;
  if p_consumed is not null and coalesce(array_length(p_consumed, 1), 0) > 0 then
    select coalesce(sum(greatest(coins, 0)), 0), coalesce(sum(greatest(xp, 0)), 0) into allow_c, allow_x
      from public.patches where to_id = uid and id = any(p_consumed);
    delete from public.patches where to_id = uid and id = any(p_consumed);
  end if;
  new_coins := coalesce((p_state->>'coins')::bigint, 0);
  new_xp := coalesce((p_profile->>'xp')::bigint, 0);
  if new_coins < 0 or new_xp < 0 then raise exception 'Save rejected (bad numbers)'; end if;
  if not pl.operator then
    if new_coins - old_coins > 40000 + allow_c then raise exception 'Save rejected (coins jumped too much)'; end if;
    if new_xp - pl.xp > 40000 + allow_x then raise exception 'Save rejected (XP jumped too much)'; end if;
  end if;
  p_state := jsonb_set(jsonb_set(p_state, '{operator}', to_jsonb(pl.operator)), '{username}', to_jsonb(pl.username));
  update public.players set
    bio = left(coalesce(p_profile->>'bio', ''), 160),
    xp = new_xp,
    equipped = coalesce(p_profile->'equipped', '{}'::jsonb),
    stats = coalesce(p_profile->'stats', '{}'::jsonb),
    owned_count = coalesce((p_profile->>'owned_count')::int, 0),
    coins_earned = coalesce((p_profile->>'coins_earned')::bigint, 0),
    achievements = coalesce((p_profile->>'achievements')::int, 0),
    last_seen = now()
  where id = uid;
  update public.player_state set state = p_state, coins = new_coins, updated_at = now() where id = uid;
end $$;

create or replace function public.touch_me() returns void
language sql security definer set search_path = public as $$
  update public.players set last_seen = now() where id = auth.uid();
$$;

create or replace function public.rename_me(p_username text) returns void
language plpgsql security definer set search_path = public as $$
begin
  p_username := trim(p_username);
  if p_username !~ '^[A-Za-z0-9_\-]{3,16}$' then raise exception 'Callsign must be 3-16 letters, numbers, _ or -'; end if;
  if exists (select 1 from public.players where lower(username) = lower(p_username) and id <> auth.uid()) then
    raise exception 'That callsign is taken';
  end if;
  update public.players set username = p_username where id = auth.uid();
  update public.player_state set state = jsonb_set(state, '{username}', to_jsonb(p_username)) where id = auth.uid();
end $$;

create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------- friends
create or replace function public.accept_friend(p_from uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from public.friend_requests where from_id = p_from and to_id = uid) then
    raise exception 'No request from that player';
  end if;
  delete from public.friend_requests where (from_id = p_from and to_id = uid) or (from_id = uid and to_id = p_from);
  insert into public.friends (a, b) values (uid, p_from), (p_from, uid) on conflict do nothing;
end $$;

create or replace function public.remove_friend(p_other uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friends where (a = auth.uid() and b = p_other) or (a = p_other and b = auth.uid());
$$;

-- ---------------------------------------------------------------- operator
create or replace function public.become_operator(p_code text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare me_name text;
begin
  if auth.uid() is null then return false; end if;
  if encode(extensions.digest('xc-op::' || upper(coalesce(p_code, '')), 'sha256'), 'hex')
     <> '81a76637a812726afb76119db07377500ff37f16de60030bcbfb2a177302bd01' then
    return false;
  end if;
  update public.players set operator = true where id = auth.uid() returning username into me_name;
  update public.player_state set state = jsonb_set(state, '{operator}', 'true'::jsonb) where id = auth.uid();
  insert into public.op_log (by_name, msg) values (me_name, 'entered operator mode');
  return true;
end $$;

create or replace function public.op_leave() returns void
language plpgsql security definer set search_path = public as $$
declare me_name text;
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  update public.players set operator = false where id = auth.uid() returning username into me_name;
  update public.player_state set state = jsonb_set(state, '{operator}', 'false'::jsonb) where id = auth.uid();
  insert into public.op_log (by_name, msg) values (me_name, 'left operator mode');
end $$;

create or replace function public.op_add_log(p_msg text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  insert into public.op_log (by_name, msg) select username, left(p_msg, 300) from public.players where id = auth.uid();
end $$;

create or replace function public.op_players() returns table (
  username text, equipped jsonb, xp bigint, coins bigint, owned int, operator boolean, banned boolean,
  created_at timestamptz, last_seen timestamptz, pass jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  return query select p.username, p.equipped, p.xp, s.coins, p.owned_count, p.operator, p.banned, p.created_at, p.last_seen, s.state->'pass'
    from public.players p join public.player_state s on s.id = p.id order by p.last_seen desc;
end $$;

-- send a gift / operator change to one player ('*' = everyone)
create or replace function public.op_send(p_who text, p_kind text, p_data jsonb, p_msg text, p_coins bigint, p_xp bigint, p_log text)
returns int language plpgsql security definer set search_path = public as $$
declare me_name text; n int;
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  select username into me_name from public.players where id = auth.uid();
  if p_who <> '*' and not exists (select 1 from public.players where lower(username) = lower(p_who)) then
    raise exception 'No player called "%"', p_who;
  end if;
  insert into public.patches (to_id, kind, data, from_name, msg, coins, xp)
    select id, p_kind, coalesce(p_data, '{}'::jsonb), me_name, left(coalesce(p_msg, ''), 140), coalesce(p_coins, 0), coalesce(p_xp, 0)
    from public.players where p_who = '*' or lower(username) = lower(p_who);
  get diagnostics n = row_count;
  if p_log is not null then insert into public.op_log (by_name, msg) values (me_name, left(p_log, 300)); end if;
  return n;
end $$;

create or replace function public.op_set_flag(p_who text, p_flag text, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me_name text; tid uuid;
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  select username into me_name from public.players where id = auth.uid();
  select id into tid from public.players where lower(username) = lower(p_who);
  if tid is null then raise exception 'No player called "%"', p_who; end if;
  if tid = auth.uid() then raise exception 'Not on yourself'; end if;
  if p_flag = 'operator' then
    update public.players set operator = p_value where id = tid;
    update public.player_state set state = jsonb_set(state, '{operator}', to_jsonb(p_value)) where id = tid;
  elsif p_flag = 'banned' then
    update public.players set banned = p_value where id = tid;
  else
    raise exception 'Unknown flag';
  end if;
  insert into public.op_log (by_name, msg) values (me_name, (case when p_value then 'set ' else 'cleared ' end) || p_flag || ' on ' || p_who);
end $$;

create or replace function public.op_delete(p_who text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare me_name text; tid uuid;
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  select username into me_name from public.players where id = auth.uid();
  select id into tid from public.players where lower(username) = lower(p_who);
  if tid is null then raise exception 'No player called "%"', p_who; end if;
  if tid = auth.uid() then raise exception 'You can''t delete yourself here'; end if;
  delete from auth.users where id = tid;
  insert into public.op_log (by_name, msg) values (me_name, 'deleted player ' || p_who);
end $$;

create or replace function public.op_config(p_custom jsonb, p_overrides jsonb, p_log text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_op() then raise exception 'Operator only'; end if;
  update public.arcade_config set custom_events = coalesce(p_custom, custom_events), overrides = coalesce(p_overrides, overrides) where id = 1;
  if p_log is not null then insert into public.op_log (by_name, msg) select username, left(p_log, 300) from public.players where id = auth.uid(); end if;
end $$;

-- ---------------------------------------------------------------- grants
revoke all on all functions in schema public from public, anon;
grant execute on function public.login_email(text) to anon, authenticated;
grant execute on function public.is_op() to anon, authenticated;
grant execute on function public.create_player(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_me(jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.touch_me() to authenticated;
grant execute on function public.rename_me(text) to authenticated;
grant execute on function public.delete_me() to authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.become_operator(text) to authenticated;
grant execute on function public.op_leave() to authenticated;
grant execute on function public.op_add_log(text) to authenticated;
grant execute on function public.op_players() to authenticated;
grant execute on function public.op_send(text, text, jsonb, text, bigint, bigint, text) to authenticated;
grant execute on function public.op_set_flag(text, text, boolean) to authenticated;
grant execute on function public.op_delete(text) to authenticated;
grant execute on function public.op_config(jsonb, jsonb, text) to authenticated;
