import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Flowers } from './Flowers';

// Placeholder island built from primitives. Phase 3 swaps these for CC0 glTF
// models and adds tap-to-move; the lighting and camera limits carry over.

const ISLAND_RADIUS = 6;

type Vec3 = [number, number, number];

function PineTree({ position, scale = 1, turn = 0 }: { position: Vec3; scale?: number; turn?: number }) {
  return (
    <group position={position} scale={scale} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.8, 6]} />
        <meshStandardMaterial color="#9c6b4a" flatShading />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <coneGeometry args={[0.65, 1.0, 7]} />
        <meshStandardMaterial color="#5fb87e" flatShading />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[0.45, 0.8, 7]} />
        <meshStandardMaterial color="#6cc28a" flatShading />
      </mesh>
    </group>
  );
}

function RoundTree({ position, scale = 1, turn = 0 }: { position: Vec3; scale?: number; turn?: number }) {
  return (
    <group position={position} scale={scale} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.7, 6]} />
        <meshStandardMaterial color="#9c6b4a" flatShading />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#8fd17a" flatShading />
      </mesh>
      <mesh position={[0.28, 0.85, 0.1]} castShadow>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color="#7cc66b" flatShading />
      </mesh>
    </group>
  );
}

function Bush({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <mesh position={[position[0], position[1] + 0.15 * scale, position[2]]} scale={scale} castShadow>
      <icosahedronGeometry args={[0.25, 0]} />
      <meshStandardMaterial color="#79c27a" flatShading />
    </mesh>
  );
}

// Trees ring the island and leave the middle open for walking around.
const TREES: { kind: 'pine' | 'round'; at: [number, number]; scale: number }[] = [
  { kind: 'pine', at: [-3, -2], scale: 1 },
  { kind: 'pine', at: [3.5, -1], scale: 1.1 },
  { kind: 'round', at: [-1.5, 3.5], scale: 0.9 },
  { kind: 'round', at: [-4.6, 0.8], scale: 1 },
  { kind: 'round', at: [4.2, 2.4], scale: 0.9 },
  { kind: 'pine', at: [1.2, -4.6], scale: 1.2 },
  { kind: 'round', at: [-2.2, -4.4], scale: 0.8 },
  { kind: 'pine', at: [2.8, 4.2], scale: 0.8 },
  { kind: 'pine', at: [0.2, 5.0], scale: 1 },
  { kind: 'pine', at: [-5.0, -1.6], scale: 0.7 },
  { kind: 'round', at: [4.6, -2.4], scale: 0.85 },
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

/** Low-poly sea: a grid whose vertices bob on overlapping sine waves. */
function Ocean() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(80, 80, 64, 64);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const rest = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3];
      const z = rest[i * 3 + 2];
      pos.setY(i, Math.sin(x * 0.35 + t * 1.1) * 0.1 + Math.cos(z * 0.3 + t * 0.8) * 0.08 + Math.sin((x + z) * 0.6 + t * 1.7) * 0.04);
    }
    pos.needsUpdate = true;
  });

  // flatShading derives normals per face in the shader, so no normal rebuild needed.
  return (
    <mesh geometry={geometry} position={[0, -0.45, 0]} receiveShadow>
      <meshStandardMaterial color="#7fd3e8" flatShading roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

/** White foam rings that swell out from the beach and fade, like waves lapping. */
function ShoreFoam() {
  const rings = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const phase = (clock.elapsedTime * 0.35 + i / rings.current.length) % 1;
      ring.scale.setScalar(1 + phase * 0.18);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - phase);
    });
  });

  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.3, 0]}
        >
          <ringGeometry args={[ISLAND_RADIUS + 0.95, ISLAND_RADIUS + 1.25, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </>
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
        position={[6, 10, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-radius={4}
      />

      <Ocean />
      <ShoreFoam />

      {/* Sand ring and grass top */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS + 0.6, ISLAND_RADIUS + 1, 0.4, 16]} />
        <meshStandardMaterial color="#f6e2b3" flatShading />
      </mesh>
      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS + 0.3, 0.3, 16]} />
        <meshStandardMaterial color="#9ad88a" flatShading />
      </mesh>

      <group position={[0, 0.15, 0]}>
        {TREES.map(({ kind, at: [x, z], scale }, i) =>
          kind === 'pine' ? (
            <PineTree key={i} position={[x, 0, z]} scale={scale} turn={i * 1.3} />
          ) : (
            <RoundTree key={i} position={[x, 0, z]} scale={scale} turn={i * 1.3} />
          ),
        )}
        {BUSHES.map(({ at: [x, z], scale }, i) => (
          <Bush key={i} position={[x, 0, z]} scale={scale} />
        ))}
        <Flowers avoid={TREE_SPOTS} />
        <PlaceholderBuddy position={[0, 0, 0]} color="#ffb5c8" />
        <PlaceholderBuddy position={[1.4, 0, 0.8]} color="#ffd59e" />
      </group>

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
