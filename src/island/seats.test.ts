import { describe, expect, it } from 'vitest';
import type { RoomItem } from '../shared/types';
import { allSeats, assignSeats, seatAt } from './seats';

const bench = (rotation: number): RoomItem => ({
  id: 'b',
  room_id: 'r',
  kind: 'bench',
  x: 2,
  z: 1,
  rotation,
  placed_by: null,
  created_at: '',
});

describe('seats', () => {
  it('ring the campfire, each facing the fire', () => {
    const seats = allSeats([]);
    expect(seats).toHaveLength(6);
    for (const s of seats) {
      expect(Math.hypot(s.x, s.z)).toBeCloseTo(1.0, 5);
      // Facing the centre: stepping forward from the seat gets closer to it.
      const ahead = Math.hypot(s.x + Math.sin(s.heading) * 0.1, s.z + Math.cos(s.heading) * 0.1);
      expect(ahead).toBeLessThan(1.0);
    }
  });

  it('turn with the furniture they belong to', () => {
    const [a] = allSeats([bench(0)]).slice(6);
    const [b] = allSeats([bench(Math.PI)]).slice(6);
    expect(a.z).toBeGreaterThan(1); // in front of an unrotated bench
    expect(b.z).toBeLessThan(1); // behind it once turned round
    expect(b.heading).toBeCloseTo(Math.PI);
  });

  it('are shared out the same way on every screen', () => {
    const seats = allSeats([]);
    const one = assignSeats(['zed', 'amy'], seats);
    const two = assignSeats(['amy', 'zed'], seats);
    expect(one.get('amy')).toEqual(two.get('amy'));
    expect(one.get('amy')).not.toEqual(one.get('zed'));
  });

  it('run out gracefully when there are more people than seats', () => {
    const map = assignSeats(['a', 'b', 'c', 'd', 'e', 'f', 'g'], allSeats([]));
    expect(map.size).toBe(6);
  });

  it('can tell which seat someone is in', () => {
    const seats = allSeats([]);
    expect(seatAt(seats[2].x + 0.05, seats[2].z, seats)).toBe(seats[2]);
    expect(seatAt(3, 3, seats)).toBeNull();
  });
});
