import type { GameState, Player } from '../types/gameTypes';

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
    return hydrateGameState(JSON.parse(raw) as Partial<GameState>);
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

function hydrateGameState(raw: Partial<GameState>): GameState | null {
  if (!raw.players || raw.players.length < 2) return null;

  return {
    players: raw.players.map(hydratePlayer),
    currentPlayerIndex: raw.currentPlayerIndex ?? 0,
    phase: raw.phase ?? 'ready',
    turnDirection: raw.turnDirection ?? 1,
    reverseTurnsRemaining: raw.reverseTurnsRemaining ?? 0,
    lastRoll: raw.lastRoll ?? null,
    lastCard: raw.lastCard ?? null,
    message: raw.message ?? 'Saved game loaded.',
    winnerId: raw.winnerId ?? null,
    cardCursor: raw.cardCursor ?? 0
  };
}

function hydratePlayer(player: Partial<Player>): Player {
  return {
    id: player.id ?? crypto.randomUUID(),
    name: player.name ?? 'Player',
    token: player.token ?? 'tokenA',
    color: player.color ?? '#ffffff',
    positionIndex: player.positionIndex ?? 0,
    skipTurns: player.skipTurns ?? 0,
    protectedFromBackward: player.protectedFromBackward ?? 0
  };
}
