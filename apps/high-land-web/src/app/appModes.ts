export type HighLandAppMode =
  | 'landing'
  | 'local_setup'
  | 'create_room'
  | 'join_room'
  | 'lobby'
  | 'playing'
  | 'game_over';

export type HighLandAppModeState = {
  mode: HighLandAppMode;
  roomCode: string | null;
  localPlayerId: string | null;
  error: string | null;
};

export const initialHighLandAppModeState: HighLandAppModeState = {
  mode: 'landing',
  roomCode: null,
  localPlayerId: null,
  error: null
};

export function canEnterMode(currentMode: HighLandAppMode, nextMode: HighLandAppMode): boolean {
  if (currentMode === nextMode) return true;

  const allowedTransitions: Record<HighLandAppMode, HighLandAppMode[]> = {
    landing: ['local_setup', 'create_room', 'join_room'],
    local_setup: ['landing', 'playing'],
    create_room: ['landing', 'lobby'],
    join_room: ['landing', 'lobby'],
    lobby: ['landing', 'playing'],
    playing: ['game_over'],
    game_over: ['landing', 'local_setup', 'create_room']
  };

  return allowedTransitions[currentMode].includes(nextMode);
}

export function transitionHighLandMode(
  state: HighLandAppModeState,
  nextMode: HighLandAppMode,
  patch: Partial<Omit<HighLandAppModeState, 'mode'>> = {}
): HighLandAppModeState {
  if (!canEnterMode(state.mode, nextMode)) {
    return {
      ...state,
      error: `Cannot move from ${state.mode} to ${nextMode}.`
    };
  }

  return {
    ...state,
    ...patch,
    mode: nextMode,
    error: null
  };
}
