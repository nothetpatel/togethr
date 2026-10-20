import { describe, expect, it } from 'vitest';
import { placementProblem } from './placement';
import { SHOWCASE_ITEMS } from './showcase';

describe('showcase island', () => {
  it('only uses placements the real build rules allow', () => {
    const problems = SHOWCASE_ITEMS.flatMap((item, i) => {
      const problem = placementProblem(item.kind, item.x, item.z, SHOWCASE_ITEMS.slice(0, i));
      return problem ? [`${item.id}: ${problem}`] : [];
    });
    expect(problems).toEqual([]);
  });
});
