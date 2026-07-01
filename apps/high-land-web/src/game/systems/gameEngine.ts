import { boardPath, finishIndex } from '../data/boardPath';
import type { GameState, TurnDirection } from '../types/gameTypes';
import { drawActionCard, applyActionCard } from './cardSystem';
import { rollDie } from './diceSystem';
import { calculateMove } from './movementSystem';
import { createPlayers } from './playerSystem';
import { getCurrentPlayer, nextPlayerIndex, shouldSkipTurn } from './turnSystem';

export function createInitialGame(playerCount: number): GameState {
  return {
    players: createPlayers(playerCount),
    currentPlayerIndex: 0,
    phase: 'ready',
    turnDirection: 1,
    reverseTurnsRemaining: 0,
    lastRoll: null,
    lastMove: null,
    lastCard: null,
    message: 'Game ready. Roll to begin.',
    winnerId: null,
    cardCursor: 0
  };
}

export function rollCurrentTurn(state: GameState, random: () => number = Math.random): GameState {
  if (state.phase === 'game_over') return state;
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
      lastMove: null,
      lastCard: null
    };
  }

  const result = rollDie(random);
  const move = calculateMove(currentPlayer.positionIndex, result, finishIndex);
  const lastMove = { ...move, playerId: currentPlayer.id };
  const landedSpace = boardPath[move.toIndex];

  const players = state.players.map((player) =>
    player.id === currentPlayer.id ? { ...player, positionIndex: move.toIndex } : player
  );

  if (move.toIndex >= finishIndex) {
    return {
      ...state,
      players,
      phase: 'game_over',
      lastRoll: result,
      lastMove,
      lastCard: null,
      winnerId: currentPlayer.id,
      message: `${currentPlayer.name} rolled ${result} and reached the finish.`
    };
  }

  if (landedSpace.action === 'draw_hit_card') {
    const draw = drawActionCard(state.cardCursor, undefined, random);
    const stateAfterLanding: GameState = {
      ...state,
      players,
      phase: 'resolving_card',
      lastRoll: result,
      lastMove,
      lastCard: draw.card,
      cardCursor: draw.nextCursor,
      message: `${currentPlayer.name} rolled ${result}, landed on HIT, and drew ${draw.card.title}.`
    };
    return applyActionCard(stateAfterLanding, draw.card, 0, random);
  }

  const directionState = reduceReverseTurnCounter(state);
  const updatedCurrentPlayer = players.find((player) => player.id === currentPlayer.id) ?? currentPlayer;
  return {
    ...state,
    ...directionState,
    players,
    phase: 'ready',
    lastRoll: result,
    lastMove,
    lastCard: null,
    currentPlayerIndex: nextPlayerIndex(players, state.currentPlayerIndex, directionState.turnDirection),
    message: `${currentPlayer.name} rolled ${result} and moved to space ${updatedCurrentPlayer.positionIndex + 1}.`
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
