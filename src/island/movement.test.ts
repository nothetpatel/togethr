import { describe, expect, it } from 'vitest';
import { OBSTACLES, type Obstacle } from './layout';
import {
  clampToWalkable,
  pushOutOfObstacles,
  SHORE_MARGIN,
  stepTowards,
  turnTowards,
  walkTarget,
  type Point,
} from './movement';
import { coastDistance } from './terrain';

const tree: Obstacle = { x: 0, z: 0, r: 0.4 };

describe('clampToWalkable', () => {
  it('leaves points on land alone', () => {
    expect(clampToWalkable([1, 2])).toEqual([1, 2]);
  });

  it('pulls taps on the water back to the shore', () => {
    const [x, z] = clampToWalkable([12, 3]);
    expect(coastDistance(x, z)).toBeCloseTo(-SHORE_MARGIN, 5);
  });
});

describe('pushOutOfObstacles', () => {
  it('moves a point inside a tree to its edge', () => {
    const [x, z] = pushOutOfObstacles([0.1, 0], [tree]);
    expect(Math.hypot(x, z)).toBeGreaterThan(0.4);
    expect(z).toBeCloseTo(0);
  });

  it('handles a point exactly at the centre', () => {
    const [x] = pushOutOfObstacles([0, 0], [tree]);
    expect(x).toBeGreaterThan(0.4);
  });
});

describe('walking', () => {
  function walk(from: Point, to: Point, obstacles: Obstacle[], seconds = 20) {
    const target = walkTarget(to, obstacles);
    let pos = from;
    const path: Point[] = [pos];
    for (let t = 0; t < seconds; t += 1 / 60) {
      const step = stepTowards(pos, target, 1 / 60, obstacles);
      pos = step.pos;
      path.push(pos);
      if (step.arrived) return { arrived: true, pos, path, target };
    }
    return { arrived: false, pos, path, target };
  }

  it('reaches an open target', () => {
    const result = walk([0, 0], [1.5, 1], []);
    expect(result.arrived).toBe(true);
  });

  it('walks round a tree that is directly in the way', () => {
    const result = walk([-2, 0], [2, 0], [tree]);
    expect(result.arrived).toBe(true);
    for (const [x, z] of result.path) expect(Math.hypot(x, z)).toBeGreaterThan(0.4);
  });

  it('never walks into the sea', () => {
    const result = walk([0, 0], [20, 0], []);
    expect(result.arrived).toBe(true);
    for (const [x, z] of result.path) expect(coastDistance(x, z)).toBeLessThanOrEqual(-SHORE_MARGIN + 1e-6);
  });

  it('can cross the real island between far-apart spots', () => {
    const spots: Point[] = [[0, 0], [-4, -3], [4, 3], [0, -5], [-3, 4.5], [5, -1]];
    for (const from of spots) {
      for (const to of spots) {
        if (from === to) continue;
        const start = walkTarget(from, OBSTACLES);
        const result = walk(start, to, OBSTACLES, 30);
        expect(result.arrived, `${from} → ${to} stuck at ${result.pos}`).toBe(true);
      }
    }
  });
});

describe('turnTowards', () => {
  it('turns the short way round across ±π', () => {
    const next = turnTowards(3.0, -3.0, 0.1);
    expect(next).toBeGreaterThan(3.0);
  });

  it('snaps when within one turn step', () => {
    expect(turnTowards(1, 1.05, 0.1)).toBeCloseTo(1.05);
  });
});
