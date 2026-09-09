import { finishIndex } from '../data/boardPath';
import type { ActionCard, ActionCardEffect, GameState, Player, TurnDirection } from '../types/gameTypes';
import { calculateMove } from './movementSystem';
import { nextPlayerIndex, reduceReverseTurnCounter } from './turnSystem';
import {
  filterPlayersForGroupMove,
  findLastPlace,
  findLeader,
  findNextColorSpace,
  findPlayerBehind,
  findPreviousColorSpace
} from './targetingSystem';

export type EffectResolution = {
  state: GameState;
  keepTurn: boolean;
  drawAgain: boolean;
};

export function resolveActionCard(state: GameState, card: ActionCard, random: () => number = Math.random): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  const resolution = applyEffect(state, currentPlayer, card.effect, random);
  const winner = findWinner(resolution.state.players);
  const isChoosingPlayer = Boolean(resolution.state.pendingChoice) && !winner;
  const shouldAdvanceTurn = !winner && !isChoosingPlayer && !resolution.keepTurn && !resolution.drawAgain;
  const directionState = shouldAdvanceTurn && card.effect.type !== 'reverse_turn_order'
    ? reduceReverseTurnCounter(resolution.state)
    : {
        turnDirection: resolution.state.turnDirection,
        reverseTurnsRemaining: resolution.state.reverseTurnsRemaining
      };

  return {
    ...resolution.state,
    ...directionState,
    lastCard: card,
    phase: winner ? 'game_over' : isChoosingPlayer ? 'choosing_player' : 'ready',
    winnerId: winner?.id ?? null,
    pendingChoice: winner ? null : resolution.state.pendingChoice,
    currentPlayerIndex: shouldAdvanceTurn
      ? nextPlayerIndex(resolution.state.players, state.currentPlayerIndex, directionState.turnDirection)
      : state.currentPlayerIndex,
    message: `${currentPlayer.name}: ${card.title}. ${card.text}`
  };
}

export function resolvePendingPlayerChoice(state: GameState, targetPlayerId: string): GameState {
  const choice = state.pendingChoice;
  if (!choice || state.phase !== 'choosing_player' || targetPlayerId === choice.sourcePlayerId) return state;

  const sourcePlayer = state.players.find((player) => player.id === choice.sourcePlayerId);
  const targetPlayer = state.players.find((player) => player.id === targetPlayerId);
  if (!sourcePlayer || !targetPlayer) return state;

  const movedState = movePlayer(state, targetPlayerId, choice.targetAmount);
  const winner = findWinner(movedState.players);
  const directionState = winner
    ? {
        turnDirection: movedState.turnDirection,
        reverseTurnsRemaining: movedState.reverseTurnsRemaining
      }
    : reduceReverseTurnCounter(movedState);

  return {
    ...movedState,
    ...directionState,
    phase: winner ? 'game_over' : 'ready',
    winnerId: winner?.id ?? null,
    pendingChoice: null,
    currentPlayerIndex: winner
      ? state.currentPlayerIndex
      : nextPlayerIndex(movedState.players, state.currentPlayerIndex, directionState.turnDirection),
    message: winner
      ? `${winner.name} reached the finish.`
      : `${sourcePlayer.name} chose ${targetPlayer.name} to move forward ${choice.targetAmount} space${choice.targetAmount === 1 ? '' : 's'}.`
  };
}

