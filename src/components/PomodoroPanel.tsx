import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRoomTimer, type RoomTimer } from '../hooks/useRoomTimer';
import { chime, isMuted, setMuted } from '../lib/chime';
import { formatClock } from '../lib/timer';
import type { TimerPhase } from '../shared/types';

const PHASE_LABEL: Record<TimerPhase, string> = {
  focus: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
};

/** Focus sessions in a set before the long break. */
const SET_SIZE = 4;

// The room's shared Pomodoro timer. Everyone sees the same countdown; only
// the owner gets the controls.
export function PomodoroPanel({
  client,
  roomId,
  isOwner,
}: {
  client: SupabaseClient;
  roomId: string;
  isOwner: boolean;
}) {
  const room = useRoomTimer(client, roomId, chime);
  const { timer, remaining, control, error } = room;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  function toggleMute() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  const clock = formatClock(remaining);
  const label = timer ? PHASE_LABEL[timer.phase as TimerPhase] : '';

  // Show the countdown in the browser tab, for studying in another tab.
  useEffect(() => {
    if (!timer || timer.status === 'idle') {
      document.title = 'Togethr';
      return;
    }
    document.title = `${clock} · ${label}${timer.status === 'paused' ? ' (paused)' : ''} · Togethr`;
  }, [clock, label, timer]);
  useEffect(() => () => void (document.title = 'Togethr'), []);

  if (!timer) return <section className="card timer-panel" aria-label="Pomodoro timer" aria-busy />;

  const done = timer.phase === 'long_break' ? SET_SIZE : timer.cycle_count % SET_SIZE;
  const running = timer.status === 'running';

  return (
    <section className={`card timer-panel phase-${timer.phase}`} aria-label="Pomodoro timer">
      <div className="timer-head">
        <span className="timer-phase">{label}</span>
        {timer.status === 'paused' && <span className="badge">paused</span>}
        <span className="timer-dots" aria-label={`${done} of ${SET_SIZE} focus sessions done`}>
          {Array.from({ length: SET_SIZE }, (_, i) => (
            <span key={i} className={i < done ? 'on' : ''} />
          ))}
        </span>
        <button
          type="button"
          className="icon mute"
          onClick={toggleMute}
          aria-label={muted ? 'Turn chime on' : 'Turn chime off'}
          aria-pressed={muted}
          title={muted ? 'Chime off' : 'Chime on'}
        >
          {muted ? '🔕' : '🔔'}
        </button>
      </div>

      <p className="timer-clock" data-testid="timer-clock" aria-live="off">
        {clock}
      </p>

      {isOwner ? (
        <div className="timer-controls">
          <button className="primary" onClick={() => control(running ? 'pause' : 'start')}>
            {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start'}
          </button>
          <button onClick={() => control('reset')} aria-label="Reset timer" title="Reset">
            ↺
          </button>
          <button onClick={() => control('skip')} aria-label="Skip to next phase" title="Skip">
            ⏭
          </button>
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Timer settings"
            aria-expanded={settingsOpen}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      ) : (
        <p className="muted small">The room owner runs the timer.</p>
      )}

      {isOwner && settingsOpen && <TimerSettings room={room} onDone={() => setSettingsOpen(false)} />}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function TimerSettings({ room, onDone }: { room: RoomTimer; onDone: () => void }) {
  const t = room.timer!;
  const [focus, setFocus] = useState(String(t.focus_ms / 60_000));
  const [short, setShort] = useState(String(t.short_break_ms / 60_000));
  const [long, setLong] = useState(String(t.long_break_ms / 60_000));
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await room.configure({
      focus_ms: Math.round(Number(focus) * 60_000),
      short_break_ms: Math.round(Number(short) * 60_000),
      long_break_ms: Math.round(Number(long) * 60_000),
    });
    setBusy(false);
    onDone();
  }

  const field = (label: string, value: string, set: (v: string) => void, max: number) => (
    <label className="timer-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        required
        value={value}
        onChange={(e) => set(e.target.value)}
      />
      <span className="muted small">min</span>
    </label>
  );

  return (
    <form className="timer-settings" onSubmit={save}>
      {field('Focus', focus, setFocus, 180)}
      {field('Short break', short, setShort, 60)}
      {field('Long break', long, setLong, 60)}
      <p className="muted small">New lengths apply from the next phase (or now, if the timer isn't running).</p>
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
