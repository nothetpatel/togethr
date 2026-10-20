import { describe, expect, it } from 'vitest';
import { coastRadius, isOnGrass, terrainHeight, WATER_LEVEL } from './terrain';

const angles = Array.from({ length: 72 }, (_, i) => (i / 72) * Math.PI * 2);

describe('terrain', () => {
  it('crosses the waterline within 0.3 of the coastline in every direction', () => {
    for (const a of angles) {
      const at = (r: number) => terrainHeight(Math.cos(a) * r, Math.sin(a) * r);
      expect(at(coastRadius(a) - 0.3)).toBeGreaterThan(WATER_LEVEL);
      expect(at(coastRadius(a) + 0.3)).toBeLessThan(WATER_LEVEL);
    }
  });

  it('keeps grass out to at least 5.5 from the centre, where trees are placed', () => {
    for (const a of angles) {
      expect(isOnGrass(Math.cos(a) * 5.5, Math.sin(a) * 5.5)).toBe(true);
    }
  });

  it('keeps the grass above water and the sea floor below it', () => {
    for (const a of angles) {
      expect(terrainHeight(Math.cos(a) * 3, Math.sin(a) * 3)).toBeGreaterThan(WATER_LEVEL + 0.3);
      expect(terrainHeight(Math.cos(a) * 9, Math.sin(a) * 9)).toBeLessThan(WATER_LEVEL - 0.3);
    }
  });
});
