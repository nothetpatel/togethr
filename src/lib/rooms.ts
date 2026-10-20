import type { SupabaseClient } from '@supabase/supabase-js';
import type { Avatar, Player, Room } from '../shared/types';

export interface MemberWithProfile {
  player_id: string;
  joined_at: string;
  nickname: string;
  avatar: Avatar;
}

export async function getMyPlayer(client: SupabaseClient, id: string): Promise<Player | null> {
  const { data, error } = await client.from('players').select().eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Player | null;
}

export async function createRoom(client: SupabaseClient): Promise<Room> {
  const { data, error } = await client.rpc('create_room');
  if (error) throw error;
  return data as Room;
}

export async function joinRoom(client: SupabaseClient, code: string): Promise<Room> {
  const { data, error } = await client.rpc('join_room', { p_code: code });
  if (error) throw error;
  return data as Room;
}

/** Null if the room is gone or you're no longer a member (RLS hides it). */
export async function getRoom(client: SupabaseClient, id: string): Promise<Room | null> {
  const { data, error } = await client.from('rooms').select().eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

/** Rooms you're a member of, most recently active first. */
export async function listMyRooms(client: SupabaseClient): Promise<Room[]> {
  const { data, error } = await client
    .from('rooms')
    .select()
    .order('last_active_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data as Room[];
}

export async function leaveRoom(client: SupabaseClient, roomId: string, playerId: string): Promise<void> {
  const { error } = await client
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) throw error;
}

export async function fetchMembers(client: SupabaseClient, roomId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await client
    .from('room_members')
    .select('player_id, joined_at, players(nickname, avatar)')
    .eq('room_id', roomId)
    .order('joined_at');
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = row.players as unknown as { nickname: string; avatar: Avatar } | null;
    return {
      player_id: row.player_id as string,
      joined_at: row.joined_at as string,
      nickname: profile?.nickname ?? 'Someone',
      avatar: profile?.avatar ?? { animal: 'cat', color: '#ffb5c8' },
    };
  });
}

// The room you were last in, so a refresh drops you back into it.
const LAST_ROOM_KEY = 'togethr.lastRoomId';

export function rememberRoom(roomId: string | null): void {
  try {
    if (roomId) localStorage.setItem(LAST_ROOM_KEY, roomId);
    else localStorage.removeItem(LAST_ROOM_KEY);
  } catch {
    // storage blocked (private mode); refresh just returns to the lobby
  }
}

export function lastRoomId(): string | null {
  try {
    return localStorage.getItem(LAST_ROOM_KEY);
  } catch {
    return null;
  }
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return String(err);
}
