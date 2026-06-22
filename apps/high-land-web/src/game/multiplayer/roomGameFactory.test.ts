import { describe, expect, it } from 'vitest';
import { createLocalTestPlayer } from './localRoomFlow';
import { createGameFromRoom, createNamedLocalGame } from './roomGameFactory';
import type { HighLandRoomState } from './roomState';

function makeRoom(): HighLandRoomState {
  return {
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
}

describe('room game factory', () => {
  it('creates a named local game', () => {
    const game = createNamedLocalGame(4, 'Blaze Runner');

    expect(game.players).toHaveLength(4);
    expect(game.players[0].name).toBe('Blaze Runner');
    expect(game.message).toBe('Blaze Runner, roll to begin.');
  });

  it('creates a game from room players', () => {
    const game = createGameFromRoom(makeRoom());

    expect(game.players).toHaveLength(2);
    expect(game.players[0].name).toBe('Player 1');
    expect(game.players[1].name).toBe('Player 2');
  });
});
