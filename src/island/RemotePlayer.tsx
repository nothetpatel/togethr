import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Avatar } from '../shared/types';
import { AnimalModel, nameTagHeight, type Motion } from './AnimalModel';
import { OBSTACLES } from './layout';
import { advanceRemote, type RemoteState } from './remote';
import { terrainHeight } from './terrain';

/** Someone else's animal, walking as their broadcasts say. Hidden until we hear from them. */
export function RemotePlayer({
  id,
  avatar,
  nickname,
  badge,
  remotes,
}: {
  id: string;
  avatar: Avatar;
  nickname: string;
  badge?: string;
  remotes: RefObject<Map<string, RemoteState>>;
}) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ speed: 0 });

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const r = remotes.current.get(id);
    g.visible = !!r;
    if (!r) return;
    advanceRemote(r, Math.min(rawDt, 0.05), OBSTACLES);
    motion.current.speed = r.speed;
    g.position.set(r.x, terrainHeight(r.x, r.z), r.z);
    g.rotation.y = r.heading;
  });

  return (
    <group ref={group} visible={false}>
      <AnimalModel animal={avatar.animal} accent={avatar.color} motion={motion} />
      <Html position={[0, nameTagHeight(avatar.animal), 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
        <div className="name-tag">
          {nickname}
          {badge && <span className="tag-badge">{badge}</span>}
        </div>
      </Html>
    </group>
  );
}
