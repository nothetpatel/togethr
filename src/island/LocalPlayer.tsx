import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Avatar } from '../shared/types';
import { AnimalModel, nameTagHeight, type Motion } from './AnimalModel';
import { OBSTACLES } from './layout';
import { stepTowards, turnTowards, WALK_SPEED, type Point } from './movement';
import { terrainHeight } from './terrain';

/** Where your animal is and where it's heading. Mutable, read every frame. */
export interface PlayerState {
  x: number;
  z: number;
  /** Facing angle in radians (0 = +z). */
  heading: number;
  target: Point | null;
}

const TURN_SPEED = 10; // radians per second
const CAMERA_FOLLOW = 2.5; // higher = snappier

/** Your own animal: walks to tapped spots, and the camera follows it. */
export function LocalPlayer({
  avatar,
  nickname,
  state,
}: {
  avatar: Avatar;
  nickname: string | null;
  state: RefObject<PlayerState>;
}) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ speed: 0 });
  const stuckFor = useRef(0);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const follow = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05); // don't teleport after a tab switch
    const st = state.current;
    let moving = false;

    if (st.target) {
      const { pos, arrived } = stepTowards([st.x, st.z], st.target, dt, OBSTACLES);
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

    motion.current.speed = THREE.MathUtils.damp(motion.current.speed, moving ? 1 : 0, 10, dt);

    const y = terrainHeight(st.x, st.z);
    group.current?.position.set(st.x, y, st.z);
    if (group.current) group.current.rotation.y = st.heading;

    // Slide the camera and its orbit centre along with the animal.
    if (controls) {
      const k = 1 - Math.exp(-CAMERA_FOLLOW * dt);
      follow.current.set(st.x, y + 0.4, st.z).sub(controls.target).multiplyScalar(k);
      controls.target.add(follow.current);
      camera.position.add(follow.current);
    }
  });

  return (
    <group ref={group}>
      <AnimalModel animal={avatar.animal} accent={avatar.color} motion={motion} />
      {nickname && (
        <Html position={[0, nameTagHeight(avatar.animal), 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
          <div className="name-tag">{nickname}</div>
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
