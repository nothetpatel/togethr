import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import type { Animal } from '../shared/types';
import { AnimalModel, nameTagHeight, type Motion } from './AnimalModel';
import { allSeats } from './seats';
import { SHOWCASE_ITEMS } from './showcase';
import { terrainHeight } from './terrain';

// ?showcase: four friends sitting round the campfire mid-focus,
// for the link-preview image. Names and goals are made up.
// Only the two sitting side-on to the camera show goals, so tags don't pile up.
const FRIENDS: { animal: Animal; color: string; name: string; goal?: string }[] = [
  { animal: 'cat', color: '#ff8fab', name: 'Mochi', goal: 'Ch. 4 notes' },
  { animal: 'panda', color: '#7cc6fe', name: 'Bean', goal: 'Lab report' },
  { animal: 'koala', color: '#ffd166', name: 'Pip' },
  { animal: 'dog', color: '#7fd8be', name: 'Juniper' },
];

export function ShowcaseAnimals() {
  const sitting = useRef<Motion>({ speed: 0, sit: 1 });
  const seats = useMemo(() => allSeats(SHOWCASE_ITEMS), []);
  // Name tags added on the very first frame can come up empty (seen with
  // drei's <Html>), so add them a moment after the scene appears.
  const [tagsReady, setTagsReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTagsReady(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      {FRIENDS.map((f, i) => {
        const s = seats[i];
        return (
          <group key={f.name} position={[s.x, terrainHeight(s.x, s.z), s.z]} rotation={[0, s.heading, 0]}>
            <AnimalModel animal={f.animal} accent={f.color} motion={sitting} />
            {tagsReady && (
              <Html position={[0, nameTagHeight(f.animal), 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
                <div className="tag-stack">
                  {f.goal && <div className="goal-bubble">🎯 {f.goal}</div>}
                  <div className="name-tag">{f.name}</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
