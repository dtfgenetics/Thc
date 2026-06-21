import { starterActionCards } from '../data/actionCards';
import { finishIndex } from '../data/boardPath';
import type { ActionCard, GameState, Player } from '../types/gameTypes';
import { resolveActionCard } from './effectResolver';

export function drawActionCard(cardCursor: number, deck: ActionCard[] = starterActionCards): { card: ActionCard; nextCursor: number } {
  if (deck.length === 0) throw new Error('Action card deck is empty.');
  const card = deck[cardCursor % deck.length];
  return { card, nextCursor: cardCursor + 1 };
}

export function applyActionCard(state: GameState, card: ActionCard, chainDepth = 0): GameState {
  const resolved = sweepForWinner(resolveActionCard(state, card));

  const drawsAgain = card.effect.type === 'draw_again' || card.effect.type === 'move_and_draw_again';

  if (drawsAgain && !resolved.winnerId && chainDepth < 2) {
    const draw = drawActionCard(resolved.cardCursor);
    return applyActionCard(
      {
        ...resolved,
        cardCursor: draw.nextCursor,
        lastCard: draw.card,
        phase: 'resolving_card'
      },
      draw.card,
      chainDepth + 1
    );
  }

  return resolved;
}

function sweepForWinner(state: GameState): GameState {
  const winner = findWinner(state.players);
  if (!winner) return state;

  return {
    ...state,
    phase: 'game_over',
    winnerId: winner.id,
    message: `${winner.name} reached the finish.`
  };
}

function findWinner(players: Player[]): Player | null {
  return players.find((player) => player.positionIndex >= finishIndex) ?? null;
}
