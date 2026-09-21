import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { finishIndex } from './boardPath';
import { starterActionCards } from './actionCards';
import { createNamedLocalGame } from '../multiplayer/roomGameFactory';
import { applyActionCard } from '../systems/cardSystem';
import { resolvePendingPlayerChoice } from '../systems/effectResolver';
import { rollCurrentTurn } from '../systems/gameEngine';
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
  'card-032-rolling-breeze.svg',
  'card-033-dankwood-fog.svg',
  'card-034-golden-track.svg',
  'card-035-sugar-crash.svg',
  'card-036-crystal-tunnel.svg',
  'card-037-trichome-slide.svg',
  'card-038-cloud-lift.svg',
  'card-039-second-hit.svg'
];

const expectedApprovedText = [
  'Move forward 3 spaces.',
  'Lose your next turn.',
  'Move forward 3 spaces and draw again.',
  'Move back to the last green space.',
  'Move forward 2 spaces.',
  'Move back 5 spaces.',
  'Move to the next purple space.',
  'Move forward 5 spaces.',
  'Move forward 2 spaces.',
  'Move forward to the next yellow space.',
  'Move forward 5 spaces.',
  'Move forward to the next green space.',
  'Move back 2 spaces.',
  'Move back 4 spaces.',
  'Move back to the last yellow space.',
  'Stay here until your next turn.',
  'Switch places with the player behind you.',
  'Everyone moves forward 1 space.',
  'Everyone skips their next move except you.',
  'Move forward 2 spaces, then choose one player to move forward 1.',
  'Every player ahead of you moves back 1 space.',
  'The player in first place moves back 3 spaces.',
  'Turn order reverses for one round.',
  'Choose one player. You both move forward 2 spaces.',
  'Move forward 4 spaces.',
  'Move back 3 spaces.',
  'Keep this card. Ignore the next card that makes you move backward.',
  'Roll again and move that many extra spaces.',
  'Move forward 6 spaces.',
  'Move forward 3 spaces, then stop.',
  'Move back 3 spaces and draw again.',
  'Move forward 1 space.',
  'Lose your next turn.',
  'Move forward 4 spaces.',
  'Move back 2 spaces.',
  'Move forward 3 spaces.',
  'Move back 5 spaces.',
  'Move forward 4 spaces.',
  'Draw another Hit Card.'
] as const;

function cardById(id: string): ActionCard {
  const card = starterActionCards.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`Missing approved HIT card ${id}`);
  return card;
}

const temporarySvgMasterIds = [
  'card-032',
  'card-033',
  'card-034',
  'card-035',
  'card-036',
  'card-037',
  'card-038',
  'card-039'
];

function appRoot(): string {
  return process.cwd().endsWith('apps/high-land-web')
    ? process.cwd()
    : join(process.cwd(), 'apps/high-land-web');
}

