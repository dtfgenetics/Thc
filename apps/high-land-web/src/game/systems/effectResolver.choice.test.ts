import { describe, expect, it } from 'vitest';
import { createInitialGame, rollCurrentTurn } from './gameEngine';
import { resolveActionCard, resolvePendingPlayerChoice } from './effectResolver';
import type { ActionCard } from '../types/gameTypes';

const friendBoost: ActionCard = {
  id: 'choice-test',
  title: 'Friend Boost',
  text: 'Choose one player. You both move forward 2 spaces.',
  effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 2 }
};

describe('explicit HIT card player choice', () => {
  it('pauses the turn until the active player chooses a target', () => {
    const initial = createInitialGame(3);
    const choosing = resolveActionCard(initial, friendBoost);

    expect(choosing.phase).toBe('choosing_player');
    expect(choosing.pendingChoice).toEqual({
      sourcePlayerId: initial.players[0].id,
      targetAmount: 2
    });
    expect(choosing.players[0].positionIndex).toBe(2);
    expect(choosing.currentPlayerIndex).toBe(0);
  });

  it('moves the selected player and advances the turn only after selection', () => {
    const initial = createInitialGame(3);
    const choosing = resolveActionCard(initial, friendBoost);
    const targetId = choosing.players[2].id;
    const resolved = resolvePendingPlayerChoice(choosing, targetId);

    expect(resolved.pendingChoice).toBeNull();
    expect(resolved.phase).toBe('ready');
    expect(resolved.players[2].positionIndex).toBe(2);
    expect(resolved.currentPlayerIndex).toBe(1);
    expect(resolved.message).toContain(choosing.players[2].name);
  });

  it('rejects choosing the source player and blocks extra rolls while choice is pending', () => {
    const initial = createInitialGame(3);
    const choosing = resolveActionCard(initial, friendBoost);

    expect(resolvePendingPlayerChoice(choosing, choosing.players[0].id)).toBe(choosing);
    expect(rollCurrentTurn(choosing, () => 0)).toBe(choosing);
  });
});
