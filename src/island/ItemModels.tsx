import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { ItemKind } from '../shared/catalog';
import { Plant } from './Foliage';
import { seededRandom } from './random';

// Things you can build on the island, drawn in the same soft style as the
// plants. Each model sits on y = 0, faces +z, and fits inside its catalog
// radius. These are stand-ins until the Blender versions are made.

type MeshProps = Omit<ThreeElements['mesh'], 'children'>;

function Part({ color, children, emissive, ...props }: MeshProps & { color: string; emissive?: string; children: ReactNode }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      {children}
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? 1.2 : 0}
      />
    </mesh>
  );
}

const WOOD = '#b07a4f';
const WOOD_DARK = '#8a5a35';
const STONE = '#b9b4ad';
const CREAM = '#fff4e2';

/** Turns an item id into a stable number, so random-looking details don't change. */
export function idSeed(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function FlowerPatch({ seed }: { seed: number }) {
  const flowers = useMemo(() => {
    const rand = seededRandom(seed);
    const colors = ['#ff5c7a', '#ffc94a', '#b56cf0', '#ffffff', '#ff8f3c', '#f2557f'];
    return Array.from({ length: 9 }, () => {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.28;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 0.16 + rand() * 0.12, color: colors[Math.floor(rand() * colors.length)] };
    });
  }, [seed]);
  return (
    <group>
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <Part color="#4f9b52" position={[0, f.h / 2, 0]}>
            <cylinderGeometry args={[0.01, 0.012, f.h, 5]} />
          </Part>
          <Part color={f.color} position={[0, f.h, 0]} scale={[1, 0.7, 1]}>
            <icosahedronGeometry args={[0.045, 1]} />
          </Part>
        </group>
      ))}
    </group>
  );
}

function SteppingStones({ seed }: { seed: number }) {
  const stones = useMemo(() => {
    const rand = seededRandom(seed);
    return [-0.28, -0.09, 0.1, 0.28].map((z, i) => ({ x: (i % 2 ? 0.08 : -0.08) + (rand() - 0.5) * 0.05, z, s: 0.1 + rand() * 0.04 }));
  }, [seed]);
  return (
    <group>
      {stones.map((s, i) => (
        <Part key={i} color={STONE} position={[s.x, 0.015, s.z]} scale={[1, 0.25, 0.85]}>
          <icosahedronGeometry args={[s.s, 1]} />
        </Part>
      ))}
    </group>
  );
}

function Bench() {
  return (
    <group>
      <Part color={WOOD} position={[0, 0.28, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.3]} />
      </Part>
      <Part color={WOOD} position={[0, 0.5, -0.13]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.9, 0.22, 0.05]} />
      </Part>
      {[-0.38, 0.38].map((x) =>
        [-0.1, 0.1].map((z) => (
          <Part key={`${x}${z}`} color={WOOD_DARK} position={[x, 0.13, z]}>
            <boxGeometry args={[0.06, 0.26, 0.06]} />
          </Part>
        )),
      )}
    </group>
  );
}

function Lantern() {
  return (
    <group>
      <Part color="#5b5560" position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.8, 8]} />
      </Part>
      <Part color="#5b5560" position={[0, 0.82, 0]}>
        <boxGeometry args={[0.16, 0.03, 0.16]} />
      </Part>
      <Part color="#ffe9a8" emissive="#ffc95c" position={[0, 0.93, 0]}>
        <boxGeometry args={[0.12, 0.18, 0.12]} />
      </Part>
      <Part color="#5b5560" position={[0, 1.05, 0]}>
        <coneGeometry args={[0.12, 0.08, 4]} />
      </Part>
    </group>
  );
}

let checkerTexture: THREE.CanvasTexture | null = null;
function picnicTexture(): THREE.CanvasTexture {
  if (checkerTexture) return checkerTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#ff8fab' : '#fff6f8';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  checkerTexture = new THREE.CanvasTexture(canvas);
  checkerTexture.colorSpace = THREE.SRGBColorSpace;
  checkerTexture.magFilter = THREE.NearestFilter;
  return checkerTexture;
}

function PicnicBlanket() {
  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.0, 0.8]} />
        <meshStandardMaterial map={picnicTexture()} roughness={0.95} />
      </mesh>
      <Part color="#c98d52" position={[0.3, 0.09, -0.2]}>
        <boxGeometry args={[0.22, 0.14, 0.16]} />
      </Part>
    </group>
  );
}

function Campfire() {
  const flames = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flames.current?.children.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.18;
      f.scale.x = f.scale.z = 1 + Math.sin(t * 7 + i) * 0.08;
    });
  });
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <Part key={i} color={STONE} position={[Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3]} scale={[1, 0.7, 1]}>
            <icosahedronGeometry args={[0.08, 1]} />
          </Part>
        );
      })}
      {[0, Math.PI / 2].map((r) => (
        <Part key={r} color={WOOD_DARK} position={[0, 0.07, 0]} rotation={[0, r, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 7]} />
        </Part>
      ))}
      <group ref={flames} position={[0, 0.1, 0]}>
        <Part color="#ff9a3c" emissive="#ff7a1a" position={[0, 0.14, 0]}>
          <coneGeometry args={[0.13, 0.32, 8]} />
        </Part>
        <Part color="#ffd25c" emissive="#ffc23a" position={[0.03, 0.1, 0.02]}>
          <coneGeometry args={[0.07, 0.2, 8]} />
        </Part>
      </group>
    </group>
  );
}

