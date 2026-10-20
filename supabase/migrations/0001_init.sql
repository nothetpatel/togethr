-- Togethr: initial schema.
-- Players are Supabase anonymous-auth users, so auth.uid() identifies them.
-- Rooms are created and joined only through the RPCs below, which keeps the
-- 4-letter code lookup and the timer's server clock out of client hands.

-- ───────────── Tables ─────────────

create table public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 24),
  avatar      jsonb not null default '{"animal": "cat", "color": "#ffb5c8"}',
  created_at  timestamptz not null default now()
);

create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  -- 24-letter alphabet without I and O (they look like 1 and 0)
  code            text not null unique check (code ~ '^[A-HJ-NP-Z]{4}$'),
  owner_id        uuid not null references public.players (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now()
);

create table public.room_members (
  room_id       uuid not null references public.rooms (id) on delete cascade,
  player_id     uuid not null references public.players (id) on delete cascade,
  joined_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (room_id, player_id)
);
create index room_members_player_idx on public.room_members (player_id);

create table public.todos (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 200),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index todos_room_idx on public.todos (room_id, created_at);

create table public.timer_state (
  room_id         uuid primary key references public.rooms (id) on delete cascade,
  phase           text not null default 'focus' check (phase in ('focus', 'short_break', 'long_break')),
  status          text not null default 'idle' check (status in ('idle', 'running', 'paused')),
  duration_ms     integer not null default 1500000,
  ends_at         timestamptz,
  remaining_ms    integer,
  cycle_count     integer not null default 0,
  focus_ms        integer not null default 1500000 check (focus_ms between 60000 and 10800000),
  short_break_ms  integer not null default 300000 check (short_break_ms between 60000 and 3600000),
  long_break_ms   integer not null default 900000 check (long_break_ms between 60000 and 3600000),
  updated_at      timestamptz not null default now()
);

-- ───────────── Helpers (security definer avoids RLS recursion) ─────────────

create function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members where room_id = p_room and player_id = auth.uid()
  );
$$;

create function public.shares_room_with(p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from room_members mine
    join room_members theirs on theirs.room_id = mine.room_id
    where mine.player_id = auth.uid() and theirs.player_id = p_player
  );
$$;

create function public.server_now()
returns timestamptz language sql stable as $$ select now(); $$;

-- ───────────── Row-level security ─────────────

alter table public.players      enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.todos        enable row level security;
alter table public.timer_state  enable row level security;

-- players: see yourself and anyone you share a room with; edit only yourself
create policy players_select on public.players for select to authenticated
  using (id = auth.uid() or public.shares_room_with(id));
create policy players_insert on public.players for insert to authenticated
  with check (id = auth.uid());
create policy players_update on public.players for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- rooms: visible to members; created/joined via RPCs only
create policy rooms_select on public.rooms for select to authenticated
  using (public.is_room_member(id));

-- room_members: visible to fellow members; you can bump your own last_seen or leave
create policy members_select on public.room_members for select to authenticated
  using (public.is_room_member(room_id));
create policy members_update on public.room_members for update to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy members_delete on public.room_members for delete to authenticated
  using (player_id = auth.uid());

-- todos: everyone in the room can read; only the author can write
create policy todos_select on public.todos for select to authenticated
  using (public.is_room_member(room_id));
create policy todos_insert on public.todos for insert to authenticated
  with check (player_id = auth.uid() and public.is_room_member(room_id));
create policy todos_update on public.todos for update to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy todos_delete on public.todos for delete to authenticated
  using (player_id = auth.uid());

-- timer_state: members read; writes only through timer_control (owner-checked)
create policy timer_select on public.timer_state for select to authenticated
  using (public.is_room_member(room_id));

-- ───────────── RPCs ─────────────

-- Creates a room with a fresh 4-letter code, makes the caller owner + member.
create function public.create_room()
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_room rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from players where id = auth.uid()) then
    raise exception 'create a player profile first';
  end if;

  for attempt in 1..20 loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * 24)::int, 1);
    end loop;
    begin
      insert into rooms (code, owner_id) values (v_code, auth.uid()) returning * into v_room;
      exit;
    exception when unique_violation then
      v_room := null; -- code taken, try another
    end;
  end loop;
  if v_room.id is null then raise exception 'could not allocate a room code'; end if;

  insert into room_members (room_id, player_id) values (v_room.id, auth.uid());
  insert into timer_state (room_id) values (v_room.id);
  return v_room;
end;
$$;

-- Joins a room by code (case-insensitive). Rooms hold at most 8 people.
create function public.join_room(p_code text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from players where id = auth.uid()) then
    raise exception 'create a player profile first';
  end if;

  select * into v_room from rooms where code = upper(trim(p_code));
  if v_room.id is null then raise exception 'no room with that code'; end if;

  if not exists (select 1 from room_members where room_id = v_room.id and player_id = auth.uid())
     and (select count(*) from room_members where room_id = v_room.id) >= 8 then
    raise exception 'room is full';
  end if;

  insert into room_members (room_id, player_id) values (v_room.id, auth.uid())
    on conflict (room_id, player_id) do update set last_seen_at = now();
  update rooms set last_active_at = now() where id = v_room.id returning * into v_room;
  return v_room;
end;
$$;

-- Owner-only timer control. Uses the server clock for ends_at so every
-- client's countdown agrees regardless of local clock drift.
-- p_action: 'start' | 'pause' | 'reset' | 'skip' | 'configure'
create function public.timer_control(
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
    updated_at = now()
  where room_id = p_room
  returning * into t;

  update rooms set last_active_at = now() where id = p_room;
  return t;
end;
$$;

-- Deletes rooms idle for 7+ days. Schedule with pg_cron if enabled:
--   select cron.schedule('cleanup-idle-rooms', '0 4 * * *', 'select public.cleanup_idle_rooms()');
create function public.cleanup_idle_rooms()
returns integer language sql security definer set search_path = public as $$
  with gone as (
    delete from rooms where last_active_at < now() - interval '7 days' returning 1
  )
  select count(*)::int from gone;
$$;

-- ───────────── Grants ─────────────
-- Explicit, so this works with "Automatically expose new tables" turned off.
-- Players are anonymous-auth users, which use the `authenticated` role; the
-- `anon` role (no session at all) gets nothing. RLS above still filters rows.

grant select, insert, update         on public.players      to authenticated;
grant select                         on public.rooms        to authenticated;
grant select, update, delete         on public.room_members to authenticated;
grant select, insert, update, delete on public.todos        to authenticated;
grant select                         on public.timer_state  to authenticated;

-- Postgres lets every role run a new function by default, so revoke from
-- `public` first, then grant back only what the app calls.
revoke execute on function
  public.is_room_member(uuid),
  public.shares_room_with(uuid),
  public.server_now(),
  public.create_room(),
  public.join_room(text),
  public.timer_control(uuid, text, integer, integer, integer),
  public.cleanup_idle_rooms()
from public, anon, authenticated;

grant execute on function
  public.is_room_member(uuid),
  public.shares_room_with(uuid),
  public.server_now(),
  public.create_room(),
  public.join_room(text),
  public.timer_control(uuid, text, integer, integer, integer)
to authenticated;

-- ───────────── Realtime ─────────────
-- Postgres-change events respect RLS, so members only hear about their rooms.

alter publication supabase_realtime add table public.todos, public.timer_state, public.room_members;
