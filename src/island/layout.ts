// Where things stand on the island. Shared by the scene (to place them) and
// the movement code (to walk around them).

export interface TreeSpot {
  kind: 'pine' | 'leafy';
  at: [number, number];
  scale: number;
}

// A new island starts with a few trees round the edge and a clear middle;
// everything else is grown by the people in the room (see the build shop).
export const TREES: TreeSpot[] = [
  { kind: 'pine', at: [3.5, -1], scale: 1.1 },
  { kind: 'leafy', at: [-4.6, 0.8], scale: 1 },
  { kind: 'leafy', at: [4.2, 2.4], scale: 0.9 },
  { kind: 'pine', at: [1.2, -4.6], scale: 1.2 },
  { kind: 'pine', at: [0.2, 5.0], scale: 1 },
  { kind: 'leafy', at: [4.6, -2.4], scale: 0.85 },
  { kind: 'pine', at: [-3.6, 3.6], scale: 1 },
];

export const BUSHES: { at: [number, number]; scale: number }[] = [
  { at: [3.4, 3.3], scale: 0.9 },
  { at: [-4.1, 2.2], scale: 0.8 },
  { at: [1.9, -3.6], scale: 1 },
];

export const TREE_SPOTS = TREES.map((t) => t.at);

/** Every island has a campfire in the middle to sit around during focus. */
export const STARTER_CAMPFIRE = { x: 0, z: 0, radius: 0.4, seatRadius: 1.0, seats: 6 };

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

/** Circles animals can't walk through: tree trunks and lower branches, bushes. */
export const OBSTACLES: Obstacle[] = [
  { x: STARTER_CAMPFIRE.x, z: STARTER_CAMPFIRE.z, r: STARTER_CAMPFIRE.radius },
  ...TREES.map(({ at: [x, z], scale }) => ({ x, z, r: 0.38 * scale })),
  ...BUSHES.map(({ at: [x, z], scale }) => ({ x, z, r: 0.32 * scale })),
];
