import * as THREE from 'three';

// The island's ground: an irregular coastline, gently rolling grass, and a
// beach that slopes down under the water. `terrainHeight` is the single
// source of truth for ground level, so plants, flowers and (in phase 3)
// walking animals all sit on the surface.

export const WATER_LEVEL = -0.32;
/** Average distance from the centre to the waterline. */
export const COAST_RADIUS = 7;
/** Width of the sand between the grass and the waterline. */
const BEACH_WIDTH = 0.85;

/** Distance from the centre to the waterline in a given direction (6.45–7.55). */
export function coastRadius(angle: number): number {
  return (
    COAST_RADIUS +
    0.3 * Math.sin(3 * angle + 1.0) +
    0.17 * Math.sin(5 * angle + 2.3) +
    0.08 * Math.sin(9 * angle + 0.4)
  );
}

function grassHeight(x: number, z: number): number {
  return (
    0.2 +
    0.12 * Math.sin(x * 0.55 + 0.3) * Math.cos(z * 0.5 - 0.7) +
    0.06 * Math.sin(x * 1.1 + z * 0.8) +
    0.015 * Math.sin(x * 3.1 - z * 2.7)
  );
}

/** Signed distance to the waterline: negative inland, positive out to sea. */
export function coastDistance(x: number, z: number): number {
  return Math.hypot(x, z) - coastRadius(Math.atan2(z, x));
}

export function terrainHeight(x: number, z: number): number {
  const d = coastDistance(x, z);
  // Grass blends into a beach that crosses the waterline at d ≈ 0 and keeps
  // sloping down under the sea.
  const t = THREE.MathUtils.smoothstep(d, -BEACH_WIDTH - 0.15, 0.9);
  return THREE.MathUtils.lerp(grassHeight(x, z), -0.85, t);
}

/** True where the ground is grass (not beach), with a margin in metres. */
export function isOnGrass(x: number, z: number, margin = 0): boolean {
  return coastDistance(x, z) < -BEACH_WIDTH - margin;
}

// ───────────── Mesh ─────────────

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in [0, 1], for colour patches. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), ux);
  const b = THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), ux);
  return THREE.MathUtils.lerp(a, b, uz);
}

const GRASS_DARK = new THREE.Color('#6aa957');
const GRASS_LIGHT = new THREE.Color('#a3d47c');
const GRASS_DRY = new THREE.Color('#b9cf7a');
const SAND_DRY = new THREE.Color('#efd8a5');
const SAND_WET = new THREE.Color('#c9b183');
const SAND_UNDER = new THREE.Color('#d9c493');

/** Ground mesh with vertex colours: patchy grass, dry sand, wet sand, seabed. */
export function terrainGeometry(): THREE.BufferGeometry {
  const size = 26;
  const segments = 180;
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('uv');

  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color();
  const sand = new THREE.Color();
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    // Grass: big light/dark patches, small speckle, a little drier on high ground.
    const patches = noise(x * 0.45 + 3.1, z * 0.45 - 1.7);
    const speckle = noise(x * 3.3, z * 3.3);
    grass.copy(GRASS_DARK).lerp(GRASS_LIGHT, THREE.MathUtils.smoothstep(patches, 0.2, 0.85));
    grass.lerp(GRASS_DRY, THREE.MathUtils.clamp((y - 0.22) * 4, 0, 0.5));
    grass.multiplyScalar(0.94 + 0.12 * speckle);

    // Sand: dry above the waterline, darker and wetter right at it, seabed below.
    const aboveWater = y - WATER_LEVEL;
    sand.copy(SAND_WET).lerp(SAND_DRY, THREE.MathUtils.smoothstep(aboveWater, 0.02, 0.18));
    if (aboveWater < 0) sand.copy(SAND_WET).lerp(SAND_UNDER, THREE.MathUtils.smoothstep(-aboveWater, 0, 0.2));
    sand.multiplyScalar(0.96 + 0.08 * speckle);

    // Ragged grass edge rather than a clean ring.
    const d = coastDistance(x, z);
    const edge = -BEACH_WIDTH + (noise(x * 1.7, z * 1.7) - 0.5) * 0.35;
    const toSand = THREE.MathUtils.smoothstep(d, edge - 0.08, edge + 0.08);
    c.copy(grass).lerp(sand, toSand);
    colors.set([c.r, c.g, c.b], i * 3);
  }

  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
