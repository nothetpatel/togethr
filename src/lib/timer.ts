import type { TimerState } from '../shared/types';

/**
 * Milliseconds left on the room timer as this client should display it.
 * `clockOffsetMs` is server time minus local time (see measureClockOffset),
 * so a client whose clock runs fast or slow still matches everyone else.
 */
export function remainingMs(
  timer: Pick<TimerState, 'status' | 'duration_ms' | 'ends_at' | 'remaining_ms'>,
  clockOffsetMs: number,
  localNowMs: number = Date.now(),
): number {
  switch (timer.status) {
    case 'idle':
      return timer.duration_ms;
    case 'paused':
      return timer.remaining_ms ?? timer.duration_ms;
    case 'running': {
      if (!timer.ends_at) return timer.duration_ms;
      const serverNow = localNowMs + clockOffsetMs;
      return Math.max(0, new Date(timer.ends_at).getTime() - serverNow);
    }
  }
}

/** 1499000 → "24:59"; rounds up so the display hits 00:00 only at the end. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
