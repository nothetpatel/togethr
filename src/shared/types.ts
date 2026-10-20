// Shapes shared by the client and the Supabase schema
// (supabase/migrations/0001_init.sql). Keep the two in sync.

export const ANIMALS = ['dog', 'cat', 'panda', 'koala', 'turtle'] as const;
export type Animal = (typeof ANIMALS)[number];

export interface Avatar {
  animal: Animal;
  color: string; // hex, e.g. "#ffb5c8"
}

export interface Player {
  id: string; // = auth.users.id (anonymous sign-in)
  nickname: string;
  avatar: Avatar;
  created_at: string;
}

export interface Room {
  id: string;
  code: string; // 4 letters, see lib/roomCode.ts
  owner_id: string;
  created_at: string;
  last_active_at: string;
}

export interface RoomMember {
  room_id: string;
  player_id: string;
  joined_at: string;
  last_seen_at: string;
}

export interface Todo {
  id: string;
  room_id: string;
  player_id: string;
  text: string;
  done: boolean;
  created_at: string;
}

export type TimerPhase = 'focus' | 'short_break' | 'long_break';
export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerState {
  room_id: string;
  phase: TimerPhase;
  status: TimerStatus;
  duration_ms: number;
  ends_at: string | null; // set while running (server clock)
  remaining_ms: number | null; // set while paused
  cycle_count: number;
  focus_ms: number;
  short_break_ms: number;
  long_break_ms: number;
  updated_at: string;
}

/** Ephemeral position broadcast on the room's realtime channel (not stored). */
export interface PositionUpdate {
  player_id: string;
  x: number;
  z: number;
  t: number; // sender's ms timestamp, for interpolation ordering
}
