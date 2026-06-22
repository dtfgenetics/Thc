import { describe, expect, it } from 'vitest';
import { createLocalRoomMode, startLocalRoomMode } from './highLandRoomModeService';

describe('High Land room mode service', () => {
  it('creates a local room mode result', () => {
    const result = createLocalRoomMode('Room Host', 4);

    expect(result.room.players[0].name).toBe('Room Host');
    expect(result.localPlayerName).toBe('Room Host');
    expect(result.inviteUrl).toContain(`room=${result.room.code}`);
    expect(result.playerCount).toBe(4);
  });

  it('starts a room mode game from room players', () => {
    const roomResult = createLocalRoomMode('Room Host', 2);
    const startResult = startLocalRoomMode({
      ...roomResult.room,
      players: [
        ...roomResult.room.players,
        {
          id: 'player-2',
          name: 'Guest Player',
          token: 'tokenB',
          color: '#22c55e',
          joinedAt: 'now',
          connected: true,
          host: false
        }
      ]
    });

    expect(startResult.playerCount).toBe(2);
    expect(startResult.gameState.players[0].name).toBe('Room Host');
    expect(startResult.gameState.players[1].name).toBe('Guest Player');
    expect(startResult.message).toBe('Room Host, roll to begin.');
  });
});
