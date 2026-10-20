import { useEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG_BY_KIND, type ItemKind } from '../shared/catalog';
import type { RoomItem } from '../shared/types';
import { idSeed, ItemModel } from './ItemModels';
import { terrainHeight } from './terrain';

/** Everything built on the island. Tapping an item reports it (used in build mode). */
export function PlacedItems({
  items,
  hiddenId,
  onTap,
}: {
  items: RoomItem[];
  /** An item being moved; its preview is drawn instead. */
  hiddenId?: string;
  onTap?: (item: RoomItem) => void;
}) {
  return (
    <>
      {items.map((item) =>
        item.id === hiddenId ? null : (
          <group
            key={item.id}
            position={[item.x, terrainHeight(item.x, item.z) - 0.02, item.z]}
            rotation={[0, item.rotation, 0]}
            onClick={
              onTap &&
              ((e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation(); // don't also count as a tap on the ground
                onTap(item);
              })
            }
          >
            <ItemModel kind={item.kind} seed={idSeed(item.id)} />
          </group>
        ),
      )}
    </>
  );
}

/**
 * See-through preview of an item about to be placed, with a footprint ring:
 * green if it fits there, red if not. Ignores pointer events so the ground
 * underneath keeps tracking the pointer.
 */
export function PlacementGhost({
  kind,
  x,
  z,
  rotation,
  fits,
}: {
  kind: ItemKind;
  x: number;
  z: number;
  rotation: number;
  fits: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    group.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = () => {};
      mesh.castShadow = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = materials.map((m) => {
        const ghost = m.clone();
        ghost.transparent = true;
        ghost.opacity = 0.55;
        ghost.depthWrite = false;
        return ghost;
      }) as unknown as THREE.Material;
      if (materials.length === 1) mesh.material = (mesh.material as unknown as THREE.Material[])[0];
    });
  }, [kind]);

  const r = CATALOG_BY_KIND[kind].radius;
  return (
    <group position={[x, terrainHeight(x, z), z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} raycast={() => {}}>
        <ringGeometry args={[Math.max(r, 0.2) - 0.05, Math.max(r, 0.2), 40]} />
        <meshBasicMaterial color={fits ? '#5cb88a' : '#d9536f'} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <group ref={group} rotation={[0, rotation, 0]} key={kind}>
        <ItemModel kind={kind} seed={7} />
      </group>
    </group>
  );
}
