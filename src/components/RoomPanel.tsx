import { useEffect, useRef, useState } from 'react';
import type { RoomIsland } from '../hooks/useRoomIsland';
import type { MemberWithProfile } from '../lib/rooms';
import { ANIMAL_EMOJI } from '../shared/animals';
import type { Player, Room } from '../shared/types';

/** The room's seed jar and island level, with a "+38" pop when seeds arrive. */
function SeedJar({ island, onBuild }: { island: RoomIsland; onBuild: () => void }) {
  const [gain, setGain] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const last = useRef<{ seeds: number; level: number } | null>(null);

  useEffect(() => {
    if (!island.loaded) return;
    const prev = last.current;
    last.current = { seeds: island.seeds, level: island.level };
    // Only celebrate changes after the first load, not the load itself.
    if (!prev || island.seeds <= prev.seeds) return;
    setGain(island.seeds - prev.seeds);
    if (island.level > prev.level) setLevelUp(true);
    const t = setTimeout(() => setGain(null), 2200);
    return () => clearTimeout(t);
  }, [island.loaded, island.seeds, island.level]);

  return (
    <div className="seed-jar">
      <div className="seed-row">
        <span className="seed-count" data-testid="seed-count">
          🌱 {island.seeds}
        </span>
        {gain !== null && <span className="seed-pop">+{gain}</span>}
        <span className="badge" data-testid="island-level">
          Level {island.level}
        </span>
        <button className="build-button" onClick={onBuild}>
          🔨 Build
        </button>
      </div>
      <div className="progress" aria-hidden>
        <div style={{ width: `${island.progress * 100}%` }} />
      </div>
      <p className="muted small">
        {island.toNext === null ? 'Top level, nice work!' : `${island.toNext} more seeds to level ${island.level + 1}`}
      </p>
      {levelUp && (
        <button className="level-up" onClick={() => setLevelUp(false)}>
          🎉 Island level {island.level}! New things to build.
        </button>
      )}
    </div>
  );
}

// Top-left card while in a room: the shareable code, the seed jar, and who's here.
export function RoomPanel({
  room,
  me,
  members,
  onlineIds,
  island,
  onBuild,
  onEditAvatar,
  onLeave,
}: {
  room: Room;
  me: Player;
  members: MemberWithProfile[];
  onlineIds: string[];
  island: RoomIsland;
  onBuild: () => void;
  onEditAvatar: () => void;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const isOwner = room.owner_id === me.id;

  async function copy(what: 'code' | 'link') {
    const text = what === 'code' ? room.code : `${location.origin}/?join=${room.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
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
        <button onClick={() => copy('code')}>{copied === 'code' ? 'Copied!' : 'Copy'}</button>
      </div>
      <button className="link align-start" onClick={() => copy('link')}>
        {copied === 'link' ? 'Invite link copied!' : 'Copy invite link'}
      </button>

      <SeedJar island={island} onBuild={onBuild} />

      <p className="muted small members-heading">
        Here now · <span data-testid="member-count">{members.length}</span>
      </p>
      <ul className="members">
        {members.map((m) => (
          <li key={m.player_id} className={onlineIds.includes(m.player_id) ? 'online' : 'away'}>
            <span className="presence" title={onlineIds.includes(m.player_id) ? 'Online' : 'Away'} />
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

      <div className="panel-links">
        <button className="link" onClick={onEditAvatar}>
          Edit avatar
        </button>
        <button className="link" onClick={onLeave}>
          {isOwner ? 'Back to lobby' : 'Leave room'}
        </button>
      </div>
    </aside>
  );
}
