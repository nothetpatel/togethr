import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ItemKind } from '../shared/catalog';
import type { Avatar, RoomItem } from '../shared/types';
import { AnimalGallery } from './AnimalGallery';
import { Flowers } from './Flowers';
import { Plant } from './Foliage';
import { BUSHES, TREE_SPOTS, TREES } from './layout';
import { LocalPlayer, TapMarker, type PlayerState } from './LocalPlayer';
import { walkTarget } from './movement';
import { PlacedItems, PlacementGhost } from './PlacedItems';
import { obstaclesWith } from './placement';
import { idSeed, ItemModel } from './ItemModels';
import { allSeats, assignSeats } from './seats';
import type { RemoteState } from './remote';
import { RemotePlayer } from './RemotePlayer';
import { isWebKit } from './device';
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
  /** Goal for the focus round in progress, shown as a speech bubble. */
  goal?: string;
  /** Emoji floating up above the animal right now. */
  floating?: Floating[];
}

export interface Floating {
  id: number;
  emoji: string;
}

/** Build mode, driven by the app. While on, taps don't walk your animal. */
export interface IslandBuild {
  /** An item following the pointer, waiting to be placed (null in the shop). */
  ghost: {
    kind: ItemKind;
    rotation: number;
    /** Where the preview is, once the pointer has touched the island. */
    at: [number, number] | null;
    /** True if it can go there. */
    fits: boolean;
  } | null;
  /** Set when moving an existing item (it's hidden while its preview moves). */
  movingId?: string;
}

export interface IslandOther {
  id: string;
  avatar: Avatar;
  nickname: string;
  badge?: string;
  goal?: string;
  floating?: Floating[];
}

const SHOW_GALLERY = import.meta.env.DEV && new URLSearchParams(location.search).has('gallery');

/** Taps that move less than this many pixels count as taps, not camera drags. */
const TAP_SLOP = 8;

/** Soft shadows, except where WebKit renders them wrongly (see device.ts). */
const SHADOW_MODE = isWebKit() ? ('basic' as const) : true;

/** Distance from the camera to what it looks at, on a landscape screen. */
const BASE_DISTANCE = Math.hypot(9, 9, 11);

const SUN_POSITION: [number, number, number] = [6, 10, 4];

type Vec3 = [number, number, number];

/** A ground point, sunk slightly so trunks and bases don't float on slopes. */
function ground(x: number, z: number, sink = 0.03): Vec3 {
  return [x, terrainHeight(x, z) - sink, z];
}

/**
 * Tall phone screens crop the island at the desktop framing, so widen the view
 * and pull back a little as the screen gets narrower. Only reacts to shape
 * changes (rotating the phone), not to the person zooming.
 */
function FitCameraToScreen() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const portrait = Math.round(THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1) * 10) / 10;

  useEffect(() => {
    camera.fov = 40 + 16 * portrait;
    camera.updateProjectionMatrix();
    const target = controls?.target ?? new THREE.Vector3();
    const offset = camera.position.clone().sub(target);
    offset.setLength(BASE_DISTANCE * (1 + 0.15 * portrait));
    camera.position.copy(target).add(offset);
  }, [camera, controls, portrait]);

  return null;
}

