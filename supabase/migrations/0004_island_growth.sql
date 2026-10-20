-- Togethr: grow your island.
-- Focus rounds earn seeds for the room's shared jar; seeds buy things to
-- place on the island. Each focus round has a session id; people "check in"
-- with a goal, and when the round finishes the server awards seeds to
-- everyone who checked in. Afterwards each person says how it went (bonus
-- seeds). All seed changes happen in these functions, never from browsers.
--
-- Safe to run more than once: every step skips or updates what already
-- exists (the SQL Editor has sometimes run only part of a pasted file).

-- ───────────── Seeds and levels ─────────────

alter table public.rooms
  add column if not exists seeds integer not null default 0 check (seeds >= 0),
  add column if not exists seeds_earned integer not null default 0 check (seeds_earned >= 0);

-- Lifetime seeds → island level (1–5). Keep in sync with LEVELS in src/shared/catalog.ts.
create or replace function public.island_level(p_earned integer)
returns integer language sql immutable as $$
  select case
    when p_earned >= 1500 then 5
    when p_earned >= 700 then 4
    when p_earned >= 300 then 3
    when p_earned >= 100 then 2
    else 1 end;
$$;

-- A new id each time a focus round begins, so check-ins belong to one round.
alter table public.timer_state
  add column if not exists session_id uuid not null default gen_random_uuid();

-- ───────────── Catalog ─────────────
-- Keep in sync with CATALOG in src/shared/catalog.ts (npm run smoke:db checks).

create table if not exists public.item_catalog (
  kind       text primary key,
  cost       integer not null check (cost > 0),
  min_level  integer not null check (min_level between 1 and 5)
);

insert into public.item_catalog (kind, cost, min_level) values
  ('flower_patch', 10, 1),
  ('bush', 15, 1),
  ('stepping_stones', 15, 1),
  ('tree', 30, 1),
  ('bench', 40, 2),
  ('lantern', 40, 2),
  ('picnic_blanket', 50, 2),
  ('campfire', 60, 2),
  ('study_desk', 80, 3),
  ('hammock', 120, 3),
  ('pond', 150, 3),
  ('gazebo', 200, 4),
  ('cafe_stall', 250, 4),
  ('cottage', 300, 4)
on conflict (kind) do update set cost = excluded.cost, min_level = excluded.min_level;

-- ───────────── Placed items ─────────────

