-- Togethr: move the Pomodoro timer on when a phase finishes.
-- Any member's browser calls this when its countdown hits zero, so the timer
-- keeps going even if the owner's tab is in the background. The row lock and
-- the "has it really ended?" check make simultaneous calls safe: the first
-- one advances, the rest just get the new state back.

create function public.timer_advance(p_room uuid)
returns public.timer_state language plpgsql security definer set search_path = public as $$
declare
  t timer_state;
  next_phase text;
  next_ms integer;
begin
  if not public.is_room_member(p_room) then
    raise exception 'not a member of this room';
  end if;

  select * into t from timer_state where room_id = p_room for update;
  -- Allow a second of clock error, but never advance a phase that's still going.
  if t.status <> 'running' or t.ends_at > now() + interval '1 second' then
    return t;
  end if;

  if t.phase = 'focus' then
    t.cycle_count := t.cycle_count + 1;
    next_phase := case when t.cycle_count % 4 = 0 then 'long_break' else 'short_break' end;
  else
    next_phase := 'focus';
  end if;
  next_ms := case next_phase
    when 'focus' then t.focus_ms
    when 'short_break' then t.short_break_ms
    else t.long_break_ms end;

  if now() - t.ends_at < interval '60 seconds' then
    -- People were here: start the next phase from the moment the last one
    -- ended, so every screen stays exactly in step.
    update timer_state set
      phase = next_phase, duration_ms = next_ms, status = 'running',
      ends_at = t.ends_at + make_interval(secs => next_ms / 1000.0),
      remaining_ms = null, cycle_count = t.cycle_count, updated_at = now()
    where room_id = p_room
    returning * into t;
  else
    -- Nobody was around when it ended: line up the next phase, but wait.
    update timer_state set
      phase = next_phase, duration_ms = next_ms, status = 'idle',
      ends_at = null, remaining_ms = null, cycle_count = t.cycle_count, updated_at = now()
    where room_id = p_room
    returning * into t;
  end if;

  update rooms set last_active_at = now() where id = p_room;
  return t;
end;
$$;

revoke execute on function public.timer_advance(uuid) from public, anon;
grant execute on function public.timer_advance(uuid) to authenticated;
