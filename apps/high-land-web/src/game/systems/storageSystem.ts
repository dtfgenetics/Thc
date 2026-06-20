import type { GameState } from '../types/gameTypes';

const storageKey = 'high-land-save-v1';

export function saveGameState(state: GameState): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Storage can fail in private mode or embedded contexts. The game should still run.
  }
}

export function loadGameState(): GameState | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearSavedGameState(): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors.
  }
}
