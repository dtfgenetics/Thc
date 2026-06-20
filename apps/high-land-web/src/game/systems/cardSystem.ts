import { finishIndex } from '../data/boardPath';
import { starterActionCards } from '../data/actionCards';
import type { ActionCard, GameState, Player } from '../types/gameTypes';
import { calculateMove } from './movementSystem';
import { nextPlayerIndex } from './turnSystem';

export function drawActionCard(cardCursor: number, deck: ActionCard[] = starterActionCards): { card: ActionCard; nextCursor: number } {
  if (deck.length === 0) throw new Error('Action card deck is empty.');
  const card = deck[cardCursor % deck.length];
  return { card, nextCursor: cardCursor + 1 };
}

function leader(players: Player[]): Player {
  return [...players].sort((a, b) => b.positionIndex - a.positionIndex)[0];
}

export function applyActionCard(state: GameState, card: ActionCard): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  let players = [...state.players];
  let message = `${currentPlayer.name}: ${card.title}. ${card.text}`;
  let keepTurn = false;

  if (card.effect.type === 'move') {
    const move = calculateMove(currentPlayer.positionIndex, card.effect.amount, finishIndex);
    players = players.map((player) =>
      player.id === currentPlayer.id ? { ...player, positionIndex: move.toIndex } : player
    );
  }

  if (card.effect.type === 'skip_turns') {
    players = players.map((player) =>
      player.id === currentPlayer.id ? { ...player, skipTurns: player.skipTurns + card.effect.amount } : player
    );
  }

  if (card.effect.type === 'go_to_space') {
    const targetIndex = Math.max(0, Math.min(card.effect.index, finishIndex));
    players = players.map((player) =>
      player.id === currentPlayer.id ? { ...player, positionIndex: targetIndex } : player
    );
  }

  if (card.effect.type === 'swap_position') {
    const target = card.effect.target === 'leader' ? leader(players) : players.find((player) => player.id !== currentPlayer.id);
    if (target && target.id !== currentPlayer.id) {
      players = players.map((player) => {
        if (player.id === currentPlayer.id) return { ...player, positionIndex: target.positionIndex };
        if (player.id === target.id) return { ...player, positionIndex: currentPlayer.positionIndex };
        return player;
      });
    }
  }

  if (card.effect.type === 'roll_again') {
    keepTurn = true;
    message = `${currentPlayer.name}: ${card.title}. Roll again.`;
  }

  const updatedCurrentPlayer = players.find((player) => player.id === currentPlayer.id);
  const winnerId = updatedCurrentPlayer && updatedCurrentPlayer.positionIndex >= finishIndex ? updatedCurrentPlayer.id : state.winnerId;

  return {
    ...state,
    players,
    lastCard: card,
    phase: winnerId ? 'game_over' : 'ready',
    winnerId: winnerId ?? null,
    currentPlayerIndex: winnerId || keepTurn ? state.currentPlayerIndex : nextPlayerIndex(players, state.currentPlayerIndex),
    message
  };
}
