import { useRef } from 'react';
import { ANIMALS } from '../shared/types';
import { AnimalModel, type Motion } from './AnimalModel';
import { terrainHeight } from './terrain';

// Dev-only: all five animals side by side (open the app with ?gallery).
// Every other one walks on the spot so both animations can be checked.
export function AnimalGallery() {
  const idle = useRef<Motion>({ speed: 0 });
  const walking = useRef<Motion>({ speed: 1 });
  return (
    <>
      {ANIMALS.map((animal, i) => {
        const x = (i - 2) * 1.1;
        const z = 1.2;
        return (
          <group key={animal} position={[x, terrainHeight(x, z), z]} rotation={[0, 0.35, 0]}>
            <AnimalModel animal={animal} accent="#ff8fab" motion={i % 2 ? walking : idle} />
          </group>
        );
      })}
    </>
  );
}
