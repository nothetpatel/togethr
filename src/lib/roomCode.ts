// Room codes are generated server-side by create_room() in
// supabase/migrations/0001_init.sql; this file handles what people type in.

/** 24 letters: A–Z without I and O, which are easy to confuse with 1 and 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

const CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Uppercases and strips anything that isn't a letter: " ab-cd " → "ABCD". */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
