import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Animal } from '../shared/types';

// The animals' animation, shared by the Blender models (AnimalModel.tsx) and
// the shapes-in-code fallback (CodeAnimal.tsx): walking, breathing, blinking,
// tail wags, sitting, and pandas/koalas sitting up when they stop.

export interface Motion {
  /** 0 = standing still, 1 = walking at full speed (smoothed by the caller). */
  speed: number;
  /** 0 = standing, 1 = sitting down (smoothed by the caller). */
  sit?: number;
}

/** The moving parts of an animal, each placed at its pivot. */
export interface Rig {
  /** Everything; bobs while walking and tips back to sit. */
  bob: THREE.Object3D | null;
  body?: THREE.Object3D | null;
  head?: THREE.Object3D | null;
  eyes?: THREE.Object3D | null;
  tail?: THREE.Object3D | null;
  legs: (THREE.Object3D | null)[];
  bamboo?: THREE.Object3D | null;
}

// Diagonal pairs swing together, like a trot (a duck just uses the first two).
const LEG_PHASE = [0, Math.PI, Math.PI, 0];

/**
 * Pandas and koalas sit up on their bottoms whenever they stop (and in
 * seats), like the real animals: body tipped back about its rear, hind legs
 * stuck out in front, front paws in the lap. Everyone else stands, and uses
 * the regular lean-back sit in seats.
 */
const SITS_UPRIGHT: ReadonlySet<Animal> = new Set(['panda', 'koala']);
/** How far the body tips back when sitting upright (radians, ~34°). */
const UPRIGHT_TILT = 0.6;
/** The point it tips back around: on the ground, under the rump. */
const UPRIGHT_PIVOT = { y: 0, z: -0.2 };
/** Then it settles this much lower, so the rump rests on the ground. */
const UPRIGHT_DROP = 0.08;
/** Seconds standing still before plopping down. */
const SIT_DOWN_AFTER = 0.8;

/** Where a part started (its rest position), remembered on first use. */
function rest(o: THREE.Object3D): THREE.Vector3 {
  return (o.userData.rest ??= o.position.clone()) as THREE.Vector3;
}

/** How a part started out turned (about x), remembered on first use. */
function restTurn(o: THREE.Object3D): number {
  return (o.userData.restTurn ??= o.rotation.x) as number;
}

export function useAnimalMotion(animal: Animal, motion: RefObject<Motion>, rig: () => Rig) {
  const isTurtle = animal === 'turtle';
  const isDuck = animal === 'duck';
  const sitsUpright = SITS_UPRIGHT.has(animal);
  const phase = useRef(0);
  const stillFor = useRef(0); // seconds since it last moved
  const upright = useRef(0); // 0 = on all fours, 1 = sitting up
  // Desynchronise idle animation between animals.
  const offset = useRef(Math.random() * 10);

  useFrame(({ clock }, dt) => {
    const { bob, body, head, eyes, tail, legs, bamboo } = rig();
    const t = clock.elapsedTime + offset.current;
    const s = motion.current?.speed ?? 0;
    const seated = motion.current?.sit ?? 0;
    phase.current += dt * (4 + 9 * s);
    const ph = phase.current;

    // Pandas and koalas sit up when they stop (or take a seat); standing up
    // to walk is quicker than settling down.
    stillFor.current = s < 0.05 ? stillFor.current + dt : 0;
    const wantUp = sitsUpright ? Math.max(seated, stillFor.current > SIT_DOWN_AFTER ? 1 : 0) : 0;
    upright.current = THREE.MathUtils.damp(upright.current, wantUp, wantUp > upright.current ? 3.5 : 12, dt);
    const u = upright.current;
    const sit = sitsUpright ? 0 : seated; // everyone else's lean-back sit

    if (bob) {
      // Tip back by `tilt` about the rump (rotate about a pivot, not the feet).
      const tilt = -UPRIGHT_TILT * u;
      const { y: py, z: pz } = UPRIGHT_PIVOT;
      const offY = py - (py * Math.cos(tilt) - pz * Math.sin(tilt));
      const offZ = pz - (py * Math.sin(tilt) + pz * Math.cos(tilt));
      // Sitting: settle lower and lean back onto the hind legs.
      bob.position.y = Math.abs(Math.sin(ph)) * 0.05 * s - (isTurtle ? 0.06 : 0.12) * sit + offY - UPRIGHT_DROP * u;
      bob.position.z = offZ;
      bob.rotation.z = Math.sin(ph) * 0.07 * s;
      bob.rotation.x = 0.06 * s - (isTurtle || isDuck ? 0 : 0.3) * sit + tilt;
    }

    // Koalas doze off after a while sitting (they sleep ~20 hours a day):
    // slow nods and heavy eyelids that drift open and shut.
    const sleepy =
      animal === 'koala' ? u * THREE.MathUtils.smoothstep(stillFor.current, 4, 7) * (0.55 + 0.45 * Math.sin(t * 0.35)) : 0;
    if (body) body.scale.y = 1 + Math.sin(t * 2.2) * 0.02 * (1 - s);
    if (head) {
      // Lean the head forward again while sitting, so they still look ahead.
      head.rotation.x =
        Math.sin(t * 1.3) * 0.04 -
        0.04 * s +
        (isTurtle || isDuck ? 0 : 0.3) * sit +
        UPRIGHT_TILT * u + // keep looking ahead while tipped back
        (0.12 + Math.sin(t * 0.9) * 0.1) * sleepy;
      head.rotation.z = Math.sin(t * 0.6) * 0.08 * (1 - s);
      head.position.y = rest(head).y + Math.sin(t * 2.2) * 0.008;
    }
    legs.forEach((leg, i) => {
      if (!leg) return;
      // Front legs stay planted; hind legs fold forward under the body.
      const fold = isTurtle || isDuck ? 0 : i < 2 ? 0.3 : -1.25;
      // Sitting up: front paws come up in front of the tummy (holding the
      // bamboo, for a panda), hind legs lie flat out in front (angles are
      // relative to the tipped-back body).
      const uprightFold = i < 2 ? -UPRIGHT_TILT : UPRIGHT_TILT - Math.PI / 2;
      leg.rotation.x = Math.sin(ph + LEG_PHASE[i]) * 0.75 * s + fold * sit + uprightFold * u;
    });
    // Panda snack: bamboo appears while sitting up and is lifted to the
    // mouth every few seconds.
    if (bamboo) {
      bamboo.visible = u > 0.05;
      bamboo.scale.setScalar(Math.max(0.001, u));
      const munch = Math.max(0, Math.sin(t * 1.1));
      bamboo.rotation.x = restTurn(bamboo) - 0.3 * munch;
      bamboo.position.y = rest(bamboo).y + 0.08 * munch;
    }
    if (tail) tail.rotation.y = Math.sin(t * (3 + 9 * s)) * (0.35 + 0.25 * s);
    if (eyes) {
      const blink = t % 4.3;
      eyes.scale.y = blink < 0.12 ? 0.12 : 1 - 0.75 * sleepy;
    }
  });
}
