import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IslandScene, type IslandOther, type IslandPlayer } from './island/IslandScene';
import { spawnState, type PlayerState } from './island/LocalPlayer';
import { useRoomLive } from './hooks/useRoomLive';
import { useRoomMembers } from './hooks/useRoomMembers';
import { ProfileSetup } from './components/ProfileSetup';
import { RoomGate } from './components/RoomGate';
import { RoomPanel } from './components/RoomPanel';
import { getPlayerId, supabase } from './lib/supabase';
import { errorMessage, getMyPlayer, getRoom, lastRoomId, leaveRoom, rememberRoom } from './lib/rooms';
import type { Player, Room } from './shared/types';

type Stage =
  | { kind: 'offline' }
  | { kind: 'connecting' }
  | { kind: 'error'; message: string }
  | { kind: 'profile' }
  | { kind: 'lobby'; player: Player }
  | { kind: 'room'; player: Player; room: Room };

async function initialStage(client: SupabaseClient): Promise<Stage> {
  const player = await getMyPlayer(client, await getPlayerId(client));
  if (!player) return { kind: 'profile' };

  const roomId = lastRoomId();
  const room = roomId ? await getRoom(client, roomId) : null;
  if (room) return { kind: 'room', player, room };
  rememberRoom(null);
  return { kind: 'lobby', player };
}

export function App() {
  const [stage, setStage] = useState<Stage>(supabase ? { kind: 'connecting' } : { kind: 'offline' });

  useEffect(() => {
    if (!supabase) return;
    initialStage(supabase)
      .then(setStage)
      .catch((err) => setStage({ kind: 'error', message: errorMessage(err) }));
  }, []);

  function enterRoom(player: Player, room: Room) {
    rememberRoom(room.id);
    setStage({ kind: 'room', player, room });
  }

  function leave(player: Player, room: Room) {
    // Owners keep their membership so the room stays theirs to come back to.
    // The delete runs in the background so leaving feels instant.
    if (supabase && room.owner_id !== player.id) {
      leaveRoom(supabase, room.id, player.id).catch((err) => console.error('leave failed', err));
    }
    rememberRoom(null);
    setStage({ kind: 'lobby', player });
  }

  // Your animal shows once you have a profile; the name tag only in a room.
  const me = stage.kind === 'lobby' || stage.kind === 'room' ? stage.player : null;
  const roomId = stage.kind === 'room' ? stage.room.id : null;
  const islandPlayer = useMemo<IslandPlayer | null>(
    () => (me ? { avatar: me.avatar, nickname: stage.kind === 'room' ? me.nickname : null } : null),
    [me, stage.kind],
  );

  // Your position lives here so the room channel can broadcast it.
  const myState = useRef<PlayerState>(spawnState(null));
  const myId = me?.id ?? null;
  useEffect(() => {
    if (myId) myState.current = spawnState(myId);
  }, [myId]);

  const members = useRoomMembers(supabase, roomId);
  const live = useRoomLive(supabase, roomId, myId, myState);
  const others = useMemo<IslandOther[]>(
    () =>
      members
        .filter((m) => m.player_id !== myId && live.onlineIds.includes(m.player_id))
        .map((m) => ({ id: m.player_id, avatar: m.avatar, nickname: m.nickname })),
    [members, myId, live.onlineIds],
  );

  return (
    <div className="app">
      <IslandScene
        player={islandPlayer}
        state={myState}
        onMove={live.sendPosition}
        others={others}
        remotes={live.remotes}
      />

      {(stage.kind === 'offline' || stage.kind === 'connecting' || stage.kind === 'error') && (
        <div className="card status-card">
          <h1>Togethr</h1>
          <p className="muted">
            <span className="dot" />
            {stage.kind === 'offline' && 'Supabase not configured (see README)'}
            {stage.kind === 'connecting' && 'Connecting…'}
            {stage.kind === 'error' && `Couldn't connect: ${stage.message}`}
          </p>
        </div>
      )}

      {supabase && stage.kind === 'profile' && (
        <ProfileSetup client={supabase} onSaved={(player) => setStage({ kind: 'lobby', player })} />
      )}

      {supabase && stage.kind === 'lobby' && (
        <RoomGate client={supabase} player={stage.player} onEnter={(room) => enterRoom(stage.player, room)} />
      )}

      {supabase && stage.kind === 'room' && (
        <RoomPanel
          room={stage.room}
          me={stage.player}
          members={members}
          onlineIds={live.onlineIds}
          onLeave={() => leave(stage.player, stage.room)}
        />
      )}
    </div>
  );
}
