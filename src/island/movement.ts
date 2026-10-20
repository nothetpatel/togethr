import type { Obstacle } from './layout';
import { coastDistance, coastRadius } from './terrain';

// Pure walking logic on the island's ground plane (x, z). Kept free of three.js
// and React so it's easy to test and to reuse for other players in phase 4.

export type Point = [number, number];

export const WALK_SPEED = 2.2; // metres per second
/** How far inland from the waterline animals stay. */
export const SHORE_MARGIN = 0.35;
/** Body radius used when keeping clear of obstacles. */
const BODY_RADIUS = 0.22;
/** Close enough to the target to stop. */
const ARRIVE_DISTANCE = 0.05;

/** Pulls a point in from the water so it's on walkable ground. */
export function clampToWalkable([x, z]: Point): Point {
  if (coastDistance(x, z) <= -SHORE_MARGIN) return [x, z];
  const angle = Math.atan2(z, x);
  const r = coastRadius(angle) - SHORE_MARGIN;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

/** Pushes a point out of any obstacle it overlaps. */
export function pushOutOfObstacles([x, z]: Point, obstacles: Obstacle[]): Point {
  for (const o of obstacles) {
    const dx = x - o.x;
    const dz = z - o.z;
    const minDist = o.r + BODY_RADIUS;
    const dist = Math.hypot(dx, dz);
    if (dist >= minDist) continue;
    if (dist < 1e-6) {
      x = o.x + minDist;
      continue;
    }
    x = o.x + (dx / dist) * minDist;
    z = o.z + (dz / dist) * minDist;
  }
  return [x, z];
}

/** Where a tap should send you: walkable and not inside a tree. */
export function walkTarget(tap: Point, obstacles: Obstacle[]): Point {
  return clampToWalkable(pushOutOfObstacles(clampToWalkable(tap), obstacles));
}

/**
 * Direction to walk this frame: straight at the target, bent sideways around
 * any obstacle in the way (whichever side the target is already favouring).
 */
export function steer(pos: Point, target: Point, obstacles: Obstacle[]): Point {
  let dx = target[0] - pos[0];
  let dz = target[1] - pos[1];
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return [0, 0];
  dx /= len;
  dz /= len;

  let ax = 0;
  let az = 0;
  for (const o of obstacles) {
    const ox = o.x - pos[0];
    const oz = o.z - pos[1];
    const ahead = ox * dx + oz * dz; // distance along our path
    if (ahead <= 0 || ahead > Math.min(len, 1.4)) continue;
    const side = ox * -dz + oz * dx; // signed distance off our path
    const clearance = o.r + BODY_RADIUS + 0.1;
    if (Math.abs(side) >= clearance) continue;
    // Steer away from the obstacle's side, harder the closer and more central it is.
    const push = (1 - Math.abs(side) / clearance) * (1 - ahead / 1.4) * 2.5;
    const away = side >= 0 ? -1 : 1;
    ax += -dz * away * push;
    az += dx * away * push;
  }
  const sx = dx + ax;
  const sz = dz + az;
  const sl = Math.hypot(sx, sz) || 1;
  return [sx / sl, sz / sl];
}

export interface StepResult {
  pos: Point;
  arrived: boolean;
}

/** Moves up to `speed * dt` towards the target, steering round obstacles. */
export function stepTowards(
  pos: Point,
  target: Point,
  dt: number,
  obstacles: Obstacle[],
  speed = WALK_SPEED,
): StepResult {
  const remaining = Math.hypot(target[0] - pos[0], target[1] - pos[1]);
  if (remaining <= ARRIVE_DISTANCE) return { pos: target, arrived: true };
  const stride = Math.min(remaining, speed * dt);
  const [dx, dz] = steer(pos, target, obstacles);
  const next = clampToWalkable(pushOutOfObstacles([pos[0] + dx * stride, pos[1] + dz * stride], obstacles));
  return { pos: next, arrived: false };
}

/** Turns `current` towards `desired` (radians) by at most `maxTurn`, the short way round. */
export function turnTowards(current: number, desired: number, maxTurn: number): number {
  let diff = desired - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return current + Math.max(-maxTurn, Math.min(maxTurn, diff));
}
