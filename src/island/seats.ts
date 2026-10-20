import { CATALOG_BY_KIND } from '../shared/catalog';
import type { RoomItem } from '../shared/types';
import { STARTER_CAMPFIRE } from './layout';

/** A spot an animal can sit at during focus, and which way it faces there. */
export interface Seat {
  x: number;
  z: number;
  /** Radians, 0 = +z (same as PlayerState.heading). */
  heading: number;
}

/**
 * Angle of the first campfire seat: side-on to the camera's starting view
 * (it looks from (9, 9, 11) towards the middle).
 */
const FIRST_SEAT_ANGLE = Math.atan2(-9, 11);

/** How close (metres) to a seat counts as sitting in it. */
export const SEAT_SNAP = 0.7;

/** Every seat on the island: round the starter campfire first, then on built items. */
export function allSeats(items: RoomItem[]): Seat[] {
  const { x: cx, z: cz, seatRadius, seats: count } = STARTER_CAMPFIRE;
  // Seats round the fire, filled in an order that spreads people out: the
  // first two face each other across the flames, on the left and right as
  // the starting camera sees it (so they don't hide behind each other).
  const order = [0, 3, 1, 4, 2, 5].filter((i) => i < count);
  const fire = order.map((i) => {
    const a = (i / count) * Math.PI * 2 + FIRST_SEAT_ANGLE;
    const x = cx + Math.cos(a) * seatRadius;
    const z = cz + Math.sin(a) * seatRadius;
    return { x, z, heading: Math.atan2(cx - x, cz - z) };
  });

  const built = items.flatMap((item) =>
    (CATALOG_BY_KIND[item.kind]?.seats ?? []).map((s) => {
      const cos = Math.cos(item.rotation);
      const sin = Math.sin(item.rotation);
      // Rotate the offset the same way three.js rotates the item about y.
      const x = item.x + s.x * cos + s.z * sin;
      const z = item.z - s.x * sin + s.z * cos;
      const heading = s.face === 'forward' ? item.rotation : Math.atan2(item.x - x, item.z - z);
      return { x, z, heading };
    }),
  );

  return [...fire, ...built];
}

/**
 * Who sits where: everyone online, in a fixed order, takes the next free
 * seat. Every screen works this out the same way, so nobody collides.
 */
export function assignSeats(playerIds: string[], seats: Seat[]): Map<string, Seat> {
  const sorted = [...playerIds].sort();
  const map = new Map<string, Seat>();
  sorted.forEach((id, i) => {
    if (i < seats.length) map.set(id, seats[i]);
  });
  return map;
}

/** The seat an animal at (x, z) is sitting in, if any. */
export function seatAt(x: number, z: number, seats: Seat[], within = 0.2): Seat | null {
  let best: Seat | null = null;
  let bestDist = within;
  for (const s of seats) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}
