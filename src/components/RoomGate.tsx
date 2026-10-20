import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRoom, errorMessage, joinRoom, listMyRooms } from '../lib/rooms';
import { isValidRoomCode, normalizeRoomCode } from '../lib/roomCode';
import { ANIMAL_EMOJI } from '../shared/animals';
import type { Player, Room } from '../shared/types';

// Lobby: create a room, join one with a 4-letter code, or hop back into a
// room you've been in before.
export function RoomGate({
  client,
  player,
  onEnter,
}: {
  client: SupabaseClient;
  player: Player;
  onEnter: (room: Room) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<Room[]>([]);

  useEffect(() => {
    listMyRooms(client).then(setMyRooms).catch(() => setMyRooms([]));
  }, [client]);

  async function run(kind: 'create' | 'join', action: () => Promise<Room>) {
    setBusy(kind);
    setError(null);
    try {
      onEnter(await action());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  function submitJoin(e: FormEvent) {
    e.preventDefault();
    if (isValidRoomCode(code)) run('join', () => joinRoom(client, code));
  }

  return (
    <div className="overlay">
      <div className="card">
        <h1>
          Hi {player.nickname} {ANIMAL_EMOJI[player.avatar.animal]}
        </h1>
        <p className="muted">Start your own island, or join a friend's with their code.</p>

        <button className="primary" onClick={() => run('create', () => createRoom(client))} disabled={!!busy}>
          {busy === 'create' ? 'Creating…' : 'Create a room'}
        </button>

        <div className="divider">or join with a code</div>

        <form className="join-row" onSubmit={submitJoin}>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            placeholder="ABCD"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
          />
          <button type="submit" disabled={!isValidRoomCode(code) || !!busy}>
            {busy === 'join' ? 'Joining…' : 'Join'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {myRooms.length > 0 && (
          <div className="recent">
            <p className="muted small">Your rooms</p>
            {myRooms.map((room) => (
              <button
                key={room.id}
                className="recent-room"
                disabled={!!busy}
                onClick={() => run('join', () => joinRoom(client, room.code))}
              >
                <span className="code">{room.code}</span>
                {room.owner_id === player.id && <span className="badge">yours</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
