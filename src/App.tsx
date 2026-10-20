import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IslandScene } from './island/IslandScene';
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

  return (
    <div className="app">
      <IslandScene />

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
          client={supabase}
          room={stage.room}
          me={stage.player}
          onLeave={() => leave(stage.player, stage.room)}
        />
      )}
    </div>
  );
}
