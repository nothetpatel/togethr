import { describe, expect, it } from 'vitest';
import type { RoomItem } from '../shared/types';
import { OBSTACLES } from './layout';
import { obstaclesWith, placementProblem } from './placement';

const item = (kind: RoomItem['kind'], x: number, z: number, id = kind): RoomItem => ({
  id,
  room_id: 'r',
  kind,
  x,
  z,
  rotation: 0,
  placed_by: null,
  created_at: '',
});

describe('placement', () => {
  it('allows open grass', () => {
    expect(placementProblem('bench', 0.5, 1.5, [])).toBeNull();
  });

  it('refuses the beach and the sea', () => {
    expect(placementProblem('bench', 6.8, 0, [])).toMatch(/grass/);
    expect(placementProblem('flower_patch', 12, 0, [])).toMatch(/grass/);
  });

  it('refuses spots on top of the island’s trees', () => {
    const t = OBSTACLES[1]; // [0] is the campfire
    expect(placementProblem('bench', t.x, t.z, [])).toMatch(/tree/);
  });

  it('refuses overlapping another item, but not when moving that same item', () => {
    const bench = item('bench', 0.5, 1.5);
    expect(placementProblem('lantern', 0.7, 1.5, [bench])).toMatch(/bench/);
    expect(placementProblem('bench', 0.6, 1.5, [bench], bench.id)).toBeNull();
  });

  it('makes solid items obstacles but not flat ones', () => {
    const extra = obstaclesWith([item('bench', 0.5, 1.5), item('picnic_blanket', -1, 1.5)]).length - OBSTACLES.length;
    expect(extra).toBe(1);
  });
});
