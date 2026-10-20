import type { PositionMessage } from '../shared/types';
import type { Obstacle } from './layout';
import { stepTowards, turnTowards, WALK_SPEED, type Point } from './movement';

// Other players' animals. Players only send where they are and where they're
// walking to (on each tap, plus a heartbeat), so each client re-runs the same
// walking logic locally: smooth movement for very little traffic.

export interface RemoteState {
  /** Where the animal is drawn. Eases towards the simulated position. */
  x: number;
  z: number;
  heading: number;
  /** Walk animation amount, 0..1. */
  speed: number;
  /** Simulated true position: last report, walked forward towards the target. */
  simX: number;
  simZ: number;
  target: Point | null;
}

/** Drawn position catches up with the simulation this fast (per second). */
const CATCH_UP = 10;
/** Further apart than this, just jump (e.g. the first report, or after a lag spike). */
const SNAP_DISTANCE = 3;
const TURN_SPEED = 10;

export function applyUpdate(prev: RemoteState | undefined, m: PositionMessage): RemoteState {
  const target: Point | null = m.tx !== null && m.tz !== null ? [m.tx, m.tz] : null;
  if (!prev || Math.hypot(prev.x - m.x, prev.z - m.z) > SNAP_DISTANCE) {
    return { x: m.x, z: m.z, heading: m.h, speed: 0, simX: m.x, simZ: m.z, target };
  }
  return { ...prev, simX: m.x, simZ: m.z, target, heading: target ? prev.heading : m.h };
}

/** Advances one remote animal by `dt` seconds. Mutates `r`. */
export function advanceRemote(r: RemoteState, dt: number, obstacles: Obstacle[]): void {
  if (r.target) {
    const { pos, arrived } = stepTowards([r.simX, r.simZ], r.target, dt, obstacles);
    r.simX = pos[0];
    r.simZ = pos[1];
    if (arrived) r.target = null;
  }

  const k = 1 - Math.exp(-CATCH_UP * dt);
  const dx = (r.simX - r.x) * k;
  const dz = (r.simZ - r.z) * k;
  r.x += dx;
  r.z += dz;

  const moved = Math.hypot(dx, dz);
  if (moved > 1e-4) r.heading = turnTowards(r.heading, Math.atan2(dx, dz), TURN_SPEED * dt);
  const pace = dt > 0 ? Math.min(1, moved / (WALK_SPEED * dt)) : 0;
  r.speed += (pace - r.speed) * (1 - Math.exp(-10 * dt));
}
