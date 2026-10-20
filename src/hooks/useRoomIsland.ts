import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { levelProgress, type ItemKind } from '../shared/catalog';
import type { Room, RoomItem } from '../shared/types';
import { errorMessage } from '../lib/rooms';
import { useLiveTable } from './useLiveTable';

export interface RoomIsland {
  /** False until the jar has been loaded from the server. */
  loaded: boolean;
  seeds: number;
  seedsEarned: number;
  level: number;
  /** 0..1 through the current level. */
  progress: number;
  /** Seeds still to earn for the next level, or null at the top. */
  toNext: number | null;
  items: RoomItem[];
  /** Each resolves to an error message, or null on success. */
  place: (kind: ItemKind, x: number, z: number, rotation: number) => Promise<string | null>;
  move: (item: RoomItem, x: number, z: number, rotation: number) => Promise<string | null>;
  remove: (item: RoomItem) => Promise<string | null>;
}

/**
 * The room's shared seed jar, its level, and everything built on its island,
 * all live. Seeds only change through database functions (see migration 0004).
 */
export function useRoomIsland(client: SupabaseClient | null, room: Room | null): RoomIsland {
  const roomId = room?.id ?? null;
  const [jar, setJar] = useState({ seeds: room?.seeds ?? 0, earned: room?.seeds_earned ?? 0, loaded: false });
  const { rows: items, apply } = useLiveTable<RoomItem>(client, 'room_items', roomId);

  useEffect(() => {
    setJar((j) => ({ ...j, loaded: false }));
    if (!client || !roomId) return;
    const load = () =>
      client
        .from('rooms')
        .select('seeds, seeds_earned')
        .eq('id', roomId)
        .single()
        .then(({ data }) => data && setJar({ seeds: data.seeds, earned: data.seeds_earned, loaded: true }));
    const channel = client
      .channel(`jar:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, ({ new: row }) => {
        const r = row as Room;
        setJar({ seeds: r.seeds, earned: r.seeds_earned, loaded: true });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      client.removeChannel(channel);
    };
  }, [client, roomId]);

  const place = useCallback(
    async (kind: ItemKind, x: number, z: number, rotation: number) => {
      if (!client || !roomId) return 'Not in a room';
      const { data, error } = await client.rpc('place_item', { p_room: roomId, p_kind: kind, p_x: x, p_z: z, p_rotation: rotation });
      if (error) return errorMessage(error);
      apply((data as RoomItem).id, data as RoomItem);
      return null;
    },
    [client, roomId, apply],
  );

  const move = useCallback(
    async (item: RoomItem, x: number, z: number, rotation: number) => {
      if (!client) return 'Not in a room';
      apply(item.id, { ...item, x, z, rotation });
      const { error } = await client.rpc('move_item', { p_item: item.id, p_x: x, p_z: z, p_rotation: rotation });
      if (error) {
        apply(item.id, item);
        return errorMessage(error);
      }
      return null;
    },
    [client, apply],
  );

  const remove = useCallback(
    async (item: RoomItem) => {
      if (!client) return 'Not in a room';
      apply(item.id, null);
      const { error } = await client.rpc('remove_item', { p_item: item.id });
      if (error) {
        apply(item.id, item);
        return errorMessage(error);
      }
      return null;
    },
    [client, apply],
  );

  const { level, progress, toNext } = levelProgress(jar.earned);
  return { loaded: jar.loaded, seeds: jar.seeds, seedsEarned: jar.earned, level, progress, toNext, items, place, move, remove };
}
