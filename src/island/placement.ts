import { CATALOG_BY_KIND, type ItemKind } from '../shared/catalog';
import type { RoomItem } from '../shared/types';
import { OBSTACLES, type Obstacle } from './layout';
import { isOnGrass } from './terrain';

/** Why an item can't go here, or null if it can. */
export function placementProblem(
  kind: ItemKind,
  x: number,
  z: number,
  items: RoomItem[],
  ignoreId?: string,
): string | null {
  const r = CATALOG_BY_KIND[kind].radius;
  if (!isOnGrass(x, z, r)) return 'Needs to be on the grass';
  for (const o of OBSTACLES) {
    if (Math.hypot(x - o.x, z - o.z) < r + o.r) return 'Too close to a tree';
  }
  for (const item of items) {
    if (item.id === ignoreId) continue;
    const other = CATALOG_BY_KIND[item.kind];
    if (!other) continue;
    if (Math.hypot(x - item.x, z - item.z) < r + other.radius) return `Overlaps the ${other.name.toLowerCase()}`;
  }
  return null;
}

/** The island's fixed obstacles plus any solid placed items, for walking. */
export function obstaclesWith(items: RoomItem[]): Obstacle[] {
  const placed = items.flatMap((item) => {
    const c = CATALOG_BY_KIND[item.kind];
    return c?.solid ? [{ x: item.x, z: item.z, r: c.radius }] : [];
  });
  return [...OBSTACLES, ...placed];
}
