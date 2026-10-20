// What you can build on the island, and how levels and seeds work.
// Prices and unlock levels are enforced by the database (item_catalog and
// island_level() in supabase/migrations/0004_island_growth.sql); keep the two
// in sync. `npm run smoke:db` compares them.

export type ItemKind =
  | 'flower_patch'
  | 'bush'
  | 'stepping_stones'
  | 'tree'
  | 'bench'
  | 'lantern'
  | 'picnic_blanket'
  | 'campfire'
  | 'study_desk'
  | 'hammock'
  | 'pond'
  | 'gazebo'
  | 'cafe_stall'
  | 'cottage';

/**
 * A seat: offset from the item's centre, and which way the animal faces:
 * 'item' faces the item (a fire, a desk), 'forward' faces the way the item
 * does (a bench, a hammock).
 */
export interface SeatSpot {
  x: number;
  z: number;
  face: 'item' | 'forward';
}

const seat = (x: number, z: number, face: SeatSpot['face'] = 'item'): SeatSpot => ({ x, z, face });

export interface CatalogItem {
  kind: ItemKind;
  name: string;
  emoji: string;
  cost: number;
  minLevel: number;
  /** Footprint radius: no two items overlap, and animals walk around it (0 = walk over it). */
  radius: number;
  /** Animals walk round it (false for flat things you can walk across). */
  solid: boolean;
  /** Where animals can sit during focus: offsets from the item (before its rotation). */
  seats?: SeatSpot[];
}

export const CATALOG: CatalogItem[] = [
  { kind: 'flower_patch', name: 'Flower patch', emoji: '🌷', cost: 10, minLevel: 1, radius: 0.35, solid: false },
  { kind: 'bush', name: 'Bush', emoji: '🌿', cost: 15, minLevel: 1, radius: 0.32, solid: true },
  { kind: 'stepping_stones', name: 'Stepping stones', emoji: '🪨', cost: 15, minLevel: 1, radius: 0.4, solid: false },
  { kind: 'tree', name: 'Tree', emoji: '🌳', cost: 30, minLevel: 1, radius: 0.4, solid: true },
  { kind: 'bench', name: 'Bench', emoji: '🪑', cost: 40, minLevel: 2, radius: 0.5, solid: true, seats: [seat(-0.25, 0.3, 'forward'), seat(0.25, 0.3, 'forward')] },
  { kind: 'lantern', name: 'Lantern', emoji: '🏮', cost: 40, minLevel: 2, radius: 0.18, solid: true },
  { kind: 'picnic_blanket', name: 'Picnic blanket', emoji: '🧺', cost: 50, minLevel: 2, radius: 0.6, solid: false, seats: [seat(-0.25, 0.05, 'forward'), seat(0.25, 0.05, 'forward')] },
  { kind: 'campfire', name: 'Campfire', emoji: '🔥', cost: 60, minLevel: 2, radius: 0.4, solid: true, seats: [seat(0, 0.95), seat(0.95, 0), seat(0, -0.95), seat(-0.95, 0)] },
  { kind: 'study_desk', name: 'Study desk', emoji: '📚', cost: 80, minLevel: 3, radius: 0.5, solid: true, seats: [seat(0, 0.55)] },
  { kind: 'hammock', name: 'Hammock', emoji: '🏝️', cost: 120, minLevel: 3, radius: 0.7, solid: true, seats: [seat(0, 0.15, 'forward')] },
  { kind: 'pond', name: 'Pond', emoji: '🪷', cost: 150, minLevel: 3, radius: 0.8, solid: true },
  { kind: 'gazebo', name: 'Gazebo', emoji: '⛩️', cost: 200, minLevel: 4, radius: 1.0, solid: true, seats: [seat(-0.35, 0.3), seat(0.35, 0.3)] },
  { kind: 'cafe_stall', name: 'Café stall', emoji: '☕', cost: 250, minLevel: 4, radius: 0.8, solid: true, seats: [seat(-0.4, 0.75), seat(0.4, 0.75)] },
  { kind: 'cottage', name: 'Cottage', emoji: '🏡', cost: 300, minLevel: 4, radius: 1.1, solid: true },
];

export const CATALOG_BY_KIND = Object.fromEntries(CATALOG.map((c) => [c.kind, c])) as Record<ItemKind, CatalogItem>;

/** Lifetime seeds needed to reach each level (index 0 = level 1). */
export const LEVELS = [0, 100, 300, 700, 1500];
export const MAX_LEVEL = LEVELS.length;

export function levelFor(seedsEarned: number): number {
  let level = 1;
  LEVELS.forEach((needed, i) => {
    if (seedsEarned >= needed) level = i + 1;
  });
  return level;
}

/** Progress through the current level, 0..1 (1 at max level). */
export function levelProgress(seedsEarned: number): { level: number; progress: number; toNext: number | null } {
  const level = levelFor(seedsEarned);
  if (level >= MAX_LEVEL) return { level, progress: 1, toNext: null };
  const from = LEVELS[level - 1];
  const to = LEVELS[level];
  return { level, progress: (seedsEarned - from) / (to - from), toNext: to - seedsEarned };
}

/** Seeds each participant earns for a finished focus round (mirrors timer_advance). */
export function seedsPerParticipant(focusMinutes: number, participants: number): number {
  return Math.ceil(focusMinutes * (participants >= 2 ? 1.5 : 1));
}

/** Bonus for how a round went (mirrors checkin_result). */
export const OUTCOME_BONUS = { done: 5, partly: 3, not: 0 } as const;

export function refundFor(kind: ItemKind): number {
  return Math.floor(CATALOG_BY_KIND[kind].cost / 2);
}
