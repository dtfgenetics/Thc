import { describe, expect, it } from 'vitest';
import { addLocalTestPlayerToRoom, createLocalTestPlayer, getRoomPlayerNames } from './localRoomFlow';
import type { HighLandRoomState } from './roomState';

function makeRoom(playerCount = 2): HighLandRoomState {
  return {
    id: 'room-1',
    code: 'ABCD23',
    status: 'waiting',
    hostPlayerId: 'local-player-1',
    players: Array.from({ length: playerCount }, (_, index) => ({
      ...createLocalTestPlayer(index),
      joinedAt: 'now',
      connected: true,
      host: index === 0
    })),
    gameState: null,
    createdAt: 'now',
    updatedAt: 'now'
  };
}

describe('local room flow', () => {
  it('creates local test players with stable names and tokens', () => {
    const player = createLocalTestPlayer(1);

    expect(player.name).toBe('Player 2');
    expect(player.token).toBe('tokenB');
  });

  it('returns room player names in order', () => {
    expect(getRoomPlayerNames(makeRoom())).toEqual(['Player 1', 'Player 2']);
  });

  it('prevents adding test players past room capacity', () => {
    expect(() => addLocalTestPlayerToRoom(makeRoom(10))).toThrow('High Land supports up to 10 players.');
  });
});
