import type { ActionCard } from '../types/gameTypes';

function withHitImage(card: Omit<ActionCard, 'imageSrc' | 'fallbackImageSrc' | 'imageAlt'>): ActionCard {
  return {
    ...card,
    imageSrc: `assets/images/cards/hit/${card.id}.png`,
    fallbackImageSrc: 'assets/images/cards/hit/fallback-hit-card.svg',
    imageAlt: `${card.title} HIT card artwork`
  };
}

export const starterActionCards: ActionCard[] = [
  withHitImage({ id: 'card-001', title: 'Cloud Drift', text: 'Float ahead 3 spaces.', effect: { type: 'move', amount: 3 } }),
  withHitImage({ id: 'card-002', title: 'Snack Detour', text: 'Move back 2 spaces.', effect: { type: 'move', amount: -2 } }),
  withHitImage({ id: 'card-003', title: 'Rolling Momentum', text: 'Roll again.', effect: { type: 'roll_again' } }),
  withHitImage({ id: 'card-004', title: 'Sticky Pause', text: 'Skip your next turn.', effect: { type: 'skip_turns', amount: 1 } }),
  withHitImage({ id: 'card-005', title: 'Shortcut', text: 'Jump ahead 5 spaces.', effect: { type: 'move', amount: 5 } }),
  withHitImage({ id: 'card-006', title: 'Crash Landing', text: 'Move back 4 spaces.', effect: { type: 'move', amount: -4 } }),
  withHitImage({ id: 'card-007', title: 'Catch Up', text: 'Move ahead 2 spaces.', effect: { type: 'move', amount: 2 } }),
  withHitImage({ id: 'card-008', title: 'Wrong Turn', text: 'Move back 3 spaces.', effect: { type: 'move', amount: -3 } }),
  withHitImage({ id: 'card-009', title: 'Big Leap', text: 'Move ahead 6 spaces.', effect: { type: 'move', amount: 6 } }),
  withHitImage({ id: 'card-010', title: 'Pause', text: 'Skip your next turn.', effect: { type: 'skip_turns', amount: 1 } }),
  withHitImage({ id: 'card-011', title: 'Find The Green', text: 'Move to the next green space.', effect: { type: 'move_to_color', color: 'green', direction: 'next' } }),
  withHitImage({ id: 'card-012', title: 'Back To Blue', text: 'Move back to the previous blue space.', effect: { type: 'move_to_color', color: 'blue', direction: 'previous' } }),
  withHitImage({ id: 'card-013', title: 'Purple Pull', text: 'Move to the next purple space.', effect: { type: 'move_to_color', color: 'purple', direction: 'next' } }),
  withHitImage({ id: 'card-014', title: 'Yellow Reset', text: 'Move back to the previous yellow space.', effect: { type: 'move_to_color', color: 'yellow', direction: 'previous' } }),
  withHitImage({ id: 'card-015', title: 'Everybody Float', text: 'Everyone moves ahead 1 space.', effect: { type: 'move_all', amount: 1, filter: 'everyone' } }),
  withHitImage({ id: 'card-016', title: 'Group Drift', text: 'Everyone except you moves back 1 space.', effect: { type: 'move_all', amount: -1, filter: 'except_current' } }),
  withHitImage({ id: 'card-017', title: 'Leader Slip', text: 'The leader moves back 3 spaces.', effect: { type: 'move_leader', amount: -3 } }),
  withHitImage({ id: 'card-018', title: 'Swap With Leader', text: 'Swap spaces with the leader.', effect: { type: 'swap_position', target: 'leader' } }),
  withHitImage({ id: 'card-019', title: 'Pull From Behind', text: 'Swap with the nearest player behind you.', effect: { type: 'swap_position', target: 'behind' } }),
  withHitImage({ id: 'card-020', title: 'Last Place Lift', text: 'Swap with the player in last place.', effect: { type: 'swap_position', target: 'last_place' } }),
  withHitImage({ id: 'card-021', title: 'Reverse Rotation', text: 'Reverse turn order for 3 turns.', effect: { type: 'reverse_turn_order', turns: 3 } }),
  withHitImage({ id: 'card-022', title: 'Free Pass', text: 'Block the next backward movement against you.', effect: { type: 'protect_from_backward', uses: 1 } }),
  withHitImage({ id: 'card-023', title: 'Double Hit', text: 'Draw another card.', effect: { type: 'draw_again' } }),
  withHitImage({ id: 'card-024', title: 'Move And Roll', text: 'Move ahead 2 spaces, then roll again.', effect: { type: 'move_and_roll_again', amount: 2 } }),
  withHitImage({ id: 'card-025', title: 'Back Of The Pack', text: 'Players ahead of you move back 1 space.', effect: { type: 'move_all', amount: -1, filter: 'ahead' } }),
  withHitImage({ id: 'card-026', title: 'Help The Back', text: 'Players behind you move ahead 1 space.', effect: { type: 'move_all', amount: 1, filter: 'behind' } }),
  withHitImage({ id: 'card-027', title: 'Red Rush', text: 'Move to the next red space.', effect: { type: 'move_to_color', color: 'red', direction: 'next' } }),
  withHitImage({ id: 'card-028', title: 'Red Rewind', text: 'Move back to the previous red space.', effect: { type: 'move_to_color', color: 'red', direction: 'previous' } }),
  withHitImage({ id: 'card-029', title: 'Hard Pause', text: 'Skip your next 2 turns.', effect: { type: 'skip_turns', amount: 2 } }),
  withHitImage({ id: 'card-030', title: 'Final Push', text: 'Move ahead 8 spaces.', effect: { type: 'move', amount: 8 } })
];
