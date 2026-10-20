import { describe, expect, it } from 'vitest';
import { CATALOG, levelFor, levelProgress, LEVELS, refundFor, seedsPerParticipant } from './catalog';

describe('levels', () => {
  it('start at 1 and step up at each threshold', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(699)).toBe(3);
    expect(levelFor(1500)).toBe(5);
    expect(levelFor(99999)).toBe(5);
  });

  it('report progress towards the next level', () => {
    expect(levelProgress(200)).toEqual({ level: 2, progress: 0.5, toNext: 100 });
    expect(levelProgress(5000)).toEqual({ level: 5, progress: 1, toNext: null });
  });

  it('every item unlocks at a reachable level', () => {
    for (const item of CATALOG) expect(item.minLevel).toBeLessThanOrEqual(LEVELS.length);
  });
});

describe('seeds', () => {
  it('pay a seed per focus minute, ×1.5 together', () => {
    expect(seedsPerParticipant(25, 1)).toBe(25);
    expect(seedsPerParticipant(25, 2)).toBe(38);
    expect(seedsPerParticipant(1, 3)).toBe(2);
  });

  it('refund half (rounded down) when removing', () => {
    expect(refundFor('tree')).toBe(15);
    expect(refundFor('bush')).toBe(7);
  });

  it('has unique kinds', () => {
    expect(new Set(CATALOG.map((c) => c.kind)).size).toBe(CATALOG.length);
  });
});
