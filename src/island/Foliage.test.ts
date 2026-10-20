import { describe, expect, it } from 'vitest';
import { bushGeometry, leafyTreeGeometry, pineTreeGeometry } from './Foliage';

// NaN or zero-length normals render plants solid black, so check every
// attribute of a few seeds of each plant.
describe.each([
  ['pine', pineTreeGeometry],
  ['leafy tree', leafyTreeGeometry],
  ['bush', bushGeometry],
])('%s geometry', (_, build) => {
  it.each([1, 2, 7, 13, 101])('seed %i has finite positions, colours and unit normals', (seed) => {
    const g = build(seed);
    for (const name of ['position', 'normal', 'color']) {
      const values = Array.from(g.getAttribute(name).array as Float32Array);
      expect(values.every(Number.isFinite), `${name} has NaN/Infinity`).toBe(true);
    }
    const normal = g.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) {
      const len = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      expect(len, `normal ${i}`).toBeGreaterThan(0.5);
    }
  });
});
