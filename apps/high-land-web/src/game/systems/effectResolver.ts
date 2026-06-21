import { finishIndex } from '../data/boardPath';
import type { ActionCard, ActionCardEffect, GameState, Player, TurnDirection } from '../types/gameTypes';
import { calculateMove } from './movementSystem';
import { nextPlayerIndex } from './turnSystem';
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

export function resolveActionCard(state: GameState, card: ActionCard): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  const resolution = applyEffect(state, currentPlayer, card.effect);
  const winner = findWinner(resolution.state.players);
  const isChoosingPlayer = Boolean(resolution.state.pendingChoice) && !winner;

  return {
    ...resolution.state,
    lastCard: card,
    phase: winner ? 'game_over' : isChoosingPlayer ? 'choosing_player' : 'ready',
    winnerId: winner?.id ?? null,
    pendingChoice: winner ? null : resolution.state.pendingChoice,
    currentPlayerIndex: winner || isChoosingPlayer || resolution.keepTurn || resolution.drawAgain
      ? state.currentPlayerIndex
      : nextPlayerIndex(resolution.state.players, state.currentPlayerIndex, resolution.state.turnDirection),
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

  return {
    ...movedState,
    phase: winner ? 'game_over' : 'ready',
    winnerId: winner?.id ?? null,
    pendingChoice: null,
    currentPlayerIndex: winner
      ? state.currentPlayerIndex
      : nextPlayerIndex(movedState.players, state.currentPlayerIndex, movedState.turnDirection),
    message: winner
      ? `${winner.name} reached Cloud 9 Citadel.`
      : `${sourcePlayer.name} boosted ${targetPlayer.name} forward ${choice.targetAmount}.`
  };
}

function applyEffect(state: GameState, currentPlayer: Player, effect: ActionCardEffect): EffectResolution {
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
      nextState = swapWithTarget(nextState, currentPlayer, effect.target);
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
      const reverseTurns = effect.turns === 'round' ? nextState.players.length : effect.turns;
      nextState = { ...nextState, turnDirection: nextDirection, reverseTurnsRemaining: reverseTurns };
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
          player.id === currentPlayer.id
            ? player
            : { ...player, skipTurns: player.skipTurns + effect.amount }
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

function swapWithTarget(state: GameState, currentPlayer: Player, target: 'leader' | 'random' | 'behind' | 'last_place'): GameState {
  let targetPlayer: Player | null = null;

  if (target === 'leader') targetPlayer = findLeader(state.players);
  if (target === 'last_place') targetPlayer = findLastPlace(state.players);
  if (target === 'behind') targetPlayer = findPlayerBehind(state.players, currentPlayer);
  if (target === 'random') targetPlayer = state.players.find((player) => player.id !== currentPlayer.id) ?? null;

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

function findWinner(players: Player[]): Player | null {
  return players.find((player) => player.positionIndex >= finishIndex) ?? null;
}
