import { describe, expect, it } from 'vitest';
import { createRoomCode, isValidRoomCode, normalizeRoomCode, requireValidRoomCode } from './roomCodes';

describe('room codes', () => {
  it('normalizes room code input', () => {
    expect(normalizeRoomCode(' ab-12 cd ')).toBe('AB12CD');
  });

  it('creates supported room codes', () => {
    const code = createRoomCode(() => 0.1, 6);
    expect(code).toHaveLength(6);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it('clamps random edge values while creating room codes', () => {
    expect(createRoomCode(() => 1, 4)).toHaveLength(4);
    expect(isValidRoomCode(createRoomCode(() => 1, 4))).toBe(true);
    expect(isValidRoomCode(createRoomCode(() => -1, 4))).toBe(true);
  });

  it('rejects unsupported room codes', () => {
    expect(isValidRoomCode('O0I1')).toBe(false);
    expect(() => requireValidRoomCode('bad!')).toThrow();
  });
});
