import type { GameState } from '../types/gameTypes';
import type { HighLandGameEvent } from './gameEvents';

export type EventReducerResult = {
  state: GameState;
  warnings: string[];
};

export function reduceHighLandEvent(state: GameState, event: HighLandGameEvent): EventReducerResult {
  switch (event.name) {
    case 'dice_rolled':
    case 'player_moved':
    case 'hit_card_drawn':
    case 'skip_turn_applied':
    case 'winner_declared':
      return {
        state,
        warnings: [
          `${event.name} is recorded for multiplayer sync/debugging. Wire this to gameEngine once Supabase room state is approved.`
        ]
      };
    case 'room_created':
    case 'player_joined':
    case 'game_started':
      return {
        state,
        warnings: [`${event.name} affects room metadata, not local GameState.`]
      };
    default: {
      const exhaustive: never = event;
      return { state, warnings: [`Unhandled event ${(exhaustive as HighLandGameEvent).name}.`] };
    }
  }
}

export function replayHighLandEvents(initialState: GameState, events: HighLandGameEvent[]): EventReducerResult {
  return events.reduce<EventReducerResult>(
    (result, event) => {
      const next = reduceHighLandEvent(result.state, event);
      return {
        state: next.state,
        warnings: [...result.warnings, ...next.warnings]
      };
    },
    { state: initialState, warnings: [] }
  );
}