function publicAssetPath(imageSrc: string): string {
  return imageSrc.replace(/^assets\//, 'public/assets/');
}

describe('High Land HIT card deck', () => {
  it('uses the locked 39-card deck with card-specific artwork paths', () => {
    expect(starterActionCards).toHaveLength(39);
    expect(starterActionCards.map((card) => card.imageSrc)).toEqual(
      expectedApprovedFiles.map((file) => `assets/images/cards/hit/master/${file}`)
    );
  });

  it('locks the approved visible instructions in card order', () => {
    expect(starterActionCards.map((card) => card.text)).toEqual(expectedApprovedText);
  });

  it('resolves approved swap, group, leader, choice, skip, roll-again, and draw-again cards as written', () => {
    const base = createNamedLocalGame(4, 'Tester');
    const positioned = {
      ...base,
      players: base.players.map((player, index) => ({
        ...player,
        positionIndex: [20, 15, 25, 5][index] ?? 0
      }))
    };

    const swapped = applyActionCard(positioned, cardById('card-017'), 0, () => 0);
    expect(swapped.players.map((player) => player.positionIndex)).toEqual([15, 20, 25, 5]);

    const everyoneMoved = applyActionCard(positioned, cardById('card-018'), 0, () => 0);
    expect(everyoneMoved.players.map((player) => player.positionIndex)).toEqual([21, 16, 26, 6]);

    const aheadMovedBack = applyActionCard(positioned, cardById('card-021'), 0, () => 0);
    expect(aheadMovedBack.players.map((player) => player.positionIndex)).toEqual([20, 15, 24, 5]);

    const leaderMovedBack = applyActionCard(positioned, cardById('card-022'), 0, () => 0);
    expect(leaderMovedBack.players.map((player) => player.positionIndex)).toEqual([20, 15, 22, 5]);

    const choosing = applyActionCard(positioned, cardById('card-024'), 0, () => 0);
    expect(choosing.phase).toBe('choosing_player');
    expect(choosing.players[0].positionIndex).toBe(22);
    expect(choosing.pendingChoice).toEqual({
      sourcePlayerId: positioned.players[0].id,
      targetAmount: 2
    });
    const choiceResolved = resolvePendingPlayerChoice(choosing, positioned.players[1].id);
    expect(choiceResolved.phase).toBe('ready');
    expect(choiceResolved.players[1].positionIndex).toBe(17);
    expect(choiceResolved.currentPlayerIndex).toBe(1);

    const skipped = applyActionCard(positioned, cardById('card-002'), 0, () => 0);
    expect(skipped.players[0].skipTurns).toBe(1);
    const skippedTurn = rollCurrentTurn({ ...skipped, currentPlayerIndex: 0 }, () => 0);
    expect(skippedTurn.players[0].skipTurns).toBe(0);
    expect(skippedTurn.currentPlayerIndex).toBe(1);

    const rollAgain = applyActionCard(positioned, cardById('card-028'), 0, () => 0);
    expect(rollAgain.phase).toBe('ready');
    expect(rollAgain.currentPlayerIndex).toBe(0);

    const drawAgain = applyActionCard(positioned, cardById('card-039'), 0, () => 0);
    expect(drawAgain.lastCard?.id).toBe('card-001');
    expect(drawAgain.players[0].positionIndex).toBe(23);
    expect(drawAgain.currentPlayerIndex).toBe(1);

    const moveAndDrawAgain = applyActionCard(positioned, cardById('card-003'), 0, () => 0);
    expect(moveAndDrawAgain.lastCard?.id).toBe('card-001');
    expect(moveAndDrawAgain.players[0].positionIndex).toBe(26);
    expect(moveAndDrawAgain.currentPlayerIndex).toBe(1);
  });

  it('points every HIT card at a committed master asset', () => {
    starterActionCards.forEach((card) => {
      expect(card.imageSrc).toBeTruthy();
      expect(existsSync(join(appRoot(), publicAssetPath(card.imageSrc ?? '')))).toBe(true);
    });
  });

  it('makes the remaining temporary SVG master cards explicit', () => {
    const temporaryIds = starterActionCards
      .filter((card) => card.imageSrc?.endsWith('.svg'))
      .map((card) => card.id);

    expect(temporaryIds).toEqual(temporarySvgMasterIds);
  });

  it('has unique cards with complete visible content and artwork paths', () => {
    const ids = new Set<string>();
    const titles = new Set<string>();

    starterActionCards.forEach((card, index) => {
      expect(card.id).toBe(`card-${String(index + 1).padStart(3, '0')}`);
      expect(card.title.trim().length).toBeGreaterThan(2);
      expect(card.text.trim().length).toBeGreaterThan(6);
      expect(card.imageSrc).toMatch(/^assets\/images\/cards\/hit\/master\/card-\d{3}-[a-z0-9-]+\.(png|svg)$/);
      expect(card.fallbackImageSrc).toBe('assets/images/cards/hit/fallback-hit-card.svg');
      expect(card.imageAlt).toContain(card.title);
      expect(ids.has(card.id)).toBe(false);
      expect(titles.has(card.title)).toBe(false);
      ids.add(card.id);
      titles.add(card.title);
    });
  });

  it('never relies on the generic fallback as the only artwork source', () => {
    starterActionCards.forEach((card) => {
      const hasApprovedSheet = Boolean(card.sheetArt?.src?.startsWith('assets/images/cards/hit-card-sheet-'));
      const hasCardSpecificAsset = Boolean(card.imageSrc?.startsWith('assets/images/cards/hit/master/card-'));
      expect(hasApprovedSheet || hasCardSpecificAsset).toBe(true);
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
      const baseGame = createNamedLocalGame(4, 'Tester');
      const state = {
        ...baseGame,
        lastCard: card,
        phase: 'resolving_card' as const,
        players: baseGame.players.map((player, index) => ({
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