function StudyDesk() {
  return (
    <group>
      <Part color={WOOD} position={[0, 0.45, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.45]} />
      </Part>
      {[-0.35, 0.35].map((x) =>
        [-0.18, 0.18].map((z) => (
          <Part key={`${x}${z}`} color={WOOD_DARK} position={[x, 0.22, z]}>
            <boxGeometry args={[0.05, 0.44, 0.05]} />
          </Part>
        )),
      )}
      {['#e63946', '#7cc6fe', '#ffd166'].map((c, i) => (
        <Part key={c} color={c} position={[-0.22, 0.5 + i * 0.035, -0.05]} rotation={[0, i * 0.2, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.24]} />
        </Part>
      ))}
      <Part color="#5b5560" position={[0.25, 0.55, -0.1]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
      </Part>
      <Part color="#fff1c2" emissive="#ffd67a" position={[0.25, 0.65, -0.06]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.07, 0.08, 10, 1, true]} />
      </Part>
    </group>
  );
}

function Hammock() {
  const cloth = useMemo(() => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return new THREE.Vector3(-0.55 + t * 1.1, 0.6 - Math.sin(t * Math.PI) * 0.28, 0);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.14, 8, false).scale(1, 0.35, 1);
  }, []);
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <Part key={x} color={WOOD_DARK} position={[x, 0.4, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.8, 8]} />
        </Part>
      ))}
      <mesh geometry={cloth} castShadow receiveShadow>
        <meshStandardMaterial color="#7fd8be" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Pond() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.65, 32]} />
        <meshStandardMaterial color="#5ec4d6" roughness={0.2} metalness={0.1} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <Part key={i} color={STONE} position={[Math.cos(a) * 0.7, 0.04, Math.sin(a) * 0.7]} scale={[1, 0.55, 1]}>
            <icosahedronGeometry args={[0.09, 1]} />
          </Part>
        );
      })}
      <Part color="#6cbf6a" position={[0.2, 0.025, 0.1]} scale={[1, 0.1, 1]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 14]} />
      </Part>
      <Part color="#ff9ec4" position={[0.22, 0.06, 0.08]}>
        <icosahedronGeometry args={[0.05, 1]} />
      </Part>
    </group>
  );
}

function Gazebo() {
  return (
    <group>
      <Part color={CREAM} position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.95, 1.0, 0.12, 6]} />
      </Part>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <Part key={i} color={CREAM} position={[Math.cos(a) * 0.82, 0.65, Math.sin(a) * 0.82]}>
            <cylinderGeometry args={[0.05, 0.05, 1.1, 8]} />
          </Part>
        );
      })}
      <Part color="#7cc6a4" position={[0, 1.42, 0]}>
        <coneGeometry args={[1.15, 0.6, 6]} />
      </Part>
      <Part color="#ffd166" position={[0, 1.8, 0]}>
        <icosahedronGeometry args={[0.07, 1]} />
      </Part>
    </group>
  );
}

function CafeStall() {
  return (
    <group>
      <Part color={CREAM} position={[0, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.9, 0.6]} />
      </Part>
      <Part color={WOOD} position={[0, 0.92, 0.05]}>
        <boxGeometry args={[1.25, 0.05, 0.7]} />
      </Part>
      {Array.from({ length: 6 }, (_, i) => (
        <Part key={i} color={i % 2 ? '#ffffff' : '#ff8fab'} position={[-0.5 + i * 0.2, 1.38, 0.32]} rotation={[0.45, 0, 0]}>
          <boxGeometry args={[0.2, 0.04, 0.6]} />
        </Part>
      ))}
      {[-0.58, 0.58].map((x) => (
        <Part key={x} color={WOOD_DARK} position={[x, 1.1, 0.25]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
        </Part>
      ))}
      <Part color="#ffffff" position={[0.3, 1.0, 0.1]}>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 10]} />
      </Part>
    </group>
  );
}

function Cottage() {
  return (
    <group>
      <Part color={CREAM} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.3, 1.0, 1.1]} />
      </Part>
      <Part color="#e07a6a" position={[0, 1.32, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.05, 1, 0.95]}>
        <coneGeometry args={[1.1, 0.7, 4]} />
      </Part>
      <Part color={WOOD_DARK} position={[0, 0.32, 0.56]}>
        <boxGeometry args={[0.3, 0.55, 0.04]} />
      </Part>
      {[-0.4, 0.4].map((x) => (
        <Part key={x} color="#bfe6ff" emissive="#fff3c4" position={[x, 0.62, 0.56]}>
          <boxGeometry args={[0.22, 0.22, 0.03]} />
        </Part>
      ))}
      <Part color="#a39d97" position={[0.38, 1.55, -0.2]}>
        <boxGeometry args={[0.16, 0.4, 0.16]} />
      </Part>
    </group>
  );
}

/** Draws any catalog item. `seed` keeps random details (flower colours, tree type) stable. */
export function ItemModel({ kind, seed }: { kind: ItemKind; seed: number }) {
  switch (kind) {
    case 'flower_patch':
      return <FlowerPatch seed={seed} />;
    case 'bush':
      return <Plant kind="bush" seed={(seed % 1000) + 200} position={[0, -0.04, 0]} />;
    case 'tree':
      return <Plant kind={seed % 2 ? 'pine' : 'leafy'} seed={(seed % 1000) + 300} position={[0, -0.05, 0]} />;
    case 'stepping_stones':
      return <SteppingStones seed={seed} />;
    case 'bench':
      return <Bench />;
    case 'lantern':
      return <Lantern />;
    case 'picnic_blanket':
      return <PicnicBlanket />;
    case 'campfire':
      return <Campfire />;
    case 'study_desk':
      return <StudyDesk />;
    case 'hammock':
      return <Hammock />;
    case 'pond':
      return <Pond />;
    case 'gazebo':
      return <Gazebo />;
    case 'cafe_stall':
      return <CafeStall />;
    case 'cottage':
      return <Cottage />;
  }
}
