import { boardPath, finishIndex } from '../data/boardPath';
import type { GameState, TurnDirection } from '../types/gameTypes';
import { drawActionCard, applyActionCard } from './cardSystem';
import { rollDie } from './diceSystem';
import { calculateMove } from './movementSystem';
import { createPlayers } from './playerSystem';
import { getCurrentPlayer, nextPlayerIndex, shouldSkipTurn } from './turnSystem';

export function createInitialGame(playerCount: number, playerNames: string[] = []): GameState {
  return {
    players: createPlayers(playerCount, playerNames),
    currentPlayerIndex: 0,
    phase: 'ready',
    turnDirection: 1,
    reverseTurnsRemaining: 0,
    lastRoll: null,
    lastCard: null,
    message: 'Game ready. Roll to begin.',
    winnerId: null,
    cardCursor: 0,
    pendingChoice: null
  };
}

export function rollCurrentTurn(state: GameState, random: () => number = Math.random): GameState {
  if (state.phase === 'game_over' || state.phase === 'choosing_player') return state;
  const currentPlayer = getCurrentPlayer(state.players, state.currentPlayerIndex);

  if (shouldSkipTurn(currentPlayer)) {
    const players = state.players.map((player) =>
      player.id === currentPlayer.id ? { ...player, skipTurns: player.skipTurns - 1 } : player
    );
    const directionState = reduceReverseTurnCounter(state);

    return {
      ...state,
      ...directionState,
      players,
      phase: 'ready',
      currentPlayerIndex: nextPlayerIndex(players, state.currentPlayerIndex, directionState.turnDirection),
      message: `${currentPlayer.name} skipped this turn.`,
      lastRoll: null,
      lastCard: null
    };
  }

  const result = rollDie(random);
  const move = calculateMove(currentPlayer.positionIndex, result, finishIndex);
  const landedSpace = boardPath[move.toIndex];

  let players = state.players.map((player) =>
    player.id === currentPlayer.id ? { ...player, positionIndex: move.toIndex } : player
  );

  if (move.toIndex >= finishIndex) {
    return {
      ...state,
      players,
      phase: 'game_over',
      lastRoll: result,
      lastCard: null,
      winnerId: currentPlayer.id,
      message: `${currentPlayer.name} reached Cloud 9 Citadel and wins!`
    };
  }

  if (landedSpace.type === 'skip') {
    players = players.map((player) =>
      player.id === currentPlayer.id ? { ...player, skipTurns: player.skipTurns + 1 } : player
    );
    const directionState = reduceReverseTurnCounter(state);

    return {
      ...state,
      ...directionState,
      players,
      phase: 'ready',
      lastRoll: result,
      lastCard: null,
      currentPlayerIndex: nextPlayerIndex(players, state.currentPlayerIndex, directionState.turnDirection),
      message: `${currentPlayer.name} rolled ${result}, landed on SKIP, and will skip the next turn.`
    };
  }

  if (landedSpace.type === 'boost') {
    players = players.map((player) =>
      player.id === currentPlayer.id ? { ...player, positionIndex: calculateMove(player.positionIndex, 2, finishIndex).toIndex } : player
    );
  }

  if (landedSpace.type === 'trap') {
    players = players.map((player) => {
      if (player.id !== currentPlayer.id) return player;
      if (player.protectedFromBackward > 0) return { ...player, protectedFromBackward: player.protectedFromBackward - 1 };
      return { ...player, positionIndex: calculateMove(player.positionIndex, -2, finishIndex).toIndex };
    });
  }

  if (landedSpace.type === 'safe') {
    players = players.map((player) =>
      player.id === currentPlayer.id ? { ...player, protectedFromBackward: player.protectedFromBackward + 1 } : player
    );
  }

  const updatedCurrentPlayer = players.find((player) => player.id === currentPlayer.id) ?? currentPlayer;
  if (updatedCurrentPlayer.positionIndex >= finishIndex) {
    return {
      ...state,
      players,
      phase: 'game_over',
      lastRoll: result,
      lastCard: null,
      winnerId: currentPlayer.id,
      message: `${currentPlayer.name} reached Cloud 9 Citadel and wins!`
    };
  }

  if (landedSpace.type === 'action') {
    const draw = drawActionCard(state.cardCursor);
    const stateAfterLanding: GameState = {
      ...state,
      players,
      phase: 'resolving_card',
      lastRoll: result,
      lastCard: draw.card,
      cardCursor: draw.nextCursor,
      message: `${currentPlayer.name} rolled ${result} and drew ${draw.card.title}.`
    };
    return applyActionCard(stateAfterLanding, draw.card);
  }

  const directionState = reduceReverseTurnCounter(state);
  return {
    ...state,
    ...directionState,
    players,
    phase: 'ready',
    lastRoll: result,
    lastCard: null,
    currentPlayerIndex: nextPlayerIndex(players, state.currentPlayerIndex, directionState.turnDirection),
    message: `${currentPlayer.name} rolled ${result} and moved to space ${updatedCurrentPlayer.positionIndex}.`
  };
}

export function restartGame(playerCount: number): GameState {
  return createInitialGame(playerCount);
}

function reduceReverseTurnCounter(state: GameState): Pick<GameState, 'turnDirection' | 'reverseTurnsRemaining'> {
  if (state.reverseTurnsRemaining <= 0) {
    return { turnDirection: state.turnDirection, reverseTurnsRemaining: 0 };
  }

  const remaining = state.reverseTurnsRemaining - 1;
  const turnDirection: TurnDirection = remaining <= 0 ? 1 : state.turnDirection;
  return { turnDirection, reverseTurnsRemaining: remaining };
}
