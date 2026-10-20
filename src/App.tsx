import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IslandScene, type IslandBuild, type IslandOther, type IslandPlayer } from './island/IslandScene';
import { spawnState, type PlayerState } from './island/LocalPlayer';
import { useRoomLive } from './hooks/useRoomLive';
import { useRoomMembers } from './hooks/useRoomMembers';
import { AvatarCreator } from './components/AvatarCreator';
import { RoomGate } from './components/RoomGate';
import { PomodoroPanel } from './components/PomodoroPanel';
import { RoomPanel } from './components/RoomPanel';
import { progressOf, TodoPanel } from './components/TodoPanel';
import { useRoomTodos } from './hooks/useRoomTodos';
import { CheckinCard } from './components/CheckinCard';
import { BuildDock, buildProblem, type BuildUi } from './components/BuildDock';
import { useRoomIsland } from './hooks/useRoomIsland';
import { useRoomTimer } from './hooks/useRoomTimer';
import { useSessionCheckins } from './hooks/useSessionCheckins';
import { chime } from './lib/chime';
import { getPlayerId, supabase } from './lib/supabase';
import { errorMessage, getMyPlayer, getRoom, joinRoom, lastRoomId, leaveRoom, rememberRoom } from './lib/rooms';
import { isValidRoomCode, normalizeRoomCode } from './lib/roomCode';
import type { Player, Room } from './shared/types';

type Stage =
  | { kind: 'offline' }
  | { kind: 'connecting' }
  | { kind: 'error'; message: string }
  | { kind: 'profile' }
  | { kind: 'lobby'; player: Player }
  | { kind: 'room'; player: Player; room: Room };

/**
 * Reads an invite link's room code (`?join=ABCD`) once, at startup, and
 * removes it from the address bar so a refresh doesn't rejoin.
 */
function takeInviteCode(): string | null {
  const params = new URLSearchParams(location.search);
  const raw = params.get('join');
  if (!raw) return null;
  params.delete('join');
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  const code = normalizeRoomCode(raw);
  return isValidRoomCode(code) ? code : null;
}

