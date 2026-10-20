import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRoomMembers } from '../hooks/useRoomMembers';
import { ANIMAL_EMOJI } from '../shared/animals';
import type { Player, Room } from '../shared/types';

// Top-left card while in a room: the shareable code and who's here.
export function RoomPanel({
  client,
  room,
  me,
  onLeave,
}: {
  client: SupabaseClient;
  room: Room;
  me: Player;
  onLeave: () => void;
}) {
  const members = useRoomMembers(client, room.id);
  const [copied, setCopied] = useState(false);
  const isOwner = room.owner_id === me.id;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the code is on screen to read out anyway
    }
  }

  return (
    <aside className="card room-panel">
      <div className="room-code-row">
        <div>
          <p className="muted small">Room code</p>
          <p className="room-code" data-testid="room-code">
            {room.code}
          </p>
        </div>
        <button onClick={copyCode}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>

      <p className="muted small">
        Here now · <span data-testid="member-count">{members.length}</span>
      </p>
      <ul className="members">
        {members.map((m) => (
          <li key={m.player_id}>
            <span className="emoji">{ANIMAL_EMOJI[m.avatar.animal] ?? '🐾'}</span>
            <span className="name">
              {m.nickname}
              {m.player_id === me.id && <span className="muted"> (you)</span>}
            </span>
            {m.player_id === room.owner_id && (
              <span className="badge" title="Room owner">
                👑 owner
              </span>
            )}
          </li>
        ))}
      </ul>

      <button className="link" onClick={onLeave}>
        {isOwner ? 'Back to lobby' : 'Leave room'}
      </button>
    </aside>
  );
}
