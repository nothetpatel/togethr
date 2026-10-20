import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from './random';
import { isOnGrass, terrainHeight } from './terrain';

// Tulips, roses and little daisies in patches around the island. Each part
// (stems, leaves, tulip cups, rose heads, daisy petals, daisy centres) is one
// instanced mesh, so hundreds of flowers cost a handful of draw calls.

type Kind = 'tulip' | 'rose' | 'daisy';

interface Flower {
  kind: Kind;
  x: number;
  z: number;
  /** Ground height at (x, z). */
  ground: number;
  color: string;
  turn: number;
  scale: number;
}

const PALETTE: Record<Kind, string[]> = {
  tulip: ['#ff5c7a', '#ff8f3c', '#ffc94a', '#b56cf0', '#e8304f', '#ffffff'],
  rose: ['#d7263d', '#f2557f', '#ffadc4', '#b0182e'],
  daisy: ['#ffffff', '#f4f0ff', '#d9e8ff', '#fff6cf'],
};

const STEM_HEIGHT: Record<Kind, number> = { tulip: 0.3, rose: 0.24, daisy: 0.13 };

// ───────────── Shapes ─────────────

/** Spins a side profile into a cup, then shapes lobes (petals) into its rim. */
function cup(profile: [number, number][], lobes: number, lobeDepth: number, tipLift: number, offset = 0) {
  const g = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  );
  const height = profile[profile.length - 1][1];
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = y / height;
    const wave = Math.cos(Math.atan2(z, x) * lobes + offset);
    const f = 1 + lobeDepth * wave * k;
    pos.setXYZ(i, x * f, y + tipLift * wave * k * k, z * f);
  }
  g.computeVertexNormals();
  return g;
}

const tulipHead = cup(
  [[0, 0], [0.025, 0.006], [0.046, 0.03], [0.056, 0.065], [0.05, 0.105], [0.04, 0.135]],
  3,
  0.14,
  0.018,
);

const roseHead = mergeGeometries([
  // Tight bud in the middle.
  cup([[0, 0], [0.02, 0.01], [0.028, 0.035], [0.02, 0.055], [0.004, 0.062]], 3, 0.1, 0.004),
  // Two looser rings of petals, offset so their lobes don't line up.
  cup([[0, 0], [0.03, 0.006], [0.046, 0.022], [0.052, 0.045]], 5, 0.14, 0.008, 0.6),
  cup([[0, 0], [0.04, 0.004], [0.06, 0.015], [0.07, 0.032]], 5, 0.16, 0.01, 1.9),
])!;

const daisyPetals = mergeGeometries(
  Array.from({ length: 12 }, (_, i) => {
    const petal = new THREE.CircleGeometry(1, 8);
    petal.rotateX(-Math.PI / 2);
    petal.scale(0.045, 1, 0.013);
    petal.translate(0.045, 0, 0);
    petal.rotateZ(0.18); // tips curl up a little
    petal.rotateY((i / 12) * Math.PI * 2);
    return petal;
  }),
)!;

const daisyCentre = new THREE.SphereGeometry(0.022, 12, 6).scale(1, 0.55, 1);

/** A narrow leaf that grows up from its base and arches outward. */
const leaf = (() => {
  const g = new THREE.PlaneGeometry(0.04, 0.2, 1, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + 0.1) / 0.2; // 0 at base, 1 at tip
    const width = Math.sin(Math.PI * (0.12 + 0.88 * t)) * (1 - t * 0.35);
    pos.setXYZ(i, pos.getX(i) * width, t * 0.2, t * t * 0.08);
  }
  g.computeVertexNormals();
  return g;
})();

// ───────────── Placement ─────────────

/**
 * Places flower patches in a ring between the open middle (kept clear for
 * walking) and the beach, skipping spots too close to trees.
 */
