import { useRef, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Avatar } from '../shared/types';
import { AnimalModel, nameTagHeight, type Motion } from './AnimalModel';
import type { Floating } from './IslandScene';
import { OBSTACLES, type Obstacle } from './layout';
import { advanceRemote, type RemoteState } from './remote';
import { turnTowards } from './movement';
import { seatAt, type Seat } from './seats';
import { terrainHeight } from './terrain';

/** Someone else's animal, walking as their broadcasts say. Hidden until we hear from them. */
export function RemotePlayer({
  id,
  avatar,
  nickname,
  badge,
  goal,
  floating = [],
  onTap,
  remotes,
  obstacles = OBSTACLES,
  seats = [],
  focusing = false,
}: {
  id: string;
  avatar: Avatar;
  nickname: string;
  badge?: string;
  goal?: string;
  floating?: Floating[];
  onTap?: (id: string) => void;
  remotes: RefObject<Map<string, RemoteState>>;
  obstacles?: Obstacle[];
  /** During focus, an animal resting in one of these is drawn sitting. */
  seats?: Seat[];
  focusing?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ speed: 0 });

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const r = remotes.current.get(id);
    g.visible = !!r;
    if (!r) return;
    const dt = Math.min(rawDt, 0.05);
    advanceRemote(r, dt, obstacles);
    motion.current.speed = r.speed;
    const seat = focusing && !r.target ? seatAt(r.x, r.z, seats, 0.25) : null;
    if (seat) r.heading = turnTowards(r.heading, seat.heading, 6 * dt);
    motion.current.sit = THREE.MathUtils.damp(motion.current.sit ?? 0, seat ? 1 : 0, 6, dt);
    g.position.set(r.x, terrainHeight(r.x, r.z), r.z);
    g.rotation.y = r.heading;
  });

  return (
    <group
      ref={group}
      visible={false}
      onClick={
        onTap &&
        ((e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation(); // tapping them shouldn't also walk you there
          onTap(id);
        })
      }
    >
      <AnimalModel animal={avatar.animal} accent={avatar.color} motion={motion} />
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
    </group>
  );
}
