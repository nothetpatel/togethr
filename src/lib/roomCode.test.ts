import { describe, expect, it } from 'vitest';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from './roomCode';

describe('room codes', () => {
  it('uses 24 letters without I or O', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(24);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO]/);
  });

  it('normalizes typed input', () => {
    expect(normalizeRoomCode(' ab-cd ')).toBe('ABCD');
    expect(normalizeRoomCode('abcdef')).toBe('ABCD');
    expect(normalizeRoomCode('a1b2')).toBe('AB');
  });

  it('validates codes', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCO')).toBe(false);
    expect(isValidRoomCode('abcd')).toBe(false);
  });
});
