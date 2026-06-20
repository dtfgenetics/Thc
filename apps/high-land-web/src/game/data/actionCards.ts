import type { ActionCard } from '../types/gameTypes';

export const starterActionCards: ActionCard[] = [
  { id: 'card-001', title: 'Cloud Boost', text: 'Float ahead 3 spaces.', effect: { type: 'move', amount: 3 } },
  { id: 'card-002', title: 'Snack Detour', text: 'Move back 2 spaces.', effect: { type: 'move', amount: -2 } },
  { id: 'card-003', title: 'Rolling Momentum', text: 'Roll again.', effect: { type: 'roll_again' } },
  { id: 'card-004', title: 'Sticky Trap', text: 'Skip your next turn.', effect: { type: 'skip_turns', amount: 1 } },
  { id: 'card-005', title: 'Shortcut', text: 'Jump ahead 5 spaces.', effect: { type: 'move', amount: 5 } },
  { id: 'card-006', title: 'Crash Landing', text: 'Move back 4 spaces.', effect: { type: 'move', amount: -4 } },
  { id: 'card-007', title: 'Catch Up', text: 'Move ahead 2 spaces.', effect: { type: 'move', amount: 2 } },
  { id: 'card-008', title: 'Wrong Turn', text: 'Move back 3 spaces.', effect: { type: 'move', amount: -3 } },
  { id: 'card-009', title: 'Big Leap', text: 'Move ahead 6 spaces.', effect: { type: 'move', amount: 6 } },
  { id: 'card-010', title: 'Pause', text: 'Skip your next turn.', effect: { type: 'skip_turns', amount: 1 } }
];
