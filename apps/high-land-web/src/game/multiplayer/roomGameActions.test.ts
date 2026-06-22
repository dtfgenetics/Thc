import { describe, expect, it } from 'vitest';
import { createLocalTestPlayer } from './localRoomFlow';
import { rollRoomGameplay, startRoomGameplay } from './roomGameActions';
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

describe('room game actions', () => {
  it('starts room gameplay and creates an event', () => {
    const result = startRoomGameplay(makeRoom());

    expect(result.room.status).toBe('playing');
    expect(result.room.gameState?.players).toHaveLength(2);
    expect(result.events[0].name).toBe('game_started');
  });

  it('rolls room gameplay and creates a dice event', () => {
    const started = startRoomGameplay(makeRoom());
    const result = rollRoomGameplay(started.room, () => 0);

    expect(result.room.gameState?.lastRoll).toBe(1);
    expect(result.events[0].name).toBe('dice_rolled');
    expect(result.events[0].payload).toMatchObject({ roll: 1 });
  });
});
