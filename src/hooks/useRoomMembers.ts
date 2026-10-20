import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMembers, type MemberWithProfile } from '../lib/rooms';

/** Live member list: refetches whenever someone joins or leaves the room. Empty while not in a room. */
export function useRoomMembers(
  client: SupabaseClient | null,
  roomId: string | null,
): { members: MemberWithProfile[]; refresh: () => void } {
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!client || !roomId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    // Loads can overlap (e.g. one on connect, one for a join that lands
    // meanwhile) and finish out of order; only the newest one counts.
    let latest = 0;
    const refresh = () => {
      const request = ++latest;
      fetchMembers(client, roomId)
        .then((m) => !cancelled && request === latest && setMembers(m))
        .catch((err) => console.error('loading members failed', err));
    };
    refreshRef.current = refresh;

    const channel = client
      .channel(`members:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      // Supabase can't filter DELETE events, so check the room here.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_members' }, (payload) => {
        if ((payload.old as { room_id?: string }).room_id === roomId) refresh();
      })
      // Load once the subscription is live, so a join that lands while it's
      // still connecting isn't missed. Reconnects reload too.
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') refresh();
        else if (status !== 'CLOSED') console.warn(`members channel ${status}`, err);
      });
    refresh();

    return () => {
      cancelled = true;
      refreshRef.current = null;
      client.removeChannel(channel);
    };
  }, [client, roomId]);

  const refresh = useCallback(() => refreshRef.current?.(), []);
  return { members, refresh };
}
