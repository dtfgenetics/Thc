import { describe, expect, it } from 'vitest';
import { maxPlayers, tokenColors, tokenOrder } from '../systems/playerSystem';
import type { HighLandRoomPlayer, HighLandRoomState } from './roomState';
import { upsertRoomPlayer } from './roomState';

function makePlayer(index: number): HighLandRoomPlayer {
  return {
    id: `local-player-${index + 1}`,
    name: `Player ${index + 1}`,
    token: tokenOrder[index],
    color: tokenColors[index],
    joinedAt: 'now',
    connected: true,
    host: index === 0
  };
}

function makeRoom(playerCount: number): HighLandRoomState {
  return {
    id: 'room-1',
    code: 'ABCD23',
    status: 'waiting',
    hostPlayerId: 'local-player-1',
    players: Array.from({ length: playerCount }, (_, index) => makePlayer(index)),
    gameState: null,
    createdAt: 'now',
    updatedAt: 'now'
  };
}

describe('room state', () => {
  it('upserts an existing player without changing room size', () => {
    const room = makeRoom(2);
    const updated = upsertRoomPlayer(room, { ...room.players[1], name: 'Updated Guest' });

    expect(updated.players).toHaveLength(2);
    expect(updated.players[1].name).toBe('Updated Guest');
  });

  it('prevents adding players past the max room capacity', () => {
    const room = makeRoom(maxPlayers);
    const extraPlayer = {
      ...makePlayer(maxPlayers - 1),
      id: 'local-player-extra',
      name: 'Extra Player'
    };

    expect(() => upsertRoomPlayer(room, extraPlayer)).toThrow('High Land supports up to 10 players.');
  });
});
