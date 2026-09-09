import { describe, expect, it } from 'vitest';
import { createInitialGame } from './gameEngine';
import { applyActionCard } from './cardSystem';
import { resolvePendingPlayerChoice } from './effectResolver';
import type { ActionCard } from '../types/gameTypes';

const reverseCard: ActionCard = {
  id: 'test-reverse',
  title: 'Reverse Rotation',
  text: 'Turn order reverses for one round.',
  effect: { type: 'reverse_turn_order', turns: 1 }
};

const forwardCard: ActionCard = {
  id: 'test-forward',
  title: 'Forward',
  text: 'Move forward.',
  effect: { type: 'move', amount: 1 }
};

const choiceCard: ActionCard = {
  id: 'test-choice',
  title: 'Friend Boost',
  text: 'Choose one player. You both move forward 2 spaces.',
  effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 1 }
};

describe('reverse rotation across HIT card turns', () => {
  it('consumes one reversed turn when a normal HIT card advances play', () => {
    const reversed = applyActionCard(createInitialGame(4), reverseCard);
    const afterHitCard = applyActionCard(reversed, forwardCard);

    expect(afterHitCard.turnDirection).toBe(-1);
    expect(afterHitCard.reverseTurnsRemaining).toBe(3);
    expect(afterHitCard.currentPlayerIndex).toBe(2);
  });

  it('consumes one reversed turn after a pending player choice resolves', () => {
    const reversed = applyActionCard(createInitialGame(4), reverseCard);
    const choosing = applyActionCard(reversed, choiceCard);
    const resolved = resolvePendingPlayerChoice(choosing, choosing.players[1].id);

    expect(resolved.pendingChoice).toBeNull();
    expect(resolved.phase).toBe('ready');
    expect(resolved.turnDirection).toBe(-1);
    expect(resolved.reverseTurnsRemaining).toBe(3);
    expect(resolved.currentPlayerIndex).toBe(2);
  });

  it('restores clockwise play when the final reversed card turn is consumed', () => {
    const almostDone = {
      ...createInitialGame(4),
      currentPlayerIndex: 3,
      turnDirection: -1 as const,
      reverseTurnsRemaining: 1
    };

    const resolved = applyActionCard(almostDone, forwardCard);

    expect(resolved.turnDirection).toBe(1);
    expect(resolved.reverseTurnsRemaining).toBe(0);
    expect(resolved.currentPlayerIndex).toBe(0);
  });
});
