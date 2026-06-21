import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from './roomTypes';
import { mergeRoomSnapshot } from './roomSync';

function room(version: number, status: RoomSnapshot['status']): RoomSnapshot {
  return {
    gameId: 'ABC234',
    status,
    hostPlayerId: 'host',
    players: [],
    gameState: null,
    version,
    updatedAt: version,
    maxPlayers: 10
  };
}

describe('room snapshot ordering', () => {
  it('rejects a stale lobby response after the game starts', () => {
    const playing = room(3, 'playing');
    expect(mergeRoomSnapshot(playing, room(2, 'lobby'))).toBe(playing);
  });

  it('accepts a newer room version', () => {
    expect(mergeRoomSnapshot(room(2, 'lobby'), room(3, 'playing')).status).toBe('playing');
  });
});
