import { describe, expect, it } from 'vitest';
import { finishIndex } from './boardPath';
import { starterActionCards } from './actionCards';
import { createNamedLocalGame } from '../multiplayer/roomGameFactory';
import { applyActionCard } from '../systems/cardSystem';
import type { ActionCard } from '../types/gameTypes';

const supportedEffectTypes = new Set<ActionCard['effect']['type']>([
  'move',
  'skip_turns',
  'go_to_space',
  'swap_position',
  'roll_again',
  'move_to_color',
  'move_all',
  'move_leader',
  'reverse_turn_order',
  'protect_from_backward',
  'draw_again',
  'move_and_roll_again'
]);

describe('High Land HIT card deck', () => {
  it('has unique cards with complete visible content', () => {
    expect(starterActionCards.length).toBeGreaterThanOrEqual(30);

    const ids = new Set<string>();
    const titles = new Set<string>();

    starterActionCards.forEach((card) => {
      expect(card.id).toMatch(/^card-\d{3}$/);
      expect(card.title.trim().length).toBeGreaterThan(2);
      expect(card.text.trim().length).toBeGreaterThan(6);
      expect(ids.has(card.id)).toBe(false);
      expect(titles.has(card.title)).toBe(false);
      ids.add(card.id);
      titles.add(card.title);
    });
  });

  it('uses only implemented effect types and valid effect values', () => {
    starterActionCards.forEach((card) => {
      expect(supportedEffectTypes.has(card.effect.type)).toBe(true);

      if (card.effect.type === 'go_to_space') {
        expect(card.effect.index).toBeGreaterThanOrEqual(0);
        expect(card.effect.index).toBeLessThanOrEqual(finishIndex);
      }

      if (card.effect.type === 'skip_turns') {
        expect(card.effect.amount).toBeGreaterThan(0);
      }

      if (card.effect.type === 'reverse_turn_order') {
        expect(card.effect.turns).toBeGreaterThan(0);
      }

      if (card.effect.type === 'protect_from_backward') {
        expect(card.effect.uses).toBeGreaterThan(0);
      }
    });
  });

  it('can resolve every HIT card without corrupting player positions', () => {
    starterActionCards.forEach((card) => {
      const state = {
        ...createNamedLocalGame(4, 'Tester'),
        lastCard: card,
        phase: 'resolving_card' as const,
        players: createNamedLocalGame(4, 'Tester').players.map((player, index) => ({
          ...player,
          positionIndex: index * 3 + 10
        }))
      };

      const resolved = applyActionCard(state, card, 0, () => 0.25);

      expect(resolved.players).toHaveLength(4);
      resolved.players.forEach((player) => {
        expect(player.positionIndex).toBeGreaterThanOrEqual(0);
        expect(player.positionIndex).toBeLessThanOrEqual(finishIndex);
        expect(Number.isFinite(player.positionIndex)).toBe(true);
      });
      expect(resolved.lastCard).toBeTruthy();
      expect(resolved.message.length).toBeGreaterThan(0);
    });
  });
});
