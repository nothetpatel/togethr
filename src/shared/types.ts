import type { ItemKind } from './catalog';

// Shapes shared by the client and the Supabase schema
// (supabase/migrations/0001_init.sql). Keep the two in sync.

export const ANIMALS = ['dog', 'cat', 'panda', 'koala', 'turtle', 'duck'] as const;
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
  /** Seeds in the shared jar, and all seeds ever earned (sets the level). */
  seeds: number;
  seeds_earned: number;
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
  /** New for each focus round; check-ins belong to one. */
  session_id: string;
  updated_at: string;
}

/** Something built on a room's island (migration 0004). */
export interface RoomItem {
  id: string;
  room_id: string;
  kind: ItemKind;
  x: number;
  z: number;
  rotation: number;
  placed_by: string | null;
  created_at: string;
}

/** Someone's goal for one focus round, and how it went. */
export interface SessionCheckin {
  id: string;
  room_id: string;
  session_id: string;
  player_id: string;
  goal: string;
  todo_id: string | null;
  outcome: 'done' | 'partly' | 'not' | null;
  /** Set when the round finishes; 0 until then. */
  seeds_awarded: number;
  created_at: string;
}

/**
 * Ephemeral position broadcast on the room's private realtime channel (not
 * stored). Sent when you tap somewhere new, plus a heartbeat.
 */
export interface PositionMessage {
  id: string; // player id
  x: number;
  z: number;
  h: number; // heading, radians
  tx: number | null; // walking target, or null when standing
  tz: number | null;
}
