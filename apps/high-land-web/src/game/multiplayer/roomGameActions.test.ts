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

function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
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
    expect(result.events[0].payload).toMatchObject({ roll: 1, fromIndex: 0, toIndex: 1 });
  });

  it('creates a HIT card event when a room player lands on HIT', () => {
    const started = startRoomGameplay(makeRoom());
    const gameState = started.room.gameState;
    if (!gameState) throw new Error('Expected room game state.');
    const roomAtHitApproach: HighLandRoomState = {
      ...started.room,
      gameState: {
        ...gameState,
        players: gameState.players.map((player, index) => (index === 0 ? { ...player, positionIndex: 4 } : player))
      }
    };

    const result = rollRoomGameplay(roomAtHitApproach, sequenceRandom([0, 0.999]));

    expect(result.events.map((event) => event.name)).toEqual(['dice_rolled', 'hit_card_drawn']);
    expect(result.events[0].payload).toMatchObject({ roll: 1, fromIndex: 4, toIndex: 5 });
    expect(result.events[1].payload).toMatchObject({ card: { id: 'card-030' } });
    expect(result.room.gameState?.players[0].positionIndex).toBe(13);
  });

  it('creates a skip event instead of a dice event when a room player loses a turn', () => {
    const started = startRoomGameplay(makeRoom());
    const gameState = started.room.gameState;
    if (!gameState) throw new Error('Expected room game state.');
    const roomWithSkippedPlayer: HighLandRoomState = {
      ...started.room,
      gameState: {
        ...gameState,
        players: gameState.players.map((player, index) => (index === 0 ? { ...player, skipTurns: 1 } : player))
      }
    };

    const result = rollRoomGameplay(roomWithSkippedPlayer);

    expect(result.events.map((event) => event.name)).toEqual(['skip_turn_applied']);
    expect(result.events[0].payload).toMatchObject({ skippedPlayerId: 'local-player-1', skipTurns: 0 });
    expect(result.room.gameState?.lastRoll).toBeNull();
  });
});
