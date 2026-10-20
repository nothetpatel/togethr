// End-to-end check of the Supabase schema and security rules, using two
// throwaway anonymous players (an owner and a guest).
// Usage: npm run smoke:db   (needs .env.local and anonymous sign-ins enabled)
//
// Each run leaves two anonymous users and one room behind; idle rooms are
// removed by cleanup_idle_rooms() and anonymous users can be cleared in
// Authentication → Users.

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), 'VITE_');
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Fill in .env.local first');

const newClient = () => createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

async function player(nickname, animal) {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`anonymous sign-in: ${error.message}`);
  const id = data.user.id;
  const res = await client.from('players').upsert({ id, nickname, avatar: { animal, color: '#ffb5c8' } });
  check(`${nickname} creates a profile`, !res.error, res.error?.message);
  return { client, id };
}

const owner = await player('smoke-owner', 'cat');
const guest = await player('smoke-guest', 'panda');

// Rooms
const { data: room, error: createErr } = await owner.client.rpc('create_room');
check('owner creates a room', !createErr && /^[A-HJ-NP-Z]{4}$/.test(room?.code ?? ''), createErr?.message ?? room?.code);

const hidden = await guest.client.from('rooms').select('id').eq('id', room.id);
check('guest cannot see the room before joining', hidden.data?.length === 0);

const badJoin = await guest.client.rpc('join_room', { p_code: 'ZZZZ' === room.code ? 'YYYY' : 'ZZZZ' });
check('joining a wrong code fails', !!badJoin.error, badJoin.error?.message);

const join = await guest.client.rpc('join_room', { p_code: room.code.toLowerCase() });
check('guest joins with the code (any case)', !join.error && join.data?.id === room.id, join.error?.message);

const members = await guest.client.from('room_members').select('player_id').eq('room_id', room.id);
check('guest sees both members', members.data?.length === 2);

const names = await guest.client.from('players').select('nickname').in('id', [owner.id, guest.id]);
check('guest sees the owner’s profile', names.data?.length === 2);

// To-dos
const todo = await owner.client
  .from('todos')
  .insert({ room_id: room.id, player_id: owner.id, text: 'smoke test todo' })
  .select()
  .single();
check('owner adds a todo', !todo.error, todo.error?.message);

const guestSees = await guest.client.from('todos').select('id').eq('room_id', room.id);
check('guest can see the owner’s todo', guestSees.data?.length === 1);

const hijack = await guest.client.from('todos').update({ done: true }).eq('id', todo.data.id).select();
check('guest cannot tick the owner’s todo', (hijack.data?.length ?? 0) === 0);

const forged = await guest.client.from('todos').insert({ room_id: room.id, player_id: owner.id, text: 'forged' });
check('guest cannot add a todo as the owner', !!forged.error);

// Timer
const start = await owner.client.rpc('timer_control', { p_room: room.id, p_action: 'start' });
check('owner starts the timer', !start.error && start.data?.status === 'running', start.error?.message);

const guestPause = await guest.client.rpc('timer_control', { p_room: room.id, p_action: 'pause' });
check('guest cannot control the timer', !!guestPause.error, guestPause.error?.message);

const directWrite = await guest.client.from('timer_state').update({ status: 'idle' }).eq('room_id', room.id).select();
check('guest cannot write the timer table directly', !!directWrite.error || (directWrite.data?.length ?? 0) === 0);

const timer = await guest.client.from('timer_state').select('status, ends_at').eq('room_id', room.id).single();
check('guest sees the running timer', timer.data?.status === 'running' && !!timer.data?.ends_at);

const now = await guest.client.rpc('server_now');
check('server_now works', !now.error && !Number.isNaN(Date.parse(now.data)), now.error?.message);

// Private live channel: members can join `room:<id>`, strangers can't.
async function joinChannel(client) {
  await client.realtime.setAuth();
  const channel = client.channel(`room:${room.id}`, { config: { private: true } });
  const status = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('TIMED_OUT'), 8000);
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR') {
        clearTimeout(timer);
        resolve(s);
      }
    });
  });
  await client.removeChannel(channel);
  return status;
}
const memberJoin = await joinChannel(guest.client);
check('member can join the room’s live channel', memberJoin === 'SUBSCRIBED', memberJoin);
const outsider = await player('smoke-outsider', 'koala');
const outsiderJoin = await joinChannel(outsider.client);
check('non-member cannot join the room’s live channel', outsiderJoin === 'CHANNEL_ERROR', outsiderJoin);

// Logged-out visitors get nothing
const stranger = newClient();
const strangerRoom = await stranger.rpc('create_room');
check('visitor without a session cannot create rooms', !!strangerRoom.error);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
