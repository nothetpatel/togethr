import { describe, expect, it } from 'vitest';
import { formatClock, remainingMs } from './timer';

const base = { duration_ms: 1_500_000, ends_at: null, remaining_ms: null };

describe('remainingMs', () => {
  it('shows the full duration when idle', () => {
    expect(remainingMs({ ...base, status: 'idle' }, 0)).toBe(1_500_000);
  });

  it('shows the frozen remainder when paused', () => {
    expect(remainingMs({ ...base, status: 'paused', remaining_ms: 42_000 }, 0)).toBe(42_000);
  });

  it('counts down against the server clock when running', () => {
    const endsAt = new Date(1_000_000).toISOString();
    // Local clock is 5s behind the server: local 990_000 = server 995_000.
    expect(remainingMs({ ...base, status: 'running', ends_at: endsAt }, 5_000, 990_000)).toBe(5_000);
  });

  it('two clients with different clocks agree', () => {
    const timer = { ...base, status: 'running' as const, ends_at: new Date(2_000_000).toISOString() };
    const fastClient = remainingMs(timer, -30_000, 1_830_000); // clock 30s ahead
    const slowClient = remainingMs(timer, 12_000, 1_788_000); // clock 12s behind
    expect(fastClient).toBe(slowClient);
  });

  it('never goes negative', () => {
    const timer = { ...base, status: 'running' as const, ends_at: new Date(1_000).toISOString() };
    expect(remainingMs(timer, 0, 5_000)).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(1_500_000)).toBe('25:00');
    expect(formatClock(1_499_001)).toBe('25:00');
    expect(formatClock(1_499_000)).toBe('24:59');
    expect(formatClock(0)).toBe('00:00');
  });
});
