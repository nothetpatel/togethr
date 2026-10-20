import { useMemo, useRef } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Avatar } from '../shared/types';
import { AnimalGallery } from './AnimalGallery';
import { Flowers } from './Flowers';
import { Plant } from './Foliage';
import { BUSHES, OBSTACLES, TREE_SPOTS, TREES } from './layout';
import { LocalPlayer, TapMarker, type PlayerState } from './LocalPlayer';
import { walkTarget } from './movement';
import { COAST_RADIUS, terrainGeometry, terrainHeight } from './terrain';
import { Water } from './Water';

// The island: rolling terrain (terrain.ts), procedural plants (Foliage.tsx),
// flowers (Flowers.tsx), sea (Water.tsx), and your animal (LocalPlayer.tsx),
// which walks wherever you tap.

export interface IslandPlayer {
  avatar: Avatar;
  /** Shown above the animal; null hides the name tag. */
  nickname: string | null;
}

const SHOW_GALLERY = import.meta.env.DEV && new URLSearchParams(location.search).has('gallery');

/** Taps that move less than this many pixels count as taps, not camera drags. */
const TAP_SLOP = 8;

const SUN_POSITION: [number, number, number] = [6, 10, 4];

type Vec3 = [number, number, number];

/** A ground point, sunk slightly so trunks and bases don't float on slopes. */
function ground(x: number, z: number, sink = 0.03): Vec3 {
  return [x, terrainHeight(x, z) - sink, z];
}

function Terrain({ onTap }: { onTap: (x: number, z: number) => void }) {
  const geometry = useMemo(terrainGeometry, []);
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > TAP_SLOP) return; // the camera was being dragged
    onTap(e.point.x, e.point.z);
  };
  return (
    <mesh geometry={geometry} receiveShadow onClick={handleClick}>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

export function IslandScene({ player }: { player: IslandPlayer | null }) {
  const state = useRef<PlayerState>(
    (() => {
      const [x, z] = walkTarget([0.4, 0.6], OBSTACLES);
      return { x, z, heading: 0.6, target: null };
    })(),
  );

  function moveTo(x: number, z: number) {
    if (player) state.current.target = walkTarget([x, z], OBSTACLES);
  }

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
      <Terrain onTap={moveTo} />

      {TREES.map(({ kind, at: [x, z], scale }, i) => (
        <Plant key={i} kind={kind} seed={i + 1} position={ground(x, z, 0.06)} scale={scale} />
      ))}
      {BUSHES.map(({ at: [x, z], scale }, i) => (
        <Plant key={i} kind="bush" seed={i + 101} position={ground(x, z, 0.05)} scale={scale} />
      ))}
      <Flowers avoid={TREE_SPOTS} />
      {SHOW_GALLERY && <AnimalGallery />}
      {player && !SHOW_GALLERY && (
        <>
          <LocalPlayer avatar={player.avatar} nickname={player.nickname} state={state} />
          <TapMarker state={state} />
        </>
      )}

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={22}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.6}
      />
    </Canvas>
  );
}
