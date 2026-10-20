import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Avatar, Player } from '../shared/types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null until .env.local is filled in, so the island still renders offline. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/**
 * Returns the player ID for this browser. Uses Supabase anonymous sign-in: no
 * password, the session is kept in localStorage, and auth.uid() becomes the
 * player ID so row-level security can tell players apart.
 */
export function getPlayerId(client: SupabaseClient): Promise<string> {
  // Shared so concurrent callers (e.g. React StrictMode's double effect) don't
  // each sign in and create two anonymous users.
  playerIdPromise ??= signInOnce(client).catch((err) => {
    playerIdPromise = null;
    throw err;
  });
  return playerIdPromise;
}

let playerIdPromise: Promise<string> | null = null;

async function signInOnce(client: SupabaseClient): Promise<string> {
  const { data: existing } = await client.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('Anonymous sign-in failed');
  return data.user.id;
}

/** Creates or updates this browser's player profile. */
export async function savePlayer(
  client: SupabaseClient,
  nickname: string,
  avatar: Avatar,
): Promise<Player> {
  const id = await getPlayerId(client);
  const { data, error } = await client
    .from('players')
    .upsert({ id, nickname, avatar })
    .select()
    .single();
  if (error) throw error;
  return data as Player;
}

/** Server clock offset in ms (server - local), used by lib/timer.ts. */
export async function measureClockOffset(client: SupabaseClient): Promise<number> {
  const sentAt = Date.now();
  const { data, error } = await client.rpc('server_now');
  const receivedAt = Date.now();
  if (error) throw error;
  const serverMs = new Date(data as string).getTime();
  return serverMs - (sentAt + receivedAt) / 2;
}
