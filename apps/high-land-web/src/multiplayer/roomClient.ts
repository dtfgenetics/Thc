import { gameAssetPath } from '../game/systems/assetPath';
import type { GameState } from '../game/types/gameTypes';
import type { RoomApiResponse, RoomCredentials, RoomSnapshot } from './roomTypes';

const requestTimeoutMs = 8_000;
const credentialPrefix = 'high-land-room-v1:';

export class RoomApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'connection_failed',
    public readonly status = 0,
    public readonly room: RoomSnapshot | null = null
  ) {
    super(message);
  }
}

export async function createRoom(name: string): Promise<RoomApiResponse> {
  return requestRoom({ action: 'create', name });
}

export async function inspectRoom(gameId: string): Promise<RoomApiResponse> {
  return requestRoom({ action: 'inspect', gameId });
}

export async function joinRoom(gameId: string, name: string): Promise<RoomApiResponse> {
  return requestRoom({ action: 'join', gameId, name });
}

export async function reconnectRoom(credentials: RoomCredentials): Promise<RoomApiResponse> {
  return requestRoom({ action: 'sync', ...credentials });
}

export async function startRoom(credentials: RoomCredentials): Promise<RoomApiResponse> {
  return requestRoom({ action: 'start', ...credentials });
}

export async function commitRoomState(
  credentials: RoomCredentials,
  expectedVersion: number,
  gameState: GameState
): Promise<RoomApiResponse> {
  return requestRoom({ action: 'commit', ...credentials, expectedVersion, gameState });
}

export function saveRoomCredentials(credentials: RoomCredentials): void {
  try {
    window.sessionStorage.setItem(`${credentialPrefix}${credentials.gameId}`, JSON.stringify(credentials));
  } catch {
    // Reconnect is best effort when storage is unavailable.
  }
}

export function loadRoomCredentials(gameId: string): RoomCredentials | null {
  try {
    const raw = window.sessionStorage.getItem(`${credentialPrefix}${gameId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomCredentials>;
    if (parsed.gameId !== gameId || !parsed.playerId || !parsed.playerToken) return null;
    return parsed as RoomCredentials;
  } catch {
    return null;
  }
}

export function clearRoomCredentials(gameId: string): void {
  try {
    window.sessionStorage.removeItem(`${credentialPrefix}${gameId}`);
  } catch {
    // Ignore storage errors.
  }
}

export function normalizeGameId(value: string | null): string | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  return /^[A-Z2-9]{6}$/.test(normalized) ? normalized : null;
}

async function requestRoom(payload: Record<string, unknown>): Promise<RoomApiResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(gameAssetPath('api/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json() as RoomApiResponse & {
      code?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new RoomApiError(
        data.message ?? 'High Land could not connect to this game.',
        data.code,
        response.status,
        data.room ?? null
      );
    }

    return data;
  } catch (error) {
    if (error instanceof RoomApiError) throw error;
    throw new RoomApiError('Connection failed. You can still play High Land locally.');
  } finally {
    window.clearTimeout(timer);
  }
}
