import { describe, expect, it } from 'vitest';
import type { PositionMessage } from '../shared/types';
import { OBSTACLES } from './layout';
import { stepTowards } from './movement';
import { advanceRemote, applyUpdate } from './remote';

const msg = (m: Partial<PositionMessage>): PositionMessage => ({
  id: 'p',
  x: 0,
  z: 0,
  h: 0,
  tx: null,
  tz: null,
  ...m,
});

function run(r: ReturnType<typeof applyUpdate>, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) advanceRemote(r, 1 / 60, OBSTACLES);
}

describe('remote players', () => {
  it('appear exactly where first reported', () => {
    const r = applyUpdate(undefined, msg({ x: 1, z: 2, h: 0.5 }));
    expect([r.x, r.z, r.heading]).toEqual([1, 2, 0.5]);
  });

  it('walk to the reported target and stop', () => {
    const r = applyUpdate(undefined, msg({ x: 0, z: 0, tx: 1.5, tz: 1 }));
    run(r, 3);
    expect(r.x).toBeCloseTo(1.5, 2);
    expect(r.z).toBeCloseTo(1, 2);
    expect(r.target).toBeNull();
    expect(r.speed).toBeLessThan(0.05);
  });

  it('track the sender closely while walking, with only occasional updates', () => {
    // The sender walks locally; we hear only the initial tap.
    let sender: [number, number] = [-1, 0];
    const target: [number, number] = [2, 1.5];
    const r = applyUpdate(undefined, msg({ x: sender[0], z: sender[1], tx: target[0], tz: target[1] }));
    let maxGap = 0;
    for (let t = 0; t < 2; t += 1 / 60) {
      sender = stepTowards(sender, target, 1 / 60, OBSTACLES).pos;
      advanceRemote(r, 1 / 60, OBSTACLES);
      maxGap = Math.max(maxGap, Math.hypot(r.x - sender[0], r.z - sender[1]));
    }
    expect(maxGap).toBeLessThan(0.3);
  });

  it('glide (not jump) when a heartbeat corrects a small drift', () => {
    const r = applyUpdate(undefined, msg({ x: 0, z: 0 }));
    const next = applyUpdate(r, msg({ x: 0.5, z: 0 }));
    expect(next.x).toBe(0); // drawn position hasn't jumped
    run(next, 1);
    expect(next.x).toBeCloseTo(0.5, 2);
  });

  it('snap when the report is far away', () => {
    const r = applyUpdate(undefined, msg({ x: 0, z: 0 }));
    const next = applyUpdate(r, msg({ x: 4, z: 0 }));
    expect(next.x).toBe(4);
  });
});
