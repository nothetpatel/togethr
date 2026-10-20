import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { measureClockOffset } from '../lib/supabase';
import { remainingMs } from '../lib/timer';
import type { TimerState } from '../shared/types';

export type TimerAction = 'start' | 'pause' | 'reset' | 'skip';

export interface TimerDurations {
  focus_ms: number;
  short_break_ms: number;
  long_break_ms: number;
}

export interface RoomTimer {
  timer: TimerState | null;
  /** Milliseconds left as everyone in the room sees it. Updates ~4× a second. */
  remaining: number;
  /** Owner-only; the server refuses anyone else. */
  control: (action: TimerAction) => Promise<void>;
  configure: (durations: TimerDurations) => Promise<void>;
  error: string | null;
}

/** Called once per finished phase (same moment on every screen). */
type OnPhaseEnd = (finished: TimerState) => void;

/**
 * The room's Pomodoro timer. Every screen counts down from the server's
 * `ends_at`, corrected by this device's clock offset, so all countdowns
 * match. When a phase hits zero, this client asks the server to move on
 * (any member may; the server makes sure it only happens once).
 */
export function useRoomTimer(
  client: SupabaseClient,
  roomId: string,
  onPhaseEnd?: OnPhaseEnd,
): RoomTimer {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const handledEnd = useRef<string | null>(null);
  const phaseEnd = useRef(onPhaseEnd);
  phaseEnd.current = onPhaseEnd;

  // Keep only the newest row (realtime and RPC replies can arrive out of order).
  const accept = useCallback((row: TimerState) => {
    setTimer((cur) => (cur && Date.parse(cur.updated_at) > Date.parse(row.updated_at) ? cur : row));
  }, []);

  // Clock offset: median of three samples, refreshed every few minutes.
  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      try {
        const samples = [];
        for (let i = 0; i < 3; i++) samples.push(await measureClockOffset(client));
        samples.sort((a, b) => a - b);
        if (!cancelled) setOffset(samples[1]);
      } catch (err) {
        console.warn('clock offset measurement failed', err);
      }
    };
    measure();
    const every = setInterval(measure, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(every);
    };
  }, [client]);

  // Load the row and follow changes.
  useEffect(() => {
    setTimer(null);
    const load = () =>
      client
        .from('timer_state')
        .select()
        .eq('room_id', roomId)
        .single()
        .then(({ data, error }) => (error ? setError(error.message) : accept(data as TimerState)));
    const channel = client
      .channel(`timer:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'timer_state', filter: `room_id=eq.${roomId}` },
        ({ new: row }) => accept(row as TimerState),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      client.removeChannel(channel);
    };
  }, [client, roomId, accept]);

  // Tick for the display.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  const remaining = timer ? remainingMs(timer, offset, now) : 0;

  // Phase finished: chime once, then ask the server to move on.
  useEffect(() => {
    if (!timer || timer.status !== 'running' || !timer.ends_at || remaining > 0) return;
    if (handledEnd.current === timer.ends_at) return;
    handledEnd.current = timer.ends_at;
    phaseEnd.current?.(timer);
    // A small random delay so a room full of clients doesn't all call at once.
    const wait = setTimeout(() => {
      client
        .rpc('timer_advance', { p_room: roomId })
        .then(({ data, error }) => (error ? setError(error.message) : accept(data as TimerState)));
    }, 300 + Math.random() * 700);
    return () => clearTimeout(wait);
  }, [timer, remaining, client, roomId, accept]);

  const control = useCallback(
    async (action: TimerAction) => {
      setError(null);
      const { data, error } = await client.rpc('timer_control', { p_room: roomId, p_action: action });
      if (error) setError(error.message);
      else accept(data as TimerState);
    },
    [client, roomId, accept],
  );

  const configure = useCallback(
    async (d: TimerDurations) => {
      setError(null);
      const { data, error } = await client.rpc('timer_control', {
        p_room: roomId,
        p_action: 'configure',
        p_focus_ms: d.focus_ms,
        p_short_break_ms: d.short_break_ms,
        p_long_break_ms: d.long_break_ms,
      });
      if (error) setError(error.message);
      else accept(data as TimerState);
    },
    [client, roomId, accept],
  );

  return { timer, remaining, control, configure, error };
}
