import { createGameEvent, type DiceRolledEvent, type GameStartedEvent, type HighLandGameEvent, type HitCardDrawnEvent, type SkipTurnAppliedEvent, type WinnerDeclaredEvent } from '../events/gameEvents';
import { finishIndex } from '../data/boardPath';
import { rollCurrentTurn } from '../systems/gameEngine';
import { calculateMove } from '../systems/movementSystem';
import type { HighLandRoomState } from './roomState';
import { createGameFromRoom } from './roomGameFactory';

export type RoomActionResult = {
  room: HighLandRoomState;
  events: HighLandGameEvent[];
};

export function startRoomGameplay(room: HighLandRoomState): RoomActionResult {
  const gameState = createGameFromRoom(room);
  const updatedRoom: HighLandRoomState = {
    ...room,
    status: 'playing',
    gameState,
    updatedAt: new Date().toISOString()
  };

  const event = createGameEvent<GameStartedEvent>({
    name: 'game_started',
    roomCode: room.code,
    playerId: room.hostPlayerId,
    payload: { playerCount: gameState.players.length }
  });

  return { room: updatedRoom, events: [event] };
}

export function rollRoomGameplay(room: HighLandRoomState, random: () => number = Math.random): RoomActionResult {
  if (room.status !== 'playing' || !room.gameState) {
    throw new Error('Room is not currently playing.');
  }

  const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
  const fromIndex = currentPlayer?.positionIndex ?? 0;
  const nextGameState = rollCurrentTurn(room.gameState, random);
  const updatedPlayer = currentPlayer ? nextGameState.players.find((player) => player.id === currentPlayer.id) : null;
  const diceLandingIndex = nextGameState.lastRoll === null
    ? fromIndex
    : calculateMove(fromIndex, nextGameState.lastRoll, finishIndex).toIndex;
  const updatedRoom: HighLandRoomState = {
    ...room,
    status: nextGameState.winnerId ? 'complete' : 'playing',
    gameState: nextGameState,
    updatedAt: new Date().toISOString()
  };

  const events: HighLandGameEvent[] = [];

  if (nextGameState.lastRoll === null && currentPlayer) {
    events.push(
      createGameEvent<SkipTurnAppliedEvent>({
        name: 'skip_turn_applied',
        roomCode: room.code,
        playerId: currentPlayer.id,
        payload: {
          skippedPlayerId: currentPlayer.id,
          skipTurns: updatedPlayer?.skipTurns ?? 0
        }
      })
    );
  } else {
    events.push(
      createGameEvent<DiceRolledEvent>({
        name: 'dice_rolled',
        roomCode: room.code,
        playerId: currentPlayer?.id ?? null,
        payload: {
          roll: nextGameState.lastRoll ?? 0,
          fromIndex,
          toIndex: diceLandingIndex
        }
      })
    );
  }

  if (nextGameState.lastCard) {
    events.push(
      createGameEvent<HitCardDrawnEvent>({
        name: 'hit_card_drawn',
        roomCode: room.code,
        playerId: currentPlayer?.id ?? null,
        payload: {
          card: nextGameState.lastCard
        }
      })
    );
  }

  if (nextGameState.winnerId) {
    events.push(
      createGameEvent<WinnerDeclaredEvent>({
        name: 'winner_declared',
        roomCode: room.code,
        playerId: nextGameState.winnerId,
        payload: {
          winnerId: nextGameState.winnerId,
          finishIndex
        }
      })
    );
  }

  return { room: updatedRoom, events };
}
