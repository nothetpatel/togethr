import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Flowers } from './Flowers';
import { Plant } from './Foliage';
import { COAST_RADIUS, terrainGeometry, terrainHeight } from './terrain';
import { Water } from './Water';

// The island: rolling terrain (terrain.ts), procedural
// plants (Foliage.tsx), flowers (Flowers.tsx) and sea (Water.tsx). Phase 3
// swaps the placeholder buddies for 3D animals and adds tap-to-move; the
// lighting and camera limits carry over.

const SUN_POSITION: [number, number, number] = [6, 10, 4];

type Vec3 = [number, number, number];

// Trees ring the island and leave the middle open for walking around.
const TREES: { kind: 'pine' | 'leafy'; at: [number, number]; scale: number }[] = [
  { kind: 'pine', at: [-3, -2], scale: 1 },
  { kind: 'pine', at: [3.5, -1], scale: 1.1 },
  { kind: 'leafy', at: [-1.5, 3.5], scale: 0.9 },
  { kind: 'leafy', at: [-4.6, 0.8], scale: 1 },
  { kind: 'leafy', at: [4.2, 2.4], scale: 0.9 },
  { kind: 'pine', at: [1.2, -4.6], scale: 1.2 },
  { kind: 'leafy', at: [-2.2, -4.4], scale: 0.8 },
  { kind: 'pine', at: [2.8, 4.2], scale: 0.8 },
  { kind: 'pine', at: [0.2, 5.0], scale: 1 },
  { kind: 'pine', at: [-5.0, -1.6], scale: 0.7 },
  { kind: 'leafy', at: [4.6, -2.4], scale: 0.85 },
  { kind: 'pine', at: [-3.6, 3.6], scale: 1 },
  { kind: 'pine', at: [-0.6, -3.4], scale: 0.75 },
];

const TREE_SPOTS = TREES.map((t) => t.at);

const BUSHES:{ at: [number, number]; scale: number }[] = [
  { at: [-2.4, -1.4], scale: 1 },
  { at: [2.6, -0.4], scale: 0.8 },
  { at: [-0.8, 2.9], scale: 1.1 },
  { at: [3.4, 3.3], scale: 0.9 },
  { at: [-4.1, 2.2], scale: 0.8 },
  { at: [1.9, -3.6], scale: 1 },
];

/** A ground point, sunk slightly so trunks and bases don't float on slopes. */
function ground(x: number, z: number, sink = 0.03): Vec3 {
  return [x, terrainHeight(x, z) - sink, z];
}

function Terrain() {
  const geometry = useMemo(terrainGeometry, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function PlaceholderBuddy({ position, color }: { position: Vec3; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.3, 4, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]} castShadow>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

export function IslandScene() {
  return (
    <Canvas
      className="scene"
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [9, 9, 11], fov: 40 }}
    >
      <hemisphereLight args={['#fff4e6', '#7ab8d9', 0.9]} />
      <directionalLight
        position={SUN_POSITION}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-radius={4}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      <Water islandRadius={COAST_RADIUS} sunPosition={SUN_POSITION} />
      <Terrain />

      {TREES.map(({ kind, at: [x, z], scale }, i) => (
        <Plant key={i} kind={kind} seed={i + 1} position={ground(x, z, 0.06)} scale={scale} />
      ))}
      {BUSHES.map(({ at: [x, z], scale }, i) => (
        <Plant key={i} kind="bush" seed={i + 101} position={ground(x, z, 0.05)} scale={scale} />
      ))}
      <Flowers avoid={TREE_SPOTS} />
      <PlaceholderBuddy position={ground(0, 0)} color="#ffb5c8" />
      <PlaceholderBuddy position={ground(1.4, 0.8)} color="#ffd59e" />

      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={22}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.6}
      />
    </Canvas>
  );
}
