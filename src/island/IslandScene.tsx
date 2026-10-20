import { useMemo, type RefObject } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Avatar } from '../shared/types';
import { AnimalGallery } from './AnimalGallery';
import { Flowers } from './Flowers';
import { Plant } from './Foliage';
import { BUSHES, OBSTACLES, TREE_SPOTS, TREES } from './layout';
import { LocalPlayer, TapMarker, type PlayerState } from './LocalPlayer';
import { walkTarget } from './movement';
import type { RemoteState } from './remote';
import { RemotePlayer } from './RemotePlayer';
import { COAST_RADIUS, terrainGeometry, terrainHeight } from './terrain';
import { Water } from './Water';

// The island: rolling terrain (terrain.ts), procedural plants (Foliage.tsx),
// flowers (Flowers.tsx), sea (Water.tsx), your animal (LocalPlayer.tsx),
// which walks wherever you tap, and everyone else's (RemotePlayer.tsx).

export interface IslandPlayer {
  avatar: Avatar;
  /** Shown above the animal; null hides the name tag. */
  nickname: string | null;
  /** Small extra text in the name tag, e.g. to-do progress "2/5". */
  badge?: string;
}

export interface IslandOther {
  id: string;
  avatar: Avatar;
  nickname: string;
  badge?: string;
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

export function IslandScene({
  player,
  state,
  onMove,
  others = [],
  remotes,
}: {
  player: IslandPlayer | null;
  /** Your animal's position, owned by the app so it can be broadcast. */
  state: RefObject<PlayerState>;
  /** Called after you tap somewhere new. */
  onMove?: () => void;
  /** Other people in the room, and their live positions. */
  others?: IslandOther[];
  remotes?: RefObject<Map<string, RemoteState>>;
}) {
  function moveTo(x: number, z: number) {
    if (!player) return;
    state.current.target = walkTarget([x, z], OBSTACLES);
    onMove?.();
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
          <LocalPlayer avatar={player.avatar} nickname={player.nickname} badge={player.badge} state={state} />
          <TapMarker state={state} />
        </>
      )}
      {remotes &&
        others.map((o) => (
          <RemotePlayer key={o.id} id={o.id} avatar={o.avatar} nickname={o.nickname} badge={o.badge} remotes={remotes} />
        ))}

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
