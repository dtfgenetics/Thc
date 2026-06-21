import type { ActionCard, ActionCardArt } from '../types/gameTypes';

const art = (sheet: ActionCardArt['sheet'], column: ActionCardArt['column'], row: ActionCardArt['row']): ActionCardArt => ({
  sheet,
  column,
  row
});

export const starterActionCards: ActionCard[] = [
  { id: 'perfect-roll', title: 'Perfect Roll', text: 'Move forward 3 spaces.', effect: { type: 'move', amount: 3 }, art: art(1, 0, 0) },
  { id: 'cough-lock', title: 'Cough Lock', text: 'Lose your next turn.', effect: { type: 'skip_turns', amount: 1 }, art: art(1, 1, 0) },
  { id: 'rosin-rush', title: 'Rosin Rush', text: 'Move forward 3 spaces and draw again.', effect: { type: 'move_and_draw_again', amount: 3 }, art: art(1, 2, 0) },
  { id: 'lost-in-dankwood', title: 'Lost in Dankwood', text: 'Move back to the previous green space.', effect: { type: 'move_to_color', color: 'green', direction: 'previous' }, art: art(1, 3, 0) },
  { id: 'munchie-motivation', title: 'Munchie Motivation', text: 'Move forward 2 spaces.', effect: { type: 'move', amount: 2 }, art: art(1, 0, 1) },
  { id: 'kief-avalanche', title: 'Kief Avalanche', text: 'Move back 5 spaces.', effect: { type: 'move', amount: -5 }, art: art(1, 1, 1) },
  { id: 'trichome-boost', title: 'Trichome Boost', text: 'Move to the next purple space.', effect: { type: 'move_to_color', color: 'purple', direction: 'next' }, art: art(1, 2, 1) },
  { id: 'cloud-9-drift', title: 'Cloud 9 Drift', text: 'Move forward 5 spaces.', effect: { type: 'move', amount: 5 }, art: art(1, 3, 1) },

  { id: 'good-vibes-only', title: 'Good Vibes Only', text: 'Move forward 4 spaces.', effect: { type: 'move', amount: 4 }, art: art(2, 0, 0) },
  { id: 'rosin-spill', title: 'Rosin Spill', text: 'Move back 3 spaces.', effect: { type: 'move', amount: -3 }, art: art(2, 1, 0) },
  { id: 'pass-the-pack', title: 'Pass the Pack', text: 'Switch places with the player behind you.', effect: { type: 'swap_position', target: 'behind' }, art: art(2, 2, 0) },
  { id: 'hot-box', title: 'Hot Box', text: 'Every other player skips their next turn.', effect: { type: 'skip_others', amount: 1 }, art: art(2, 3, 0) },
  { id: 'snack-tax', title: 'Snack Tax', text: 'Every player ahead of you moves back 1 space.', effect: { type: 'move_all', amount: -1, filter: 'ahead' }, art: art(2, 0, 1) },
  { id: 'bogart-alert', title: 'Bogart Alert', text: 'The player in first place moves back 3 spaces.', effect: { type: 'move_leader', amount: -3 }, art: art(2, 1, 1) },
  { id: 'free-pass', title: 'Free Pass', text: 'Ignore the next card that moves you backward.', effect: { type: 'protect_from_backward', uses: 1 }, art: art(2, 2, 1) },
  { id: 'high-roller', title: 'High Roller', text: 'Roll again and move that many extra spaces.', effect: { type: 'roll_again' }, art: art(2, 3, 1) },

  { id: 'rotation-rule', title: 'Rotation Rule', text: 'Everyone moves forward 1 space.', effect: { type: 'move_all', amount: 1, filter: 'everyone' }, art: art(3, 1, 0) },
  { id: 'puff-puff-pass', title: 'Puff Puff Pass', text: 'Move forward 2, then choose a player to move forward 1.', effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 1 }, art: art(3, 3, 0) },
  { id: 'reverse-rotation', title: 'Reverse Rotation', text: 'Turn order reverses for one round.', effect: { type: 'reverse_turn_order', turns: 'round' }, art: art(3, 2, 1) },
  { id: 'friend-boost', title: 'Friend Boost', text: 'Choose a player. You both move forward 2 spaces.', effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 2 }, art: art(3, 3, 1) },

  { id: 'smooth-cruise', title: 'Smooth Cruise', text: 'Move forward 2 spaces.', effect: { type: 'move', amount: 2 }, art: art(4, 0, 0) },
  { id: 'lucky-lighter', title: 'Lucky Lighter', text: 'Move forward to the next yellow space.', effect: { type: 'move_to_color', color: 'yellow', direction: 'next' }, art: art(4, 1, 0) },
  { id: 'rolling-hills-shortcut', title: 'Rolling Hills Shortcut', text: 'Move forward 5 spaces.', effect: { type: 'move', amount: 5 }, art: art(4, 2, 0) },
  { id: 'dankwood-trail', title: 'Dankwood Trail', text: 'Move forward to the next green space.', effect: { type: 'move_to_color', color: 'green', direction: 'next' }, art: art(4, 3, 0) },
  { id: 'dropped-the-lighter', title: 'Dropped the Lighter', text: 'Move back 2 spaces.', effect: { type: 'move', amount: -2 }, art: art(4, 0, 1) },
  { id: 'burnt-snack-run', title: 'Burnt Snack Run', text: 'Move back 4 spaces.', effect: { type: 'move', amount: -4 }, art: art(4, 1, 1) },
  { id: 'sticky-fingers', title: 'Sticky Fingers', text: 'Move back to the previous yellow space.', effect: { type: 'move_to_color', color: 'yellow', direction: 'previous' }, art: art(4, 2, 1) },
  { id: 'couch-locked', title: 'Couch Locked', text: 'Stay here until your next turn.', effect: { type: 'skip_turns', amount: 1 }, art: art(4, 3, 1) },

  { id: 'rosin-rail-ride', title: 'Rosin Rail Ride', text: 'Move forward 6 spaces.', effect: { type: 'move', amount: 6 }, art: art(5, 1, 0) },
  { id: 'munchie-mountain', title: 'Munchie Mountain', text: 'Move forward 3 spaces.', effect: { type: 'move', amount: 3 }, art: art(5, 2, 0) },
  { id: 'kief-cave-slip', title: 'Kief Cave Slip', text: 'Move back 3 spaces and draw again.', effect: { type: 'move_and_draw_again', amount: -3 }, art: art(5, 3, 0) }
];
