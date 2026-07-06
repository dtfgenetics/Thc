import { describe, expect, it } from 'vitest';
import { canStartRoomSession, formatRoomSession, startRoomSession } from './roomSessionController';
import { createLocalTestPlayer } from './localRoomFlow';
import type { HighLandRoomState } from './roomState';

function makeRoom(players = [createLocalTestPlayer(0)]): HighLandRoomState {
  return {
    id: 'room-1',
    code: 'ABCD23',
    status: 'waiting',
    hostPlayerId: 'local-player-1',
    players: players.map((player, index) => ({
      ...player,
      joinedAt: 'now',
      connected: true,
      host: index === 0
    })),
    gameState: null,
    createdAt: 'now',
    updatedAt: 'now'
  };
}

describe('room session controller', () => {
  it('formats a room session with invite URL', () => {
    const session = formatRoomSession(makeRoom());

    expect(session.room.code).toBe('ABCD23');
    expect(session.inviteUrl).toContain('game=ABCD23');
  });

  it('only allows host to start with at least two players', () => {
    expect(canStartRoomSession(makeRoom(), 'local-player-1')).toBe(false);
    expect(canStartRoomSession(makeRoom([createLocalTestPlayer(0), createLocalTestPlayer(1)]), 'local-player-1')).toBe(true);
    expect(canStartRoomSession(makeRoom([createLocalTestPlayer(0), createLocalTestPlayer(1)]), 'local-player-2')).toBe(false);
  });

  it('starts a room session as a game state', () => {
    const result = startRoomSession(makeRoom([createLocalTestPlayer(0), createLocalTestPlayer(1)]));

    expect(result.playerCount).toBe(2);
    expect(result.leadPlayerName).toBe('Player 1');
    expect(result.gameState.players[1].name).toBe('Player 2');
  });
});
