import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ANIMALS, type Animal } from '../shared/types';
import { CodeAnimal } from './CodeAnimal';
import { useAnimalMotion, type Motion, type Rig } from './animalMotion';

export type { Motion };

// The animals, modelled in Blender from the design drawings in art/reference
// (scripts/blender/animals/<animal>.py → public/models/animals/<animal>.glb).
// Each model's moving parts are nodes placed at their pivots (head, eyes,
// body, leg0–3, tail, bamboo), which useAnimalMotion drives; `scarf` marks
// where the player-coloured scarf goes. While a model loads, or if it can't,
// the shapes-in-code version stands in. Faces +z, about 1 unit tall.

/** Animals that have a Blender model (all of them, for now). */
const MODELLED: ReadonlySet<Animal> = new Set(ANIMALS);

const modelUrl = (animal: Animal) => `${import.meta.env.BASE_URL}models/animals/${animal}.glb`;

for (const animal of MODELLED) useGLTF.preload(modelUrl(animal));

/** Height above the ground for a name tag, per animal. */
export function nameTagHeight(animal: Animal): number {
  return animal === 'turtle' ? 1.15 : animal === 'duck' ? 1.3 : 1.35;
}

export function AnimalModel(props: { animal: Animal; accent: string; motion: RefObject<Motion> }) {
  const fallback = <CodeAnimal {...props} />;
  if (!MODELLED.has(props.animal)) return fallback;
  return (
    <ModelBoundary key={props.animal} fallback={fallback}>
      <Suspense fallback={fallback}>
        <BlenderAnimal {...props} />
      </Suspense>
    </ModelBoundary>
  );
}

function BlenderAnimal({ animal, accent, motion }: { animal: Animal; accent: string; motion: RefObject<Motion> }) {
  const { scene } = useGLTF(modelUrl(animal));
  // Each player gets their own copy (geometry and materials are shared).
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return copy;
  }, [scene]);
  const outer = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const rig = useMemo<Omit<Rig, 'bob'>>(() => {
    const part = (name: string) => model.getObjectByName(name) ?? null;
    return {
      body: part('body'),
      head: part('head'),
      eyes: part('eyes'),
      tail: part('tail'),
      legs: [0, 1, 2, 3].map((i) => part(`leg${i}`)).filter((leg) => leg !== null),
      bamboo: part('bamboo'),
    };
  }, [model]);
  const scarf = useMemo(() => model.getObjectByName('scarf'), [model]);

  // The bamboo is modelled where the paws hold it once sitting up, so it
  // stays out of the body's sitting tilt.
  useLayoutEffect(() => {
    if (!rig.bamboo) return;
    rig.bamboo.visible = false;
    outer.current?.add(rig.bamboo);
  }, [rig]);

  useAnimalMotion(animal, motion, () => ({ ...rig, bob: bob.current }));

  return (
    <group ref={outer}>
      <group ref={bob}>
        <primitive object={model} />
        {scarf &&
          createPortal(
            // A unit ring lying flat; the scarf node sizes and places it.
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[1, 0.29, 10, 32]} />
              <meshStandardMaterial color={accent} roughness={0.7} />
            </mesh>,
            scarf,
          )}
      </group>
    </group>
  );
}

/** Shows `fallback` instead if the model fails to load. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Animal model failed to load; using the built-in one.', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
