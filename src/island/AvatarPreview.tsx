import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Avatar } from '../shared/types';
import { AnimalModel, type Motion } from './AnimalModel';

/** Hops once whenever the avatar changes, so picks feel responsive. */
function Hop({ avatar, children }: { avatar: Avatar; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const changedAt = useRef(-1);
  const clock = useRef(0);

  useEffect(() => {
    changedAt.current = clock.current;
  }, [avatar.animal, avatar.color]);

  useFrame((_, dt) => {
    clock.current += dt;
    const t = clock.current - changedAt.current;
    if (group.current) group.current.position.y = t >= 0 && t < 0.35 ? Math.sin((t / 0.35) * Math.PI) * 0.12 : 0;
  });

  return <group ref={group}>{children}</group>;
}

/** A small spinning 3D view of an avatar; drag to turn it. */
export function AvatarPreview({ avatar }: { avatar: Avatar }) {
  const motion = useRef<Motion>({ speed: 0 });
  return (
    <Canvas
      className="avatar-preview"
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.95, 2.5], fov: 35 }}
    >
      <hemisphereLight args={['#fff4e6', '#d9ccef', 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} castShadow />
      <Hop avatar={avatar}>
        <AnimalModel animal={avatar.animal} accent={avatar.color} motion={motion} />
      </Hop>
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={3} blur={2.4} far={1.2} />
      <OrbitControls
        target={[0, 0.48, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={2.2}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
