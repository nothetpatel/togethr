import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Avatar } from '../shared/types';
import { AnimalModel, nameTagHeight, type Motion } from './AnimalModel';
import type { Floating } from './IslandScene';
import { OBSTACLES, type Obstacle } from './layout';
import { stepTowards, turnTowards, walkTarget, WALK_SPEED, type Point } from './movement';
import { SEAT_SNAP, type Seat } from './seats';
import { terrainHeight } from './terrain';

/** Where your animal is and where it's heading. Mutable, read every frame. */
export interface PlayerState {
  x: number;
  z: number;
  /** Facing angle in radians (0 = +z). */
  heading: number;
  target: Point | null;
  /** The seat you're heading to or sitting in during focus, if any. */
  seat: Seat | null;
}

/** A starting spot near the middle, different for each player so nobody stacks up. */
export function spawnState(playerId: string | null): PlayerState {
  let hash = 0;
  for (const ch of playerId ?? '') hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180);
  const [x, z] = walkTarget([Math.cos(angle) * 1.4, Math.sin(angle) * 1.4], OBSTACLES);
  return { x, z, heading: angle + Math.PI, target: null, seat: null }; // facing the middle
}

const TURN_SPEED = 10; // radians per second
const CAMERA_FOLLOW = 2.5; // higher = snappier
/**
 * The camera aims this far beyond your animal, which puts the animal lower on
 * screen, below the cards along the top.
 */
const LOOK_AHEAD = 1.4;

/** Your own animal: walks to tapped spots, and the camera follows it. */
export function LocalPlayer({
  avatar,
  nickname,
  badge,
  goal,
  floating = [],
  state,
  obstacles = OBSTACLES,
  onSat,
}: {
  avatar: Avatar;
  nickname: string | null;
  badge?: string;
  goal?: string;
  floating?: Floating[];
  state: RefObject<PlayerState>;
  /** What to walk around: the island's trees plus anything built. */
  obstacles?: Obstacle[];
  /** Called once each time your animal settles into a seat. */
  onSat?: () => void;
}) {
  const wasSitting = useRef(false);
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ speed: 0 });
  const stuckFor = useRef(0);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const follow = useRef(new THREE.Vector3());
  const ahead = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05); // don't teleport after a tab switch
    const st = state.current;
    let moving = false;

    if (st.target) {
      const { pos, arrived } = stepTowards([st.x, st.z], st.target, dt, obstacles);
      const dx = pos[0] - st.x;
      const dz = pos[1] - st.z;
      const moved = Math.hypot(dx, dz);
      if (moved > 1e-4) {
        st.heading = turnTowards(st.heading, Math.atan2(dx, dz), TURN_SPEED * dt);
        moving = true;
      }
      st.x = pos[0];
      st.z = pos[1];

      // Give up if wedged against something rather than shuffling forever.
      stuckFor.current = moved < WALK_SPEED * dt * 0.2 ? stuckFor.current + dt : 0;
      if (arrived || stuckFor.current > 0.6) {
        st.target = null;
        stuckFor.current = 0;
      }
    }

    // Heading for a seat: once close, glide the last bit (it may be tucked
    // against a bench or desk) and turn to face the right way.
    let sitting = false;
    if (!st.target && st.seat) {
      const d = Math.hypot(st.seat.x - st.x, st.seat.z - st.z);
      if (d < SEAT_SNAP) {
        const k = 1 - Math.exp(-8 * dt);
        st.x += (st.seat.x - st.x) * k;
        st.z += (st.seat.z - st.z) * k;
        st.heading = turnTowards(st.heading, st.seat.heading, TURN_SPEED * 0.6 * dt);
        sitting = d < 0.08;
      } else {
        st.seat = null; // couldn't get there; stay standing
      }
    }
    if (sitting && !wasSitting.current) onSat?.();
    wasSitting.current = sitting;

    motion.current.speed = THREE.MathUtils.damp(motion.current.speed, moving ? 1 : 0, 10, dt);
    motion.current.sit = THREE.MathUtils.damp(motion.current.sit ?? 0, sitting ? 1 : 0, 6, dt);

    const y = terrainHeight(st.x, st.z);
    group.current?.position.set(st.x, y, st.z);
    if (group.current) group.current.rotation.y = st.heading;

    // Slide the camera and its orbit centre along with the animal.
    if (controls) {
      const k = 1 - Math.exp(-CAMERA_FOLLOW * dt);
      // "Beyond" = further along the camera's view, flattened to the ground.
      ahead.current.copy(controls.target).sub(camera.position).setY(0).normalize().multiplyScalar(LOOK_AHEAD);
      follow.current
        .set(st.x + ahead.current.x, y + 0.4, st.z + ahead.current.z)
        .sub(controls.target)
        .multiplyScalar(k);
      controls.target.add(follow.current);
      camera.position.add(follow.current);
    }
  });

  return (
    <group ref={group}>
      <AnimalModel animal={avatar.animal} accent={avatar.color} motion={motion} />
      {nickname && (
        <Html position={[0, nameTagHeight(avatar.animal), 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
          <div className="tag-stack">
            {floating.map((f) => (
            <span key={f.id} className="floating-emoji">
              {f.emoji}
            </span>
          ))}
          {goal && <div className="goal-bubble">🎯 {goal}</div>}
            <div className="name-tag">
              {nickname}
              {badge && <span className="tag-badge">{badge}</span>}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** A soft ring that pulses where you tapped, until you get there. */
export function TapMarker({ state }: { state: RefObject<PlayerState> }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const m = mesh.current;
    const target = state.current.target;
    if (!m) return;
    m.visible = !!target;
    if (!target) return;
    m.position.set(target[0], terrainHeight(target[0], target[1]) + 0.02, target[1]);
    const pulse = (clock.elapsedTime * 1.6) % 1;
    m.scale.setScalar(0.6 + pulse * 0.6);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - pulse);
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.16, 0.22, 32]} />
      <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
    </mesh>
  );
}
