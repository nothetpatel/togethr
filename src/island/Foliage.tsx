import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from './random';

// Procedural trees and bushes. Each one is built once from a seed into a
// single smooth-shaded mesh with vertex colours (darker underneath, lighter on
// top, slightly different shade per plant), so they look organic but cost one
// draw call each.

type Rand = () => number;

// Double-sided so the open undersides of pine layers aren't see-through.
const foliageMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });

/** Removes uv/normal and welds vertices so displacement doesn't open cracks. */
function weld(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.deleteAttribute('uv');
  geometry.deleteAttribute('normal');
  return mergeVertices(geometry);
}

/** Vertex colours: a bottom-to-top gradient with per-vertex variation. */
function paint(geometry: THREE.BufferGeometry, bottom: string, top: string, rand: Rand, variation = 0.12) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(bottom);
  const light = new THREE.Color(top);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    c.copy(dark).lerp(light, k).multiplyScalar(1 - variation / 2 + rand() * variation);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Shifts a hex colour's lightness a little so each plant is its own shade. */
function tint(hex: string, rand: Rand, amount = 0.08): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * amount);
  return `#${c.getHexString()}`;
}

/** An irregular, lumpy ball for leaf clumps. */
function lumpyBlob(radius: number, rand: Rand, roughness = 0.18, detail = 2): THREE.BufferGeometry {
  const g = weld(new THREE.IcosahedronGeometry(radius, detail));
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const [a, b, c] = [rand() * 10, rand() * 10, rand() * 10];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    const wave = (Math.sin(n.x * 5 + a) + Math.sin(n.y * 6 + b) + Math.sin(n.z * 5.5 + c)) / 3;
    const bump = wave * roughness + (rand() - 0.5) * roughness * 0.5;
    v.addScaledVector(n, bump * radius);
    // Leaf clumps are a little flatter underneath.
    if (v.y < 0) v.y *= 0.75;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** A tapered trunk with a gentle lean. Returns the geometry and its top point. */
function trunk(height: number, radius: number, rand: Rand) {
  const g = weld(new THREE.CylinderGeometry(radius * 0.6, radius, height, 7, 5));
  g.translate(0, height / 2, 0);
  const lean = new THREE.Vector2((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i) / height;
    // Flare at the base like roots, lean towards the top.
    const flare = 1 + Math.max(0, 0.25 - k) * 1.6;
    pos.setX(i, pos.getX(i) * flare + lean.x * k * k);
    pos.setZ(i, pos.getZ(i) * flare + lean.y * k * k);
  }
  g.computeVertexNormals();
  paint(g, '#5a3b26', tint('#8a5f3e', rand), rand, 0.1);
  return { geometry: g, top: new THREE.Vector3(lean.x, height, lean.y) };
}

export function leafyTreeGeometry(seed: number): THREE.BufferGeometry {
  const rand = seededRandom(seed * 7919 + 1);
  const { geometry: wood, top } = trunk(0.85 + rand() * 0.25, 0.11 + rand() * 0.03, rand);

  const clumps: THREE.BufferGeometry[] = [];
  const main = lumpyBlob(0.55 + rand() * 0.1, rand);
  main.translate(top.x, top.y + 0.3, top.z);
  clumps.push(main);
  const extra = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < extra; i++) {
    const angle = (i / extra) * Math.PI * 2 + rand() * 0.8;
    const r = 0.28 + rand() * 0.16;
    const blob = lumpyBlob(r, rand);
    blob.translate(top.x + Math.cos(angle) * 0.4, top.y + 0.1 + rand() * 0.45, top.z + Math.sin(angle) * 0.4);
    clumps.push(blob);
  }
  const canopy = mergeGeometries(clumps)!;
  paint(canopy, tint('#3d7a35', rand), tint('#a6d86f', rand), rand);

  return mergeGeometries([wood, canopy])!;
}

export function pineTreeGeometry(seed: number): THREE.BufferGeometry {
  const rand = seededRandom(seed * 104729 + 3);
  const { geometry: wood, top } = trunk(0.45, 0.1, rand);

  // Open-bottomed layers (no flat underside) whose rims break into ragged,
  // drooping branch tips, with per-vertex roughness for a needle-y texture.
  const tiers: THREE.BufferGeometry[] = [];
  const count = 5;
  const sides = 16;
  const branches = 7;
  for (let i = 0; i < count; i++) {
    const radius = 0.82 * (1 - i * 0.17) * (0.9 + rand() * 0.2);
    const height = 0.62 - i * 0.04;
    const tier = weld(new THREE.ConeGeometry(radius, height, sides, 4, true));
    const pos = tier.attributes.position;
    const spin = rand() * Math.PI * 2;
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j);
      const y = pos.getY(j);
      const z = pos.getZ(j);
      // 0 at tip, 1 at rim. Clamped: float error at the tip can dip below 0,
      // and a negative base with a fractional power is NaN.
      const below = THREE.MathUtils.clamp((height / 2 - y) / height, 0, 1);
      const angle = Math.atan2(z, x) + spin;
      const branch = Math.cos(angle * branches);
      const jag = 1 + 0.22 * branch * below ** 1.3 + (rand() - 0.5) * 0.14 * below;
      const droop = -0.07 * below ** 3 * (1 + branch) - rand() * 0.02 * below;
      pos.setXYZ(j, x * jag, y + droop, z * jag);
    }
    tier.computeVertexNormals();
    tier.translate(top.x, top.y - 0.05 + i * 0.3 + height / 2, top.z);
    tiers.push(tier);
  }
  const needles = mergeGeometries(tiers)!;
  paint(needles, tint('#2e6443', rand), tint('#86c58c', rand), rand, 0.2);

  return mergeGeometries([wood, needles])!;
}

export function bushGeometry(seed: number): THREE.BufferGeometry {
  const rand = seededRandom(seed * 15485863 + 5);
  const parts: THREE.BufferGeometry[] = [];
  const count = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const r = 0.16 + rand() * 0.12;
    const angle = rand() * Math.PI * 2;
    const spread = i === 0 ? 0 : 0.14 + rand() * 0.1;
    const blob = lumpyBlob(r, rand, 0.22, 1);
    blob.translate(Math.cos(angle) * spread, r * 0.75 + rand() * 0.06, Math.sin(angle) * spread);
    parts.push(blob);
  }
  const bush = mergeGeometries(parts)!;
  paint(bush, tint('#356f33', rand), tint('#93cc6a', rand), rand);
  return bush;
}

type PlantKind = 'pine' | 'leafy' | 'bush';

const builders: Record<PlantKind, (seed: number) => THREE.BufferGeometry> = {
  pine: pineTreeGeometry,
  leafy: leafyTreeGeometry,
  bush: bushGeometry,
};

export function Plant({
  kind,
  seed,
  position,
  scale = 1,
}: {
  kind: PlantKind;
  seed: number;
  position: [number, number, number];
  scale?: number;
}) {
  const geometry = useMemo(() => builders[kind](seed), [kind, seed]);
  return (
    <mesh
      geometry={geometry}
      material={foliageMaterial}
      position={position}
      scale={scale}
      rotation={[0, seed * 2.4, 0]}
      castShadow
      receiveShadow
    />
  );
}
