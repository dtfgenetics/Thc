import type { ActionCard, ActionCardEffect } from './roomTypes.js';

const MASTER_PATH = 'assets/images/cards/hit/master';
const FALLBACK_PATH = 'assets/images/cards/hit/fallback-hit-card.svg';

type CardDefinition = {
  id: string;
  fileName: string;
  title: string;
  text: string;
  effect: ActionCardEffect;
};

function card(definition: CardDefinition): ActionCard {
  return {
    id: definition.id,
    title: definition.title,
    text: definition.text,
    effect: definition.effect,
    imageSrc: `${MASTER_PATH}/${definition.fileName}`,
    fallbackImageSrc: FALLBACK_PATH,
    imageAlt: `${definition.title} HIT card artwork`
  };
}

export const HIGH_LAND_HIT_CARDS: readonly ActionCard[] = [
  card({ id: 'card-001', fileName: 'card-001-perfect-roll.png', title: 'Perfect Roll', text: 'Move forward 3 spaces.', effect: { type: 'move', amount: 3 } }),
  card({ id: 'card-002', fileName: 'card-002-cough-lock.png', title: 'Cough Lock', text: 'Lose your next turn.', effect: { type: 'skip_turns', amount: 1 } }),
  card({ id: 'card-003', fileName: 'card-003-rosin-rush.png', title: 'Rosin Rush', text: 'Move forward 3 spaces and draw again.', effect: { type: 'move_and_draw_again', amount: 3 } }),
  card({ id: 'card-004', fileName: 'card-004-lost-in-dankwood.png', title: 'Lost in Dankwood', text: 'Move back to the last green space.', effect: { type: 'move_to_color', color: 'green', direction: 'previous' } }),
  card({ id: 'card-005', fileName: 'card-005-munchie-motivation.png', title: 'Munchie Motivation', text: 'Move forward 2 spaces.', effect: { type: 'move', amount: 2 } }),
  card({ id: 'card-006', fileName: 'card-006-kief-avalanche.png', title: 'Kief Avalanche', text: 'Move back 5 spaces.', effect: { type: 'move', amount: -5 } }),
  card({ id: 'card-007', fileName: 'card-007-trichome-boost.png', title: 'Trichome Boost', text: 'Move to the next purple space.', effect: { type: 'move_to_color', color: 'purple', direction: 'next' } }),
  card({ id: 'card-008', fileName: 'card-008-cloud-9-drift.png', title: 'Cloud 9 Drift', text: 'Move forward 5 spaces.', effect: { type: 'move', amount: 5 } }),
  card({ id: 'card-009', fileName: 'card-009-smooth-cruise.png', title: 'Smooth Cruise', text: 'Move forward 2 spaces.', effect: { type: 'move', amount: 2 } }),
  card({ id: 'card-010', fileName: 'card-010-lucky-lighter.png', title: 'Lucky Lighter', text: 'Move forward to the next yellow space.', effect: { type: 'move_to_color', color: 'yellow', direction: 'next' } }),
  card({ id: 'card-011', fileName: 'card-011-rolling-hills-shortcut.png', title: 'Rolling Hills Shortcut', text: 'Move forward 5 spaces.', effect: { type: 'move', amount: 5 } }),
  card({ id: 'card-012', fileName: 'card-012-dankwood-trail.png', title: 'Dankwood Trail', text: 'Move forward to the next green space.', effect: { type: 'move_to_color', color: 'green', direction: 'next' } }),
  card({ id: 'card-013', fileName: 'card-013-dropped-the-lighter.png', title: 'Dropped The Lighter', text: 'Move back 2 spaces.', effect: { type: 'move', amount: -2 } }),
  card({ id: 'card-014', fileName: 'card-014-burnt-snack-run.png', title: 'Burnt Snack Run', text: 'Move back 4 spaces.', effect: { type: 'move', amount: -4 } }),
  card({ id: 'card-015', fileName: 'card-015-sticky-fingers.png', title: 'Sticky Fingers', text: 'Move back to the last yellow space.', effect: { type: 'move_to_color', color: 'yellow', direction: 'previous' } }),
  card({ id: 'card-016', fileName: 'card-016-couch-locked.png', title: 'Couch Locked', text: 'Stay here until your next turn.', effect: { type: 'skip_turns', amount: 1 } }),
  card({ id: 'card-017', fileName: 'card-017-pass-the-pack.png', title: 'Pass The Pack', text: 'Switch places with the player behind you.', effect: { type: 'swap_position', target: 'behind' } }),
  card({ id: 'card-018', fileName: 'card-018-rotation-rule.png', title: 'Rotation Rule', text: 'Everyone moves forward 1 space.', effect: { type: 'move_all', amount: 1, filter: 'everyone' } }),
  card({ id: 'card-019', fileName: 'card-019-hot-box.png', title: 'Hot Box', text: 'Everyone skips their next move except you.', effect: { type: 'skip_others', amount: 1 } }),
  card({ id: 'card-020', fileName: 'card-020-puff-puff-pass.png', title: 'Puff Puff Pass', text: 'Move forward 2 spaces, then choose one player to move forward 1.', effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 1 } }),
  card({ id: 'card-021', fileName: 'card-021-snack-tax.png', title: 'Snack Tax', text: 'Every player ahead of you moves back 1 space.', effect: { type: 'move_all', amount: -1, filter: 'ahead' } }),
  card({ id: 'card-022', fileName: 'card-022-bogart-alert.png', title: 'Bogart Alert', text: 'The player in first place moves back 3 spaces.', effect: { type: 'move_leader', amount: -3 } }),
  card({ id: 'card-023', fileName: 'card-023-reverse-rotation.png', title: 'Reverse Rotation', text: 'Turn order reverses for one round.', effect: { type: 'reverse_turn_order', turns: 1 } }),
  card({ id: 'card-024', fileName: 'card-024-friend-boost.png', title: 'Friend Boost', text: 'Choose one player. You both move forward 2 spaces.', effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 2 } }),
  card({ id: 'card-025', fileName: 'card-025-good-vibes-only.png', title: 'Good Vibes Only', text: 'Move forward 4 spaces.', effect: { type: 'move', amount: 4 } }),
  card({ id: 'card-026', fileName: 'card-026-rosin-spill.png', title: 'Rosin Spill', text: 'Move back 3 spaces.', effect: { type: 'move', amount: -3 } }),
  card({ id: 'card-027', fileName: 'card-027-free-pass.png', title: 'Free Pass', text: 'Keep this card. Ignore the next card that makes you move backward.', effect: { type: 'protect_from_backward', uses: 1 } }),
  card({ id: 'card-028', fileName: 'card-028-high-roller.png', title: 'High Roller', text: 'Roll again and move that many extra spaces.', effect: { type: 'roll_again' } }),
  card({ id: 'card-029', fileName: 'card-029-rosin-rail-ride.png', title: 'Rosin Rail Ride', text: 'Move forward 6 spaces.', effect: { type: 'move', amount: 6 } }),
  card({ id: 'card-030', fileName: 'card-030-munchie-mountain.png', title: 'Munchie Mountain', text: 'Move forward 3 spaces, then stop.', effect: { type: 'move', amount: 3 } }),
  card({ id: 'card-031', fileName: 'card-031-kief-cave-slip.png', title: 'Kief Cave Slip', text: 'Move back 3 spaces and draw again.', effect: { type: 'move_and_draw_again', amount: -3 } }),
  card({ id: 'card-032', fileName: 'card-032-rolling-breeze.svg', title: 'Rolling Breeze', text: 'Move forward 1 space.', effect: { type: 'move', amount: 1 } }),
  card({ id: 'card-033', fileName: 'card-033-dankwood-fog.svg', title: 'Dankwood Fog', text: 'Lose your next turn.', effect: { type: 'skip_turns', amount: 1 } }),
  card({ id: 'card-034', fileName: 'card-034-golden-track.svg', title: 'Golden Track', text: 'Move forward 4 spaces.', effect: { type: 'move', amount: 4 } }),
  card({ id: 'card-035', fileName: 'card-035-sugar-crash.svg', title: 'Sugar Crash', text: 'Move back 2 spaces.', effect: { type: 'move', amount: -2 } }),
  card({ id: 'card-036', fileName: 'card-036-crystal-tunnel.svg', title: 'Crystal Tunnel', text: 'Move forward 3 spaces.', effect: { type: 'move', amount: 3 } }),
  card({ id: 'card-037', fileName: 'card-037-trichome-slide.svg', title: 'Trichome Slide', text: 'Move back 5 spaces.', effect: { type: 'move', amount: -5 } }),
  card({ id: 'card-038', fileName: 'card-038-cloud-lift.svg', title: 'Cloud Lift', text: 'Move forward 4 spaces.', effect: { type: 'move', amount: 4 } }),
  card({ id: 'card-039', fileName: 'card-039-second-hit.svg', title: 'Second Hit', text: 'Draw another Hit Card.', effect: { type: 'draw_again' } })
];

export function drawHighLandCard(random: () => number): ActionCard {
  const value = Math.max(0, Math.min(0.999999999999, random()));
  return HIGH_LAND_HIT_CARDS[Math.floor(value * HIGH_LAND_HIT_CARDS.length)] ?? HIGH_LAND_HIT_CARDS[0];
}
