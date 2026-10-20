import { useRef } from 'react';
import { ANIMALS } from '../shared/types';
import { AnimalModel, type Motion } from './AnimalModel';
import { terrainHeight } from './terrain';

// Dev-only: every animal twice (open the app with ?gallery). The front row
// stands still (pandas and koalas sit up after a moment), the back row walks
// on the spot, so both animations can be checked.
export function AnimalGallery() {
  const still = useRef<Motion>({ speed: 0 });
  const walking = useRef<Motion>({ speed: 1 });
  return (
    <>
      {[
        { z: 2.6, motion: walking },
        { z: 1.4, motion: still },
      ].map(({ z, motion }) =>
        ANIMALS.map((animal, i) => {
          const x = (i - (ANIMALS.length - 1) / 2) * 1.0;
          return (
            <group key={`${animal}-${z}`} position={[x, terrainHeight(x, z), z]} rotation={[0, 0.35, 0]}>
              <AnimalModel animal={animal} accent="#ff8fab" motion={motion} />
            </group>
          );
        }),
      )}
    </>
  );
}