const INVITE_CODE = takeInviteCode();

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
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [inviteCode, setInviteCode] = useState(INVITE_CODE);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // Ignore a result that arrives after this effect is torn down (React runs it
    // twice in development); otherwise a slow load could undo a later choice,
    // like leaving the room.
    let current = true;
    initialStage(supabase)
      .then((s) => current && setStage(s))
      .catch((err) => current && setStage({ kind: 'error', message: errorMessage(err) }));
    return () => {
      current = false;
    };
  }, []);

  function enterRoom(player: Player, room: Room) {
    rememberRoom(room.id);
    setStage({ kind: 'room', player, room });
  }

  // Follow an invite link once you have a profile (right away for returning
  // players, after making an avatar for new ones).
  useEffect(() => {
    if (!supabase || !inviteCode || (stage.kind !== 'lobby' && stage.kind !== 'room')) return;
    setInviteCode(null);
    if (stage.kind === 'room' && stage.room.code === inviteCode) return;
    const player = stage.player;
    joinRoom(supabase, inviteCode)
      .then((room) => enterRoom(player, room))
      .catch((err) => {
        setInviteError(`Couldn't join ${inviteCode}: ${errorMessage(err)}`);
        if (stage.kind === 'room') {
          rememberRoom(null);
          setStage({ kind: 'lobby', player });
        }
      });
  }, [stage, inviteCode]);

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

  // Your position lives here so the room channel can broadcast it.
  const myState = useRef<PlayerState>(spawnState(null));
  const myId = me?.id ?? null;
  useEffect(() => {
    if (myId) myState.current = spawnState(myId);
  }, [myId]);

  const { members, refresh: refreshMembers } = useRoomMembers(supabase, roomId);
  const live = useRoomLive(supabase, roomId, myId, myState, refreshMembers);

  function avatarSaved(player: Player) {
    setEditingAvatar(false);
    setStage((s) => (s.kind === 'lobby' || s.kind === 'room' ? { ...s, player } : s));
    refreshMembers();
    live.announceProfile();
  }
  const todos = useRoomTodos(supabase, roomId, myId);
  const timer = useRoomTimer(supabase, roomId, chime);
  const sessions = useSessionCheckins(supabase, roomId);
  const island = useRoomIsland(supabase, stage.kind === 'room' ? stage.room : null);

  // Build mode: the dock's state, and what the island should show for it.
  const [buildUi, setBuildUi] = useState<BuildUi | null>(null);
  useEffect(() => setBuildUi(null), [roomId]);
  const islandBuild = useMemo<IslandBuild | null>(() => {
    if (!buildUi) return null;
    if (buildUi.mode !== 'place') return { ghost: null };
    return {
      ghost: {
        kind: buildUi.kind,
        rotation: buildUi.rotation,
        at: buildUi.at,
        fits: buildUi.at !== null && buildProblem(buildUi, island.items) === null,
      },
      movingId: buildUi.moving?.id,
    };
  }, [buildUi, island.items]);

  // Everyone's goal for the focus round in progress, shown above their animal.
  const goals = useMemo(() => {
    const byPlayer = new Map<string, string>();
    const t = timer.timer;
    if (t?.phase === 'focus') {
      for (const c of sessions.checkins) if (c.session_id === t.session_id) byPlayer.set(c.player_id, c.goal);
    }
    return byPlayer;
  }, [timer.timer, sessions.checkins]);

  // "2/5" next to each name on the island, once someone has tasks.
  const badges = useMemo(() => {
    const byPlayer = new Map<string, string>();
    for (const m of members) {
      const { done, total } = progressOf(todos.todos.filter((t) => t.player_id === m.player_id));
      if (total) byPlayer.set(m.player_id, `${done}/${total}`);
    }
    return byPlayer;
  }, [members, todos.todos]);

  const islandPlayer = useMemo<IslandPlayer | null>(
    () =>
      me
        ? {
            avatar: me.avatar,
            nickname: stage.kind === 'room' ? me.nickname : null,
            badge: badges.get(me.id),
            goal: goals.get(me.id),
          }
        : null,
    [me, stage.kind, badges, goals],
  );
  const others = useMemo<IslandOther[]>(
    () =>
      members
        .filter((m) => m.player_id !== myId && live.onlineIds.includes(m.player_id))
        .map((m) => ({
          id: m.player_id,
          avatar: m.avatar,
          nickname: m.nickname,
          badge: badges.get(m.player_id),
          goal: goals.get(m.player_id),
        })),
    [members, myId, live.onlineIds, badges, goals],
  );

  return (
    <div className={`app ${buildUi ? 'is-building' : ''}`}>
      <IslandScene
        player={islandPlayer}
        state={myState}
        onMove={live.sendPosition}
        others={others}
        remotes={live.remotes}
        items={island.items}
        build={islandBuild}
        onBuildPoint={(x, z) => setBuildUi((ui) => (ui?.mode === 'place' ? { ...ui, at: [x, z] } : ui))}
        onItemTap={(item) => setBuildUi({ mode: 'selected', item })}
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
        <AvatarCreator client={supabase} mode="create" onSaved={(player) => setStage({ kind: 'lobby', player })} />
      )}

      {supabase && stage.kind === 'lobby' && !editingAvatar && (
        <RoomGate
          client={supabase}
          player={stage.player}
          onEnter={(room) => enterRoom(stage.player, room)}
          onEditAvatar={() => setEditingAvatar(true)}
          notice={inviteError}
        />
      )}

      {supabase && stage.kind === 'room' && (
        <div className="hud-top">
          <RoomPanel
            room={stage.room}
            me={stage.player}
            members={members}
            onlineIds={live.onlineIds}
            island={island}
            onBuild={() => setBuildUi({ mode: 'shop' })}
            onEditAvatar={() => setEditingAvatar(true)}
            onLeave={() => leave(stage.player, stage.room)}
          />
          <div className="hud-center">
            <PomodoroPanel room={timer} isOwner={stage.room.owner_id === stage.player.id} />
            <CheckinCard
              timer={timer.timer}
              myId={stage.player.id}
              myTodos={todos.todos.filter((t) => t.player_id === stage.player.id)}
              sessions={sessions}
            />
          </div>
        </div>
      )}

      {supabase && stage.kind === 'room' && buildUi && <BuildDock ui={buildUi} setUi={setBuildUi} island={island} />}

      {supabase && stage.kind === 'room' && (
        <TodoPanel meId={stage.player.id} members={members} onlineIds={live.onlineIds} todos={todos} />
      )}

      {supabase && me && editingAvatar && (
        <AvatarCreator
          client={supabase}
          mode="edit"
          initial={me}
          onSaved={avatarSaved}
          onCancel={() => setEditingAvatar(false)}
        />
      )}
    </div>
  );
}
