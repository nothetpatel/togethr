import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';

// Tulips, roses and little daisies in patches around the island. Each part
// (stems, tulip cups, rose buds, daisy petals, daisy centres) is one instanced
// mesh, so hundreds of flowers cost five draw calls.

type Kind = 'tulip' | 'rose' | 'daisy';

interface Flower {
  kind: Kind;
  x: number;
  z: number;
  color: string;
  turn: number;
  scale: number;
}

const PALETTE: Record<Kind, string[]> = {
  tulip: ['#ff6b8b', '#ff9f43', '#ffd166', '#c77dff', '#ff4d6d'],
  rose: ['#e63946', '#ff5d8f', '#ffb3c6'],
  daisy: ['#ffffff', '#bde0fe', '#e0c3fc', '#fff3b0'],
};

const STEM_HEIGHT: Record<Kind, number> = { tulip: 0.3, rose: 0.22, daisy: 0.12 };

/** Small seeded PRNG so the island looks the same for everyone. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Places flower patches in a ring between the open middle (kept clear for
 * walking) and the beach, skipping spots too close to trees.
 */
export function scatterFlowers(avoid: [number, number][], seed = 7): Flower[] {
  const rand = mulberry32(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const flowers: Flower[] = [];
  const add = (kind: Kind, x: number, z: number) => {
    const r = Math.hypot(x, z);
    if (r < 2.2 || r > 5.7) return;
    if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 0.55)) return;
    flowers.push({ kind, x, z, color: pick(PALETTE[kind]), turn: rand() * Math.PI * 2, scale: 1.1 + rand() * 0.6 });
  };

  // Patches of a single kind, like little garden beds.
  const kinds: Kind[] = ['tulip', 'rose', 'daisy'];
  const patches = 15;
  for (let p = 0; p < patches; p++) {
    const angle = (p / patches) * Math.PI * 2 + rand() * 0.3;
    const radius = 2.6 + rand() * 2.8;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const count = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) add(kinds[p % 3], cx + (rand() - 0.5) * 1.1, cz + (rand() - 0.5) * 1.1);
  }

  // A sprinkle of daisies along the edge of the grass.
  for (let i = 0; i < 40; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 5.1 + rand() * 0.55;
    add('daisy', Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  return flowers;
}

export function Flowers({ avoid }: { avoid: [number, number][] }) {
  const flowers = useMemo(() => scatterFlowers(avoid), [avoid]);
  const tulips = flowers.filter((f) => f.kind === 'tulip');
  const roses = flowers.filter((f) => f.kind === 'rose');
  const daisies = flowers.filter((f) => f.kind === 'daisy');
  const top = (f: Flower) => STEM_HEIGHT[f.kind] * f.scale;

  return (
    <group>
      <Instances limit={flowers.length}>
        <cylinderGeometry args={[0.012, 0.014, 1, 4]} />
        <meshStandardMaterial color="#4f9d5d" />
        {flowers.map((f, i) => (
          <Instance key={i} position={[f.x, top(f) / 2, f.z]} scale={[1, top(f), 1]} />
        ))}
      </Instances>

      {/* Tulips: a cup that's wider at the top */}
      <Instances limit={Math.max(1, tulips.length)}>
        <cylinderGeometry args={[0.065, 0.035, 0.12, 6]} />
        <meshStandardMaterial flatShading />
        {tulips.map((f, i) => (
          <Instance key={i} position={[f.x, top(f) + 0.05 * f.scale, f.z]} rotation={[0, f.turn, 0]} scale={f.scale} color={f.color} />
        ))}
      </Instances>

      {/* Roses: a faceted bud */}
      <Instances limit={Math.max(1, roses.length)}>
        <dodecahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial flatShading />
        {roses.map((f, i) => (
          <Instance key={i} position={[f.x, top(f) + 0.04 * f.scale, f.z]} rotation={[f.turn, f.turn, 0]} scale={f.scale} color={f.color} />
        ))}
      </Instances>

      {/* Daisies: a flat ring of petals with a yellow centre */}
      <Instances limit={Math.max(1, daisies.length)}>
        <cylinderGeometry args={[0.06, 0.06, 0.012, 7]} />
        <meshStandardMaterial flatShading />
        {daisies.map((f, i) => (
          <Instance key={i} position={[f.x, top(f), f.z]} rotation={[0, f.turn, 0]} scale={f.scale} color={f.color} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, daisies.length)}>
        <sphereGeometry args={[0.024, 6, 4]} />
        <meshStandardMaterial color="#ffc93c" />
        {daisies.map((f, i) => (
          <Instance key={i} position={[f.x, top(f) + 0.01, f.z]} scale={f.scale} />
        ))}
      </Instances>
    </group>
  );
}