/** Daylight, or a warm golden-hour glow (during breaks), easing between the two. */
function Lighting({ golden }: { golden: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const mix = useRef(golden ? 1 : 0);
  const colors = useMemo(
    () => ({
      sky: [new THREE.Color('#fff4e6'), new THREE.Color('#ffc9a0')],
      ground: [new THREE.Color('#7ab8d9'), new THREE.Color('#c98a6a')],
      sun: [new THREE.Color('#ffffff'), new THREE.Color('#ffaa66')],
    }),
    [],
  );

  useFrame((_, dt) => {
    mix.current = THREE.MathUtils.damp(mix.current, golden ? 1 : 0, 0.8, dt);
    const k = mix.current;
    if (hemi.current) {
      hemi.current.color.copy(colors.sky[0]).lerp(colors.sky[1], k);
      hemi.current.groundColor.copy(colors.ground[0]).lerp(colors.ground[1], k);
      hemi.current.intensity = 0.9 + 0.05 * k;
    }
    if (sun.current) {
      sun.current.color.copy(colors.sun[0]).lerp(colors.sun[1], k);
      sun.current.intensity = 1.6 - 0.1 * k;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff4e6', '#7ab8d9', 0.9]} />
      <directionalLight
        ref={sun}
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
    </>
  );
}

function Terrain({
  onTap,
  onHover,
}: {
  onTap: (x: number, z: number) => void;
  onHover?: (x: number, z: number) => void;
}) {
  const geometry = useMemo(terrainGeometry, []);
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > TAP_SLOP) return; // the camera was being dragged
    onTap(e.point.x, e.point.z);
  };
  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={handleClick}
      onPointerMove={onHover && ((e: ThreeEvent<PointerEvent>) => onHover(e.point.x, e.point.z))}
    >
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
  items = [],
  build = null,
  onBuildPoint,
  onItemTap,
  focusSession = null,
  myId = null,
  onlineIds = [],
  onOtherTap,
  golden = false,
}: {
  player: IslandPlayer | null;
  /** Your animal's position, owned by the app so it can be broadcast. */
  state: RefObject<PlayerState>;
  /** Called after you tap somewhere new. */
  onMove?: () => void;
  /** Other people in the room, and their live positions. */
  others?: IslandOther[];
  remotes?: RefObject<Map<string, RemoteState>>;
  /** Things built on this room's island. */
  items?: RoomItem[];
  /** While set, taps move the build preview instead of your animal. */
  build?: IslandBuild | null;
  onBuildPoint?: (x: number, z: number) => void;
  /** Tapping a built item while in build mode. */
  onItemTap?: (item: RoomItem) => void;
  /** The focus round in progress (null when not focusing): everyone sits together. */
  focusSession?: string | null;
  myId?: string | null;
  /** Everyone in the room right now (including you), for sharing out seats. */
  onlineIds?: string[];
  /** Tapping someone else's animal (to send them a reaction). */
  onOtherTap?: (id: string) => void;
  /** Warm golden-hour light (during breaks). */
  golden?: boolean;
}) {
  const obstacles = useMemo(() => obstaclesWith(items), [items]);
  const seats = useMemo(() => allSeats(items), [items]);

  // When a focus round starts, walk to your seat; when it ends, stand up.
  const seatInputs = useMemo(() => ({ seats, onlineIds, obstacles }), [seats, onlineIds, obstacles]);
  const latestSeatInputs = useRef(seatInputs);
  latestSeatInputs.current = seatInputs;
  useEffect(() => {
    const st = state.current;
    if (!focusSession || !myId || !player) {
      st.seat = null;
      return;
    }
    const { seats, onlineIds, obstacles } = latestSeatInputs.current;
    const seat = assignSeats([...new Set([...onlineIds, myId])], seats).get(myId);
    if (!seat) return;
    st.seat = seat;
    st.target = walkTarget([seat.x, seat.z], obstacles);
    onMove?.();
    // Only when a new round starts (or you arrive mid-round), not on every change.
  }, [focusSession, myId, !!player]);

  function tap(x: number, z: number) {
    if (build) {
      onBuildPoint?.(x, z);
      return;
    }
    if (!player) return;
    state.current.seat = null; // tapping away gets up from your seat
    state.current.target = walkTarget([x, z], obstacles);
    onMove?.();
  }

  return (
    <Canvas
      className="scene"
      shadows={SHADOW_MODE}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [9, 9, 11], fov: 40 }}
    >
      <Lighting golden={golden} />

      <Water islandRadius={COAST_RADIUS} sunPosition={SUN_POSITION} golden={golden} />
      <Terrain onTap={tap} onHover={build ? onBuildPoint : undefined} />
      {/* Every island's campfire, to sit round during focus. */}
      <group position={[0, terrainHeight(0, 0) - 0.02, 0]}>
        <ItemModel kind="campfire" seed={idSeed('starter')} />
      </group>
      <PlacedItems items={items} hiddenId={build?.movingId} onTap={build ? onItemTap : undefined} />
      {build?.ghost?.at && (
        <PlacementGhost
          kind={build.ghost.kind}
          x={build.ghost.at[0]}
          z={build.ghost.at[1]}
          rotation={build.ghost.rotation}
          fits={build.ghost.fits}
        />
      )}

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
          <LocalPlayer
            avatar={player.avatar}
            nickname={player.nickname}
            badge={player.badge}
            goal={player.goal}
            floating={player.floating}
            state={state}
            obstacles={obstacles}
            onSat={onMove}
          />
          <TapMarker state={state} />
        </>
      )}
      {remotes &&
        others.map((o) => (
          <RemotePlayer
            key={o.id}
            id={o.id}
            avatar={o.avatar}
            nickname={o.nickname}
            badge={o.badge}
            goal={o.goal}
            floating={o.floating}
            onTap={build ? undefined : onOtherTap}
            remotes={remotes}
            obstacles={obstacles}
            seats={seats}
            focusing={!!focusSession}
          />
        ))}

      <FitCameraToScreen />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={24}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.6}
      />
    </Canvas>
  );
}
