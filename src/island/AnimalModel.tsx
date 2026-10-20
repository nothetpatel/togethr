import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { Animal } from '../shared/types';

// Chibi animals built from smooth primitives: big round head, small body,
// stubby legs. One component draws all five; per-animal parts (ears, snout,
// tail, patches, shell) switch on `animal`. Faces +z. About 1 unit tall.

export interface Motion {
  /** 0 = standing still, 1 = walking at full speed (smoothed by the caller). */
  speed: number;
  /** 0 = standing, 1 = sitting down (smoothed by the caller). */
  sit?: number;
}

interface Palette {
  fur: string;
  light: string; // muzzle / belly / inner ear
  dark: string; // nose / ears / patches
  legs: string;
}

const PALETTES: Record<Animal, Palette> = {
  dog: { fur: '#f3e3c8', light: '#ffffff', dark: '#a8693b', legs: '#ead6b6' },
  cat: { fur: '#f2a65a', light: '#fff1de', dark: '#ff8fa3', legs: '#e8984d' },
  panda: { fur: '#f7f6f0', light: '#ffffff', dark: '#2b2b2e', legs: '#2b2b2e' },
  koala: { fur: '#a3abb2', light: '#eae6e1', dark: '#3a3a3f', legs: '#959ea6' },
  turtle: { fur: '#a5d38a', light: '#f0e3b0', dark: '#4f8a4a', legs: '#97c97c' },
};

const EYE = '#2a2230';
const CHEEK = '#ffa4b8';

function Part({
  color,
  children,
  ...props
}: { color: string; children: ReactNode } & Omit<ThreeElements['mesh'], 'children'>) {
  return (
    <mesh {...props}>
      {children}
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

const sphere = (r: number) => <sphereGeometry args={[r, 24, 16]} />;

/** Eyes (with blink), shine, cheeks; `hr` is the head radius. */
function Face({ animal, hr, eyesRef }: { animal: Animal; hr: number; eyesRef: RefObject<THREE.Group | null> }) {
  const p = PALETTES[animal];
  const eyeZ = animal === 'panda' ? 0.9 * hr : 0.86 * hr;
  return (
    <>
      {animal === 'dog' && (
        // A brown patch over one eye, puppy style.
        <Part color={p.dark} position={[0.38 * hr, 0.1 * hr, 0.76 * hr]} rotation={[0, 0, -0.3]} scale={[1, 0.9, 0.5]}>
          {sphere(0.3 * hr)}
        </Part>
      )}
      {animal === 'panda' &&
        [-1, 1].map((s) => (
          <Part
            key={s}
            color={p.dark}
            position={[s * 0.37 * hr, 0.02 * hr, 0.8 * hr]}
            rotation={[0, 0, s * 0.45]}
            scale={[0.85, 1.15, 0.5]}
          >
            {sphere(0.26 * hr)}
          </Part>
        ))}
      <group ref={eyesRef} position={[0, 0.06 * hr, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.36 * hr, 0, eyeZ]}>
            <Part color={EYE}>{sphere(0.14 * hr)}</Part>
            <Part color="#ffffff" position={[0.04 * hr, 0.05 * hr, 0.11 * hr]}>
              {sphere(0.045 * hr)}
            </Part>
          </group>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <Part key={s} color={CHEEK} position={[s * 0.6 * hr, -0.22 * hr, 0.72 * hr]} scale={[1, 0.6, 0.4]}>
          {sphere(0.15 * hr)}
        </Part>
      ))}
    </>
  );
}

function Snout({ animal, hr }: { animal: Animal; hr: number }) {
  const p = PALETTES[animal];
  switch (animal) {
    case 'dog':
      return (
        <>
          <Part color={p.light} position={[0, -0.28 * hr, 0.82 * hr]} scale={[1, 0.72, 0.75]}>
            {sphere(0.4 * hr)}
          </Part>
          <Part color={EYE} position={[0, -0.14 * hr, 1.14 * hr]} scale={[1.2, 0.85, 1]}>
            {sphere(0.12 * hr)}
          </Part>
        </>
      );
    case 'cat':
      return (
        <>
          <Part color={p.light} position={[0, -0.3 * hr, 0.84 * hr]} scale={[1.2, 0.7, 0.6]}>
            {sphere(0.26 * hr)}
          </Part>
          <Part color={p.dark} position={[0, -0.18 * hr, 1.0 * hr]} scale={[1.3, 0.8, 0.8]}>
            {sphere(0.07 * hr)}
          </Part>
        </>
      );
    case 'panda':
      return (
        <>
          <Part color={p.light} position={[0, -0.3 * hr, 0.84 * hr]} scale={[1.1, 0.72, 0.65]}>
            {sphere(0.3 * hr)}
          </Part>
          <Part color={p.dark} position={[0, -0.18 * hr, 1.03 * hr]} scale={[1.3, 0.85, 0.9]}>
            {sphere(0.09 * hr)}
          </Part>
        </>
      );
    case 'koala':
      return (
        <Part color={p.dark} position={[0, -0.12 * hr, 0.95 * hr]} scale={[0.8, 1.1, 0.65]}>
          {sphere(0.24 * hr)}
        </Part>
      );
    case 'turtle':
      return null;
  }
}

