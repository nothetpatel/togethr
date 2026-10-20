import type { ItemKind } from '../shared/catalog';
import type { RoomItem } from '../shared/types';

// A grown island for the dev-only ?showcase view (used for the link-preview
// image). Every item is placed where the real build rules allow
// (showcase.test.ts checks), so the picture shows what people can make.

const spot = (kind: ItemKind, x: number, z: number, rotation = 0, n = 0): RoomItem => ({
  id: `showcase-${kind}-${n}`,
  room_id: 'showcase',
  kind,
  x,
  z,
  rotation,
  placed_by: null,
  created_at: `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`,
});

export const SHOWCASE_ITEMS: RoomItem[] = [
  spot('cottage', -2.7, -2.3, 0.7, 1),
  spot('cafe_stall', 2.5, -2.1, -0.7, 2),
  spot('pond', -3.0, 1.4, 0, 3),
  spot('gazebo', -0.4, 3.4, Math.PI, 4),
  spot('bench', 2.2, 1.4, -2.2, 5),
  spot('lantern', 1.0, 2.4, 0, 6),
  spot('lantern', -1.3, -1.2, 0, 7),
  spot('picnic_blanket', 0.4, -2.6, 0.3, 8),
  spot('flower_patch', 2.9, 0.1, 0, 9),
  spot('flower_patch', -1.7, 1.3, 0, 10),
  spot('flower_patch', 1.4, -3.0, 0, 11),
  spot('stepping_stones', 0.6, 1.6, 0.4, 12),
  spot('tree', -4.3, -1.3, 0, 13),
  spot('tree', 3.3, -3.6, 0, 14),
  spot('bush', -1.4, 4.3, 0, 15),
  spot('study_desk', -2.0, 2.9, 2.4, 16),
];