create table if not exists public.room_items (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  kind        text not null references public.item_catalog (kind),
  x           real not null,
  z           real not null,
  rotation    real not null default 0,
  placed_by   uuid references public.players (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists room_items_room_idx on public.room_items (room_id);

-- ───────────── Check-ins ─────────────

create table if not exists public.session_checkins (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms (id) on delete cascade,
  session_id       uuid not null,
  player_id        uuid not null references public.players (id) on delete cascade,
  goal             text not null check (char_length(goal) between 1 and 120),
  todo_id          uuid references public.todos (id) on delete set null,
  outcome          text check (outcome in ('done', 'partly', 'not')),
  seeds_awarded    integer not null default 0,
  created_at       timestamptz not null default now(),
  unique (session_id, player_id)
);
create index if not exists session_checkins_room_idx on public.session_checkins (room_id, created_at);

-- ───────────── Row-level security ─────────────

alter table public.item_catalog     enable row level security;
alter table public.room_items       enable row level security;
alter table public.session_checkins enable row level security;

drop policy if exists catalog_select on public.item_catalog;
create policy catalog_select on public.item_catalog for select to authenticated using (true);
drop policy if exists items_select on public.room_items;
create policy items_select on public.room_items for select to authenticated
  using (public.is_room_member(room_id));
drop policy if exists checkins_select on public.session_checkins;
create policy checkins_select on public.session_checkins for select to authenticated
  using (public.is_room_member(room_id));

grant select on public.item_catalog, public.room_items, public.session_checkins to authenticated;

-- ───────────── Timer: session ids and seed awards ─────────────

-- Same as 0001, plus: a new session id whenever a focus round is (re)started fresh.
create or replace function public.timer_control(
  p_room uuid,
  p_action text,
  p_focus_ms integer default null,
  p_short_break_ms integer default null,
  p_long_break_ms integer default null
)
returns public.timer_state language plpgsql security definer set search_path = public as $$
declare
  t timer_state;
  next_phase text;
begin
  if not exists (select 1 from rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'only the room owner can control the timer';
  end if;

  select * into t from timer_state where room_id = p_room for update;

  case p_action
    when 'start' then
      if t.status = 'running' then return t; end if;
      t.ends_at := now() + make_interval(secs => coalesce(t.remaining_ms, t.duration_ms) / 1000.0);
      t.remaining_ms := null;
      t.status := 'running';
    when 'pause' then
      if t.status <> 'running' then return t; end if;
      t.remaining_ms := greatest(0, (extract(epoch from (t.ends_at - now())) * 1000)::int);
      t.ends_at := null;
      t.status := 'paused';
    when 'reset' then
      t.status := 'idle';
      t.ends_at := null;
      t.remaining_ms := null;
      t.session_id := gen_random_uuid();
    when 'skip' then
      if t.phase = 'focus' then
        t.cycle_count := t.cycle_count + 1;
        next_phase := case when t.cycle_count % 4 = 0 then 'long_break' else 'short_break' end;
      else
        next_phase := 'focus';
      end if;
      t.phase := next_phase;
      t.duration_ms := case next_phase
        when 'focus' then t.focus_ms
        when 'short_break' then t.short_break_ms
        else t.long_break_ms end;
      t.status := 'idle';
      t.ends_at := null;
      t.remaining_ms := null;
      t.session_id := gen_random_uuid();
    when 'configure' then
      t.focus_ms := coalesce(p_focus_ms, t.focus_ms);
      t.short_break_ms := coalesce(p_short_break_ms, t.short_break_ms);
      t.long_break_ms := coalesce(p_long_break_ms, t.long_break_ms);
      if t.status = 'idle' then
        t.duration_ms := case t.phase
          when 'focus' then t.focus_ms
          when 'short_break' then t.short_break_ms
          else t.long_break_ms end;
      end if;
    else
      raise exception 'unknown timer action %', p_action;
  end case;

  update timer_state set
    phase = t.phase, status = t.status, duration_ms = t.duration_ms,
    ends_at = t.ends_at, remaining_ms = t.remaining_ms, cycle_count = t.cycle_count,
    focus_ms = t.focus_ms, short_break_ms = t.short_break_ms, long_break_ms = t.long_break_ms,
    session_id = t.session_id, updated_at = now()
  where room_id = p_room
  returning * into t;

  update rooms set last_active_at = now() where id = p_room;
  return t;
end;
$$;

-- Same as 0003, plus: a finished focus round awards seeds to everyone who
-- checked in (1 per focus minute, ×1.5 when two or more took part), once.
create or replace function public.timer_advance(p_room uuid)
returns public.timer_state language plpgsql security definer set search_path = public as $$
declare
  t timer_state;
  next_phase text;
  next_ms integer;
  participants integer;
  per_person integer;
begin
  if not public.is_room_member(p_room) then
    raise exception 'not a member of this room';
  end if;

  select * into t from timer_state where room_id = p_room for update;
  if t.status <> 'running' or t.ends_at > now() + interval '1 second' then
    return t;
  end if;

  if t.phase = 'focus' then
    select count(*) into participants from session_checkins where session_id = t.session_id;
    if participants > 0 then
      per_person := ceil((t.duration_ms / 60000.0) * case when participants >= 2 then 1.5 else 1 end)::int;
      update session_checkins set seeds_awarded = per_person
        where session_id = t.session_id and seeds_awarded = 0;
      update rooms set
        seeds = seeds + per_person * participants,
        seeds_earned = seeds_earned + per_person * participants
      where id = p_room;
    end if;
    t.cycle_count := t.cycle_count + 1;
    next_phase := case when t.cycle_count % 4 = 0 then 'long_break' else 'short_break' end;
  else
    next_phase := 'focus';
  end if;
  next_ms := case next_phase
    when 'focus' then t.focus_ms
    when 'short_break' then t.short_break_ms
    else t.long_break_ms end;
  if next_phase = 'focus' then
    t.session_id := gen_random_uuid();
  end if;

  if now() - t.ends_at < interval '60 seconds' then
    update timer_state set
      phase = next_phase, duration_ms = next_ms, status = 'running',
      ends_at = t.ends_at + make_interval(secs => next_ms / 1000.0),
      remaining_ms = null, cycle_count = t.cycle_count, session_id = t.session_id, updated_at = now()
    where room_id = p_room
    returning * into t;
  else
    update timer_state set
      phase = next_phase, duration_ms = next_ms, status = 'idle',
      ends_at = null, remaining_ms = null, cycle_count = t.cycle_count, session_id = t.session_id,
      updated_at = now()
    where room_id = p_room
    returning * into t;
  end if;

  update rooms set last_active_at = now() where id = p_room;
  return t;
end;
$$;

-- ───────────── Check-in RPCs ─────────────

-- Set (or change) your goal for the current focus round.
create or replace function public.checkin_set_goal(p_room uuid, p_goal text, p_todo uuid default null)
returns public.session_checkins language plpgsql security definer set search_path = public as $$
declare
  t timer_state;
  c session_checkins;
begin
  if not public.is_room_member(p_room) then raise exception 'not a member of this room'; end if;
  select * into t from timer_state where room_id = p_room;
  if t.phase <> 'focus' then raise exception 'goals are set during focus rounds'; end if;
  if p_todo is not null and not exists (
    select 1 from todos where id = p_todo and room_id = p_room and player_id = auth.uid()
  ) then
    raise exception 'that to-do isn''t yours';
  end if;

  insert into session_checkins (room_id, session_id, player_id, goal, todo_id)
  values (p_room, t.session_id, auth.uid(), trim(p_goal), p_todo)
  on conflict (session_id, player_id) do update set goal = excluded.goal, todo_id = excluded.todo_id
  returning * into c;
  return c;
end;
$$;

-- Say how a finished round went. Once per check-in; bonus seeds for the room,
-- and "done" ticks the linked to-do.
create or replace function public.checkin_result(p_checkin uuid, p_outcome text)
returns public.session_checkins language plpgsql security definer set search_path = public as $$
declare
  c session_checkins;
  bonus integer;
begin
  select * into c from session_checkins where id = p_checkin and player_id = auth.uid() for update;
  if c.id is null then raise exception 'check-in not found'; end if;
  if c.outcome is not null then return c; end if;
  if c.seeds_awarded = 0 then raise exception 'that round hasn''t finished yet'; end if;
  if p_outcome not in ('done', 'partly', 'not') then raise exception 'unknown outcome %', p_outcome; end if;

  bonus := case p_outcome when 'done' then 5 when 'partly' then 3 else 0 end;
  update session_checkins set outcome = p_outcome where id = c.id returning * into c;
  if bonus > 0 then
    update rooms set seeds = seeds + bonus, seeds_earned = seeds_earned + bonus where id = c.room_id;
  end if;
  if p_outcome = 'done' and c.todo_id is not null then
    update todos set done = true where id = c.todo_id and player_id = auth.uid();
  end if;
  return c;
end;
$$;

-- ───────────── Building RPCs ─────────────

-- Place an item: checks level and cost, and pays for it in the same step.
create or replace function public.place_item(p_room uuid, p_kind text, p_x real, p_z real, p_rotation real default 0)
returns public.room_items language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  item item_catalog;
  placed room_items;
begin
  if not public.is_room_member(p_room) then raise exception 'not a member of this room'; end if;
  select * into r from rooms where id = p_room for update;
  select * into item from item_catalog where kind = p_kind;
  if item.kind is null then raise exception 'unknown item %', p_kind; end if;
  if public.island_level(r.seeds_earned) < item.min_level then
    raise exception 'unlocks at island level %', item.min_level;
  end if;
  if r.seeds < item.cost then raise exception 'not enough seeds'; end if;
  if (select count(*) from room_items where room_id = p_room) >= 150 then
    raise exception 'the island is full';
  end if;
  if sqrt(p_x * p_x + p_z * p_z) > 7 then raise exception 'that spot is off the island'; end if;

  insert into room_items (room_id, kind, x, z, rotation, placed_by)
  values (p_room, p_kind, p_x, p_z, p_rotation, auth.uid())
  returning * into placed;
  update rooms set seeds = seeds - item.cost, last_active_at = now() where id = p_room;
  return placed;
end;
$$;

create or replace function public.move_item(p_item uuid, p_x real, p_z real, p_rotation real)
returns public.room_items language plpgsql security definer set search_path = public as $$
declare
  moved room_items;
begin
  select * into moved from room_items where id = p_item;
  if moved.id is null or not public.is_room_member(moved.room_id) then raise exception 'item not found'; end if;
  if sqrt(p_x * p_x + p_z * p_z) > 7 then raise exception 'that spot is off the island'; end if;
  update room_items set x = p_x, z = p_z, rotation = p_rotation where id = p_item returning * into moved;
  return moved;
end;
$$;

-- Remove an item and get half its cost back.
create or replace function public.remove_item(p_item uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  gone room_items;
  refund integer;
begin
  select * into gone from room_items where id = p_item;
  if gone.id is null or not public.is_room_member(gone.room_id) then raise exception 'item not found'; end if;
  select cost / 2 into refund from item_catalog where kind = gone.kind;
  delete from room_items where id = p_item;
  update rooms set seeds = seeds + refund where id = gone.room_id;
  return refund;
end;
$$;

-- Rooms with any progress are never cleaned up, only empty idle ones.
create or replace function public.cleanup_idle_rooms()
returns integer language sql security definer set search_path = public as $$
  with gone as (
    delete from rooms
    where last_active_at < now() - interval '7 days' and seeds_earned = 0
    returning 1
  )
  select count(*)::int from gone;
$$;

-- ───────────── Grants ─────────────

revoke execute on function
  public.island_level(integer),
  public.checkin_set_goal(uuid, text, uuid),
  public.checkin_result(uuid, text),
  public.place_item(uuid, text, real, real, real),
  public.move_item(uuid, real, real, real),
  public.remove_item(uuid)
from public, anon;

grant execute on function
  public.island_level(integer),
  public.checkin_set_goal(uuid, text, uuid),
  public.checkin_result(uuid, text),
  public.place_item(uuid, text, real, real, real),
  public.move_item(uuid, real, real, real),
  public.remove_item(uuid)
to authenticated;

revoke execute on function public.cleanup_idle_rooms() from public, anon, authenticated;

-- ───────────── Realtime ─────────────

-- (Adding a table that's already published is an error, so skip those.)
do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'room_items', 'session_checkins'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Tell the API about the new functions straight away.
notify pgrst, 'reload schema';

-- Last line. If you can see this in the SQL Editor, the whole file is there.
select 'island growth installed' as done;
