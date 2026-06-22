import type { ActionCard, GameState } from '../types/gameTypes';

export type HighLandGameEventName =
  | 'room_created'
  | 'player_joined'
  | 'game_started'
  | 'dice_rolled'
  | 'player_moved'
  | 'hit_card_drawn'
  | 'skip_turn_applied'
  | 'winner_declared';

export type HighLandGameEventBase<TName extends HighLandGameEventName, TPayload extends Record<string, unknown>> = {
  id: string;
  name: TName;
  roomCode: string | null;
  playerId: string | null;
  createdAt: string;
  payload: TPayload;
};

export type RoomCreatedEvent = HighLandGameEventBase<'room_created', { roomCode: string; hostPlayerId: string }>;
export type PlayerJoinedEvent = HighLandGameEventBase<'player_joined', { playerId: string; playerName: string }>;
export type GameStartedEvent = HighLandGameEventBase<'game_started', { playerCount: number }>;
export type DiceRolledEvent = HighLandGameEventBase<'dice_rolled', { roll: number; fromIndex: number; toIndex: number }>;
export type PlayerMovedEvent = HighLandGameEventBase<'player_moved', { fromIndex: number; toIndex: number; reason: 'dice' | 'card' | 'space' }>;
export type HitCardDrawnEvent = HighLandGameEventBase<'hit_card_drawn', { card: ActionCard }>;
export type SkipTurnAppliedEvent = HighLandGameEventBase<'skip_turn_applied', { skippedPlayerId: string; skipTurns: number }>;
export type WinnerDeclaredEvent = HighLandGameEventBase<'winner_declared', { winnerId: string; finishIndex: number }>;

export type HighLandGameEvent =
  | RoomCreatedEvent
  | PlayerJoinedEvent
  | GameStartedEvent
  | DiceRolledEvent
  | PlayerMovedEvent
  | HitCardDrawnEvent
  | SkipTurnAppliedEvent
  | WinnerDeclaredEvent;

export function createGameEvent<TEvent extends HighLandGameEvent>(
  event: Omit<TEvent, 'id' | 'createdAt'>,
  random: () => number = Math.random
): TEvent {
  return {
    ...event,
    id: createEventId(random),
    createdAt: new Date().toISOString()
  } as TEvent;
}

export function createEventId(random: () => number = Math.random): string {
  const entropy = Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36);
  return `event_${Date.now().toString(36)}_${entropy}`;
}

export function serializeGameStateSnapshot(state: GameState): string {
  return JSON.stringify(state);
}
