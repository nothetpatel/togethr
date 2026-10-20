import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMembers, type MemberWithProfile } from '../lib/rooms';

/** Live member list: refetches whenever someone joins or leaves the room. */
export function useRoomMembers(client: SupabaseClient, roomId: string): MemberWithProfile[] {
  const [members, setMembers] = useState<MemberWithProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchMembers(client, roomId)
        .then((m) => !cancelled && setMembers(m))
        .catch((err) => console.error('loading members failed', err));

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
      client.removeChannel(channel);
    };
  }, [client, roomId]);

  return members;
}
