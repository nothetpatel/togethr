import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { PositionMessage } from '../shared/types';
import type { PlayerState } from '../island/LocalPlayer';
import { applyUpdate, type RemoteState } from '../island/remote';

const HEARTBEAT_MS = 2000;

export interface RoomLive {
  /** Other players' animals, keyed by player id. Mutated every frame by the scene. */
  remotes: RefObject<Map<string, RemoteState>>;
  /** Player ids currently connected to the room (including you). */
  onlineIds: string[];
  /** Tell the room where you are now, e.g. right after a tap. */
  sendPosition: () => void;
}

/**
 * Joins the room's private realtime channel: broadcasts your position, keeps
 * everyone else's, and tracks who's online. Does nothing while `roomId` is null.
 */
export function useRoomLive(
  client: SupabaseClient | null,
  roomId: string | null,
  myId: string | null,
  me: RefObject<PlayerState>,
): RoomLive {
  const remotes = useRef(new Map<string, RemoteState>());
  const channel = useRef<RealtimeChannel | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  const sendPosition = useCallback(() => {
    if (!channel.current || !myId) return;
    const st = me.current;
    const payload: PositionMessage = {
      id: myId,
      x: st.x,
      z: st.z,
      h: st.heading,
      tx: st.target?.[0] ?? null,
      tz: st.target?.[1] ?? null,
    };
    channel.current.send({ type: 'broadcast', event: 'pos', payload });
  }, [me, myId]);

  useEffect(() => {
    if (!client || !roomId || !myId) return;
    let ch: RealtimeChannel | null = null;
    let cancelled = false;
    const known = remotes.current;

    (async () => {
      await client.realtime.setAuth(); // private channels need the user's token
      if (cancelled) return;
      ch = client.channel(`room:${roomId}`, {
        config: { private: true, presence: { key: myId }, broadcast: { self: false } },
      });
      ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
        const m = payload as PositionMessage;
        if (m.id !== myId) known.set(m.id, applyUpdate(known.get(m.id), m));
      })
        .on('presence', { event: 'sync' }, () => {
          const ids = Object.keys(ch!.presenceState());
          setOnlineIds(ids);
          for (const id of known.keys()) if (!ids.includes(id)) known.delete(id);
        })
        // Someone new arrived: tell them where we are straight away.
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key !== myId) sendPosition();
        })
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            channel.current = ch;
            await ch!.track({ joined_at: Date.now() });
            sendPosition();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`room channel ${status} (has 0002_private_room_channels.sql been run?)`, err);
          }
        });
    })();

    const heartbeat = setInterval(sendPosition, HEARTBEAT_MS);
    if (import.meta.env.DEV) (window as unknown as { __togethrRemotes: unknown }).__togethrRemotes = known;

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      channel.current = null;
      known.clear();
      setOnlineIds([]);
      if (ch) client.removeChannel(ch);
    };
  }, [client, roomId, myId, sendPosition]);

  return { remotes, onlineIds, sendPosition };
}
