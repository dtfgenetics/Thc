import { describe, expect, it } from 'vitest';
import { createLocalTestPlayer, getRoomPlayerNames } from './localRoomFlow';
import type { HighLandRoomState } from './roomState';

describe('local room flow', () => {
  it('creates local test players with stable names and tokens', () => {
    const player = createLocalTestPlayer(1);

    expect(player.name).toBe('Player 2');
    expect(player.token).toBe('tokenB');
  });

  it('returns room player names in order', () => {
    const room: HighLandRoomState = {
      id: 'room-1',
      code: 'ABCD23',
      status: 'waiting',
      hostPlayerId: 'local-player-1',
      players: [
        { ...createLocalTestPlayer(0), joinedAt: 'now', connected: true, host: true },
        { ...createLocalTestPlayer(1), joinedAt: 'now', connected: true, host: false }
      ],
      gameState: null,
      createdAt: 'now',
      updatedAt: 'now'
    };

    expect(getRoomPlayerNames(room)).toEqual(['Player 1', 'Player 2']);
  });
});