function Ears({ animal, hr }: { animal: Animal; hr: number }) {
  const p = PALETTES[animal];
  switch (animal) {
    case 'dog':
      return (
        <>
          {[-1, 1].map((s) => (
            <Part
              key={s}
              color={p.dark}
              position={[s * 0.92 * hr, -0.12 * hr, -0.02 * hr]}
              rotation={[0, 0, s * 0.3]}
              scale={[0.45, 1.15, 0.32]}
            >
              {sphere(0.55 * hr)}
            </Part>
          ))}
        </>
      );
    case 'cat':
      return (
        <>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.56 * hr, 0.84 * hr, 0]} rotation={[0, 0, -s * 0.38]}>
              <Part color={p.legs}>
                <coneGeometry args={[0.4 * hr, 0.75 * hr, 16]} />
              </Part>
              <Part color={p.dark} position={[0, -0.05 * hr, 0.13 * hr]} scale={[0.6, 0.75, 0.4]}>
                <coneGeometry args={[0.4 * hr, 0.75 * hr, 16]} />
              </Part>
            </group>
          ))}
        </>
      );
    case 'panda':
      return (
        <>
          {[-1, 1].map((s) => (
            <Part key={s} color={p.dark} position={[s * 0.68 * hr, 0.78 * hr, -0.08 * hr]} scale={[1, 1, 0.7]}>
              {sphere(0.3 * hr)}
            </Part>
          ))}
        </>
      );
    case 'koala':
      return (
        <>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.9 * hr, 0.55 * hr, -0.08 * hr]}>
              <Part color={p.fur} scale={[1, 1, 0.6]}>
                {sphere(0.46 * hr)}
              </Part>
              <Part color={p.light} position={[0, 0, 0.16 * hr]} scale={[1, 1, 0.4]}>
                {sphere(0.3 * hr)}
              </Part>
            </group>
          ))}
        </>
      );
    case 'turtle':
      return null;
  }
}

function Tail({ animal, tailRef }: { animal: Animal; tailRef: RefObject<THREE.Group | null> }) {
  const p = PALETTES[animal];
  let tail: ReactNode = null;
  if (animal === 'dog') {
    tail = (
      <Part color={p.fur} position={[0, 0.08, -0.04]} rotation={[-0.7, 0, 0]}>
        <capsuleGeometry args={[0.045, 0.14, 4, 10]} />
      </Part>
    );
  } else if (animal === 'cat') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.1, -0.12),
      new THREE.Vector3(0, 0.28, -0.14),
      new THREE.Vector3(0.04, 0.4, -0.06),
    ]);
    tail = (
      <Part color={p.fur}>
        <tubeGeometry args={[curve, 20, 0.035, 8, false]} />
      </Part>
    );
  } else if (animal === 'panda') {
    tail = <Part color={p.fur}>{sphere(0.06)}</Part>;
  } else if (animal === 'turtle') {
    tail = (
      <Part color={p.fur} rotation={[-Math.PI / 2 - 0.3, 0, 0]} position={[0, -0.02, -0.04]}>
        <coneGeometry args={[0.05, 0.12, 10]} />
      </Part>
    );
  }
  const at: [number, number, number] = animal === 'turtle' ? [0, 0.24, -0.42] : [0, 0.4, -0.3];
  return (
    <group ref={tailRef} position={at}>
      {tail}
    </group>
  );
}

const QUAD_HIPS: [number, number, number][] = [
  [-0.15, 0.22, 0.13],
  [0.15, 0.22, 0.13],
  [-0.15, 0.22, -0.14],
  [0.15, 0.22, -0.14],
];
const TURTLE_HIPS: [number, number, number][] = [
  [-0.27, 0.17, 0.22],
  [0.27, 0.17, 0.22],
  [-0.27, 0.17, -0.22],
  [0.27, 0.17, -0.22],
];
// Diagonal pairs swing together, like a trot.
const LEG_PHASE = [0, Math.PI, Math.PI, 0];

/** Height above the ground for a name tag, per animal. */
export function nameTagHeight(animal: Animal): number {
  return animal === 'turtle' ? 0.95 : 1.35;
}