export function scatterFlowers(avoid: [number, number][], seed = 7): Flower[] {
  const rand = seededRandom(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const flowers: Flower[] = [];
  const add = (kind: Kind, x: number, z: number) => {
    if (Math.hypot(x, z) < 2.2 || !isOnGrass(x, z, 0.1)) return;
    if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 0.55)) return;
    flowers.push({ kind, x, z, ground: terrainHeight(x, z) - 0.01, color: pick(PALETTE[kind]), turn: rand() * Math.PI * 2, scale: 1.1 + rand() * 0.6 });
  };

  // Patches of a single kind, like little garden beds.
  const kinds: Kind[] = ['tulip', 'rose', 'daisy'];
  const patches = 7;
  for (let p = 0; p < patches; p++) {
    const angle = (p / patches) * Math.PI * 2 + rand() * 0.3;
    const radius = 2.6 + rand() * 2.8;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const count = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) add(kinds[p % 3], cx + (rand() - 0.5) * 1.1, cz + (rand() - 0.5) * 1.1);
  }

  // A sprinkle of daisies along the edge of the grass.
  for (let i = 0; i < 20; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 5.0 + rand() * 1.0;
    add('daisy', Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  return flowers;
}

// ───────────── Rendering ─────────────

export function Flowers({ avoid }: { avoid: [number, number][] }) {
  const flowers = useMemo(() => scatterFlowers(avoid), [avoid]);
  const tulips = flowers.filter((f) => f.kind === 'tulip');
  const roses = flowers.filter((f) => f.kind === 'rose');
  const daisies = flowers.filter((f) => f.kind === 'daisy');
  const top = (f: Flower) => STEM_HEIGHT[f.kind] * f.scale;

  // Tulips get two long leaves, roses one small one partway up the stem.
  const leaves = [
    ...tulips.flatMap((f) => [0, Math.PI].map((side) => ({ f, y: 0, turn: f.turn + side, size: f.scale }))),
    ...roses.map((f) => ({ f, y: top(f) * 0.4, turn: f.turn, size: f.scale * 0.5 })),
  ];

  return (
    <group>
      <Instances limit={flowers.length}>
        <cylinderGeometry args={[0.01, 0.013, 1, 5]} />
        <meshStandardMaterial color="#3f8a4a" roughness={0.8} />
        {flowers.map((f, i) => (
          <Instance key={i} position={[f.x, f.ground + (top(f) / 2), f.z]} scale={[1, top(f), 1]} />
        ))}
      </Instances>

      <Instances limit={Math.max(1, leaves.length)} geometry={leaf}>
        <meshStandardMaterial color="#4f9b52" roughness={0.75} side={THREE.DoubleSide} />
        {leaves.map(({ f, y, turn, size }, i) => (
          <Instance key={i} position={[f.x, f.ground + y, f.z]} rotation={[0, turn, 0]} scale={size} />
        ))}
      </Instances>

      <Instances limit={Math.max(1, tulips.length)} geometry={tulipHead}>
        <meshStandardMaterial roughness={0.5} side={THREE.DoubleSide} />
        {tulips.map((f, i) => (
          <Instance key={i} position={[f.x, f.ground + (top(f) - 0.01), f.z]} rotation={[0, f.turn, 0]} scale={f.scale} color={f.color} />
        ))}
      </Instances>

      <Instances limit={Math.max(1, roses.length)} geometry={roseHead}>
        <meshStandardMaterial roughness={0.55} side={THREE.DoubleSide} />
        {roses.map((f, i) => (
          <Instance key={i} position={[f.x, f.ground + (top(f) - 0.005), f.z]} rotation={[0, f.turn, 0]} scale={f.scale} color={f.color} />
        ))}
      </Instances>

      <Instances limit={Math.max(1, daisies.length)} geometry={daisyPetals}>
        <meshStandardMaterial roughness={0.6} side={THREE.DoubleSide} />
        {daisies.map((f, i) => (
          <Instance key={i} position={[f.x, f.ground + top(f), f.z]} rotation={[0, f.turn, 0]} scale={f.scale} color={f.color} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, daisies.length)} geometry={daisyCentre}>
        <meshStandardMaterial color="#f2b705" roughness={0.7} />
        {daisies.map((f, i) => (
          <Instance key={i} position={[f.x, f.ground + (top(f) + 0.004), f.z]} scale={f.scale} />
        ))}
      </Instances>
    </group>
  );
}
