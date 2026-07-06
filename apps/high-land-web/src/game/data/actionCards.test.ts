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
  'move_and_roll_again',
  'move_and_draw_again',
  'skip_others',
  'choose_player_move'
]);

const expectedApprovedFiles = [
  'card-001-perfect-roll.png',
  'card-002-cough-lock.png',
  'card-003-rosin-rush.png',
  'card-004-lost-in-dankwood.png',
  'card-005-munchie-motivation.png',
  'card-006-kief-avalanche.png',
  'card-007-trichome-boost.png',
  'card-008-cloud-9-drift.png',
  'card-009-smooth-cruise.png',
  'card-010-lucky-lighter.png',
  'card-011-rolling-hills-shortcut.png',
  'card-012-dankwood-trail.png',
  'card-013-dropped-the-lighter.png',
  'card-014-burnt-snack-run.png',
  'card-015-sticky-fingers.png',
  'card-016-couch-locked.png',
  'card-017-pass-the-pack.png',
  'card-018-rotation-rule.png',
  'card-019-hot-box.png',
  'card-020-puff-puff-pass.png',
  'card-021-snack-tax.png',
  'card-022-bogart-alert.png',
  'card-023-reverse-rotation.png',
  'card-024-friend-boost.png',
  'card-025-good-vibes-only.png',
  'card-026-rosin-spill.png',
  'card-027-free-pass.png',
  'card-028-high-roller.png',
  'card-029-rosin-rail-ride.png',
  'card-030-munchie-mountain.png',
  'card-031-kief-cave-slip.png',
  'card-032-rolling-breeze.png',
  'card-033-dankwood-fog.png',
  'card-034-golden-track.png',
  'card-035-sugar-crash.png',
  'card-036-crystal-tunnel.png',
  'card-037-trichome-slide.png',
  'card-038-cloud-lift.png',
  'card-039-second-hit.png'
];

describe('High Land HIT card deck', () => {
  it('uses the locked 39-card approved master deck', () => {
    expect(starterActionCards).toHaveLength(39);
    expect(starterActionCards.map((card) => card.imageSrc)).toEqual(
      expectedApprovedFiles.map((file) => `assets/images/cards/hit/master/${file}`)
    );
  });

  it('has unique cards with complete visible content and artwork paths', () => {
    const ids = new Set<string>();
    const titles = new Set<string>();

    starterActionCards.forEach((card, index) => {
      expect(card.id).toBe(`card-${String(index + 1).padStart(3, '0')}`);
      expect(card.title.trim().length).toBeGreaterThan(2);
      expect(card.text.trim().length).toBeGreaterThan(6);
      expect(card.imageSrc).toMatch(/^assets\/images\/cards\/hit\/master\/card-\d{3}-[a-z0-9-]+\.png$/);
      expect(card.fallbackImageSrc).toBe('assets/images/cards/hit/fallback-hit-card.svg');
      expect(card.imageAlt).toContain(card.title);
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

      if (card.effect.type === 'skip_turns' || card.effect.type === 'skip_others') {
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
