import { finishIndex } from '../data/boardPath';
import type { GameState, Player, PlayerToken, TurnDirection } from '../types/gameTypes';
import { tokenColors, tokenOrder } from './playerSystem';

const storageKey = 'high-land-save-v1';

export function saveGameState(state: GameState): void {
  const storage = getBrowserStorage();
  if (!storage) return;

  try {
    storage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Storage can fail in private mode or embedded contexts. The game should still run.
  }
}

export function loadGameState(): GameState | null {
  const storage = getBrowserStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    return hydrateGameState(JSON.parse(raw) as Partial<GameState>);
  } catch {
    return null;
  }
}

export function clearSavedGameState(): void {
  const storage = getBrowserStorage();
  if (!storage) return;

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage errors.
  }
}

function hydrateGameState(raw: Partial<GameState>): GameState | null {
  if (!raw.players || raw.players.length < 2) return null;

  const players = raw.players.map(hydratePlayer);

  return {
    players,
    currentPlayerIndex: clampIndex(raw.currentPlayerIndex, players.length),
    phase: raw.phase ?? 'ready',
    turnDirection: hydrateTurnDirection(raw.turnDirection),
    reverseTurnsRemaining: Math.max(0, raw.reverseTurnsRemaining ?? 0),
    lastRoll: raw.lastRoll ?? null,
    lastCard: raw.lastCard ?? null,
    message: raw.message ?? 'Saved game loaded.',
    winnerId: raw.winnerId ?? null,
    cardCursor: Math.max(0, raw.cardCursor ?? 0)
  };
}

function hydratePlayer(player: Partial<Player>, index: number): Player {
  return {
    id: player.id ?? `player-restored-${index + 1}`,
    name: player.name ?? `Player ${index + 1}`,
    token: hydrateToken(player.token, index),
    color: player.color ?? tokenColors[index % tokenColors.length],
    positionIndex: clampBoardIndex(player.positionIndex),
    skipTurns: Math.max(0, player.skipTurns ?? 0),
    protectedFromBackward: Math.max(0, player.protectedFromBackward ?? 0)
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function hydrateToken(token: PlayerToken | undefined, index: number): PlayerToken {
  if (token && tokenOrder.includes(token)) return token;
  return tokenOrder[index % tokenOrder.length];
}

function hydrateTurnDirection(direction: TurnDirection | undefined): TurnDirection {
  return direction === -1 ? -1 : 1;
}

function clampIndex(index: number | undefined, length: number): number {
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(index ?? 0, length - 1));
}

function clampBoardIndex(index: number | undefined): number {
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(index ?? 0, finishIndex));
}