function applyEffect(state: GameState, currentPlayer: Player, effect: ActionCardEffect, random: () => number): EffectResolution {
  let nextState = state;
  let keepTurn = false;
  let drawAgain = false;

  switch (effect.type) {
    case 'move':
      nextState = movePlayer(nextState, currentPlayer.id, effect.amount);
      break;
    case 'skip_turns':
      nextState = updatePlayer(nextState, currentPlayer.id, (player) => ({ ...player, skipTurns: player.skipTurns + effect.amount }));
      break;
    case 'go_to_space':
      nextState = setPlayerPosition(nextState, currentPlayer.id, effect.index);
      break;
    case 'swap_position':
      nextState = swapWithTarget(nextState, currentPlayer, effect.target, random);
      break;
    case 'roll_again':
      keepTurn = true;
      break;
    case 'move_to_color': {
      const target = effect.direction === 'next'
        ? findNextColorSpace(currentPlayer.positionIndex, effect.color)
        : findPreviousColorSpace(currentPlayer.positionIndex, effect.color);
      if (target !== null) nextState = setPlayerPosition(nextState, currentPlayer.id, target);
      break;
    }
    case 'move_all': {
      const targets = filterPlayersForGroupMove(nextState.players, currentPlayer, effect.filter);
      targets.forEach((player) => {
        nextState = movePlayer(nextState, player.id, effect.amount);
      });
      break;
    }
    case 'move_leader': {
      const leader = findLeader(nextState.players);
      if (leader) nextState = movePlayer(nextState, leader.id, effect.amount);
      break;
    }
    case 'reverse_turn_order': {
      const nextDirection: TurnDirection = nextState.turnDirection === 1 ? -1 : 1;
      const rounds = Math.max(0, Math.trunc(effect.turns));
      nextState = {
        ...nextState,
        turnDirection: nextDirection,
        reverseTurnsRemaining: rounds * nextState.players.length
      };
      break;
    }
    case 'protect_from_backward':
      nextState = updatePlayer(nextState, currentPlayer.id, (player) => ({
        ...player,
        protectedFromBackward: player.protectedFromBackward + effect.uses
      }));
      break;
    case 'draw_again':
      drawAgain = true;
      break;
    case 'move_and_roll_again':
      nextState = movePlayer(nextState, currentPlayer.id, effect.amount);
      keepTurn = true;
      break;
    case 'move_and_draw_again':
      nextState = movePlayer(nextState, currentPlayer.id, effect.amount);
      drawAgain = true;
      break;
    case 'skip_others':
      nextState = {
        ...nextState,
        players: nextState.players.map((player) =>
          player.id === currentPlayer.id ? player : { ...player, skipTurns: player.skipTurns + effect.amount }
        )
      };
      break;
    case 'choose_player_move':
      nextState = movePlayer(nextState, currentPlayer.id, effect.currentAmount);
      nextState = {
        ...nextState,
        pendingChoice: {
          sourcePlayerId: currentPlayer.id,
          targetAmount: effect.targetAmount
        }
      };
      break;
  }

  return { state: nextState, keepTurn, drawAgain };
}

function movePlayer(state: GameState, playerId: string, amount: number): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId) return player;
      if (amount < 0 && player.protectedFromBackward > 0) {
        return { ...player, protectedFromBackward: player.protectedFromBackward - 1 };
      }
      const move = calculateMove(player.positionIndex, amount, finishIndex);
      return { ...player, positionIndex: move.toIndex };
    })
  };
}

function setPlayerPosition(state: GameState, playerId: string, index: number): GameState {
  const targetIndex = Math.max(0, Math.min(index, finishIndex));
  return updatePlayer(state, playerId, (player) => ({ ...player, positionIndex: targetIndex }));
}

function updatePlayer(state: GameState, playerId: string, updater: (player: Player) => Player): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player))
  };
}

function swapWithTarget(state: GameState, currentPlayer: Player, target: 'leader' | 'random' | 'behind' | 'last_place', random: () => number): GameState {
  let targetPlayer: Player | null = null;

  if (target === 'leader') targetPlayer = findLeader(state.players);
  if (target === 'last_place') targetPlayer = findLastPlace(state.players);
  if (target === 'behind') targetPlayer = findPlayerBehind(state.players, currentPlayer);
  if (target === 'random') targetPlayer = pickRandomOtherPlayer(state.players, currentPlayer.id, random);

  if (!targetPlayer || targetPlayer.id === currentPlayer.id) return state;
  const swapTarget = targetPlayer;

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === currentPlayer.id) return { ...player, positionIndex: swapTarget.positionIndex };
      if (player.id === swapTarget.id) return { ...player, positionIndex: currentPlayer.positionIndex };
      return player;
    })
  };
}

function pickRandomOtherPlayer(players: Player[], currentPlayerId: string, random: () => number): Player | null {
  const candidates = players.filter((player) => player.id !== currentPlayerId);
  if (candidates.length === 0) return null;
  const randomValue = Math.max(0, Math.min(0.999999, random()));
  return candidates[Math.floor(randomValue * candidates.length)] ?? candidates[0];
}

function findWinner(players: Player[]): Player | null {
  return players.find((player) => player.positionIndex >= finishIndex) ?? null;
}