export function AnimalModel({
  animal,
  accent,
  motion,
}: {
  animal: Animal;
  accent: string;
  motion: RefObject<Motion>;
}) {
  const p = PALETTES[animal];
  const isTurtle = animal === 'turtle';
  const hr = isTurtle ? 0.22 : 0.3; // head radius
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const phase = useRef(0);
  // Desynchronise idle animation between animals.
  const offset = useRef(Math.random() * 10);

  useEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }, [animal]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + offset.current;
    const s = motion.current?.speed ?? 0;
    const sit = motion.current?.sit ?? 0;
    phase.current += dt * (4 + 9 * s);
    const ph = phase.current;

    if (bob.current) {
      // Sitting: settle lower and lean back onto the hind legs.
      bob.current.position.y = Math.abs(Math.sin(ph)) * 0.05 * s - (isTurtle ? 0.06 : 0.12) * sit;
      bob.current.rotation.z = Math.sin(ph) * 0.07 * s;
      bob.current.rotation.x = 0.06 * s - (isTurtle ? 0 : 0.3) * sit;
    }
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 2.2) * 0.02 * (1 - s);
    if (head.current) {
      // Lean the head forward again while sitting, so they still look ahead.
      head.current.rotation.x = Math.sin(t * 1.3) * 0.04 - 0.04 * s + (isTurtle ? 0 : 0.3) * sit;
      head.current.rotation.z = Math.sin(t * 0.6) * 0.08 * (1 - s);
      head.current.position.y = (isTurtle ? 0.44 : 0.78) + Math.sin(t * 2.2) * 0.008;
    }
    legs.current.forEach((leg, i) => {
      if (!leg) return;
      // Front legs stay planted; hind legs fold forward under the body.
      const fold = isTurtle ? 0 : i < 2 ? 0.3 : -1.25;
      leg.rotation.x = Math.sin(ph + LEG_PHASE[i]) * 0.75 * s + fold * sit;
    });
    if (tail.current) tail.current.rotation.y = Math.sin(t * (3 + 9 * s)) * (0.35 + 0.25 * s);
    if (eyes.current) {
      const blink = t % 4.3;
      eyes.current.scale.y = blink < 0.12 ? 0.12 : 1;
    }
  });

  const hips = isTurtle ? TURTLE_HIPS : QUAD_HIPS;

  return (
    <group ref={root}>
      <group ref={bob}>
        {/* Legs, pivoting at the hip */}
        {hips.map((hip, i) => (
          <group
            key={i}
            position={hip}
            ref={(g) => {
              legs.current[i] = g;
            }}
          >
            {isTurtle ? (
              <Part color={p.legs} position={[0, -0.09, 0]} scale={[1, 0.75, 1.25]}>
                {sphere(0.09)}
              </Part>
            ) : (
              <Part color={p.legs} position={[0, -0.11, 0]}>
                <capsuleGeometry args={[0.075, 0.1, 4, 12]} />
              </Part>
            )}
          </group>
        ))}

        {/* Body */}
        <group ref={body} position={[0, isTurtle ? 0.3 : 0.4, 0]}>
          {isTurtle ? (
            <>
              <Part color={p.dark} scale={[1, 0.6, 1.15]}>
                {sphere(0.36)}
              </Part>
              {[
                [0, 0.2, 0],
                [0.15, 0.15, 0.17],
                [-0.15, 0.15, 0.17],
                [0.15, 0.15, -0.17],
                [-0.15, 0.15, -0.17],
              ].map((at, i) => (
                <Part key={i} color="#6aa860" position={at as [number, number, number]} scale={[1, 0.35, 1]}>
                  {sphere(0.11)}
                </Part>
              ))}
              <Part color={p.light} position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.15, 1]}>
                <torusGeometry args={[0.35, 0.045, 10, 40]} />
              </Part>
            </>
          ) : (
            <>
              <Part color={p.fur} scale={[1, 0.88, 1.1]}>
                {sphere(0.3)}
              </Part>
              <Part color={p.light} position={[0, -0.04, 0.17]} scale={[0.75, 0.75, 0.55]}>
                {sphere(0.25)}
              </Part>
            </>
          )}
        </group>

        <Tail animal={animal} tailRef={tail} />

        {/* Scarf in the player's colour */}
        <Part
          color={accent}
          position={isTurtle ? [0, 0.38, 0.33] : [0, 0.6, 0.08]}
          rotation={[Math.PI / 2 + (isTurtle ? 0.5 : 0.1), 0, 0]}
        >
          <torusGeometry args={[isTurtle ? 0.13 : 0.19, 0.055, 10, 32]} />
        </Part>

        {/* Head */}
        <group ref={head} position={isTurtle ? [0, 0.44, 0.44] : [0, 0.78, 0.1]}>
          <Part color={p.fur} scale={[1.06, 0.95, 1]}>
            {sphere(hr)}
          </Part>
          <Ears animal={animal} hr={hr} />
          <Snout animal={animal} hr={hr} />
          <Face animal={animal} hr={hr} eyesRef={eyes} />
        </group>
      </group>
    </group>
  );
}
