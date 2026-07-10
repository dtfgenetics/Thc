import type { HighLandRoomPlayer, HighLandRoomState } from './roomState';
import type { RoomTransport, RoomTransportSnapshot } from './roomTransport';

const SESSION_KEY_PREFIX = 'high-land-room-session:';

type ServerRoom = HighLandRoomState & { version: number };
type StoredRoomSession = { playerId: string; reconnectToken: string };
type ApiError = { code?: string; message?: string };
type ApiResponse = {
  ok: boolean;
  room?: ServerRoom;
  playerId?: string;
  reconnectToken?: string;
  error?: ApiError;
};

export type ServerRoomTransportOptions = {
  apiBaseUrl?: string;
  pollMs?: number;
  storage?: Storage;
};

export function createServerRoomTransport(options: ServerRoomTransportOptions = {}): RoomTransport {
  const apiBaseUrl = normalizeApiBase(options.apiBaseUrl ?? defaultServerRoomApiBase());
  const pollMs = Math.max(750, options.pollMs ?? 1500);
  const storage = options.storage ?? browserLocalStorage();
  const versions = new Map<string, number>();

  async function createRoom(hostPlayer: HighLandRoomPlayer): Promise<HighLandRoomState> {
    const response = await requestApi(apiBaseUrl, '/rooms', {
      method: 'POST',
      body: {
        playerName: hostPlayer.name,
        token: hostPlayer.token,
        color: hostPlayer.color,
        maxPlayers: 10
      }
    });
    const session = requireSessionResponse(response);
    saveSession(response.room.code, session, storage);
    versions.set(response.room.code, response.room.version);
    return markReady(response.room.code, true);
  }

  async function joinRoom(roomCode: string, player: HighLandRoomPlayer): Promise<HighLandRoomState> {
    const code = normalizeRoomCode(roomCode);
    const savedSession = loadSession(code, storage);
    if (savedSession) {
      try {
        const reconnected = await requestApi(apiBaseUrl, `/rooms/${code}/reconnect`, {
          method: 'POST',
          body: savedSession
        });
        const room = requireRoom(reconnected);
        versions.set(code, room.version);
        return room;
      } catch {
        removeSession(code, storage);
      }
    }

    const response = await requestApi(apiBaseUrl, `/rooms/${code}/join`, {
      method: 'POST',
      body: {
        playerName: player.name,
        token: player.token,
        color: player.color
      }
    });
    const session = requireSessionResponse(response);
    saveSession(code, session, storage);
    versions.set(code, response.room.version);
    return markReady(code, true);
  }

  async function markReady(roomCode: string, ready: boolean): Promise<HighLandRoomState> {
    const code = normalizeRoomCode(roomCode);
    const room = requireRoom(
      await authenticatedRequest(apiBaseUrl, code, storage, `/rooms/${code}/ready`, {
        method: 'POST',
        body: { ready, expectedVersion: requireVersion(code, versions) }
      })
    );
    versions.set(code, room.version);
    return room;
  }

  async function startGame(roomCode: string): Promise<HighLandRoomState> {
    const code = normalizeRoomCode(roomCode);
    const room = requireRoom(
      await authenticatedRequest(apiBaseUrl, code, storage, `/rooms/${code}/start`, {
        method: 'POST',
        body: { expectedVersion: requireVersion(code, versions) }
      })
    );
    versions.set(code, room.version);
    return room;
  }

  async function rollDice(roomCode: string): Promise<HighLandRoomState> {
    const code = normalizeRoomCode(roomCode);
    const room = requireRoom(
      await authenticatedRequest(apiBaseUrl, code, storage, `/rooms/${code}/actions`, {
        method: 'POST',
        body: {
          type: 'ROLL_DICE',
          actionId: createActionId(),
          expectedVersion: requireVersion(code, versions)
        }
      })
    );
    versions.set(code, room.version);
    return room;
  }

  return {
    createRoom,
    joinRoom,
    async updateGameState() {
      throw new Error('The authoritative multiplayer server does not accept browser-generated game state.');
    },
    async appendEvent() {
      // Authoritative server actions own the event history. Client event uploads are intentionally disabled.
    },
    startGame(roomCode) {
      return startGame(roomCode);
    },
    rollDice(roomCode) {
      return rollDice(roomCode);
    },
    getLocalPlayerId(roomCode) {
      return loadSession(normalizeRoomCode(roomCode), storage)?.playerId ?? null;
    },
    subscribe(roomCode, onSnapshot) {
      const code = normalizeRoomCode(roomCode);
      let active = true;
      let timer: number | undefined;
      onSnapshot({ status: 'connecting', room: null, error: null });

      const poll = async (): Promise<void> => {
        if (!active) return;
        try {
          const room = requireRoom(
            await authenticatedRequest(apiBaseUrl, code, storage, `/rooms/${code}`, { method: 'GET' })
          );
          versions.set(code, room.version);
          onSnapshot({ status: 'connected', room, error: null });
        } catch (error) {
          onSnapshot(toErrorSnapshot(error));
        }
        if (active) timer = window.setTimeout(poll, pollMs);
      };

      void poll();
      return () => {
        active = false;
        if (timer !== undefined) window.clearTimeout(timer);
      };
    }
  };
}

export function defaultServerRoomApiBase(): string {
  const configured = import.meta.env.VITE_MULTIPLAYER_API_URL as string | undefined;
  if (configured?.trim()) return configured.trim();
  if (typeof location === 'undefined') return 'http://localhost:2567/api/v1';
  return `${location.origin}/api/v1`;
}

async function authenticatedRequest(
  apiBaseUrl: string,
  roomCode: string,
  storage: Storage | undefined,
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown }
): Promise<ApiResponse> {
  const session = loadSession(roomCode, storage);
  if (!session) throw new Error('This browser does not have a valid session for that room.');
  return requestApi(apiBaseUrl, path, {
    ...options,
    headers: {
      'X-Player-Id': session.playerId,
      'X-Session-Token': session.reconnectToken
    }
  });
}

async function requestApi(
  apiBaseUrl: string,
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string> }
): Promise<ApiResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method,
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? `Multiplayer API failed with status ${response.status}.`);
  }
  return payload;
}

function requireSessionResponse(response: ApiResponse): { room: ServerRoom; playerId: string; reconnectToken: string } {
  if (!response.room || !response.playerId || !response.reconnectToken) {
    throw new Error('Multiplayer API did not return a complete player session.');
  }
  return { room: response.room, playerId: response.playerId, reconnectToken: response.reconnectToken };
}

function requireRoom(response: ApiResponse): ServerRoom {
  if (!response.room) throw new Error('Multiplayer API did not return room state.');
  return response.room;
}

function requireVersion(roomCode: string, versions: Map<string, number>): number {
  const version = versions.get(roomCode);
  if (!Number.isInteger(version)) throw new Error('Room state has not loaded yet.');
  return version as number;
}

function saveSession(roomCode: string, session: StoredRoomSession, storage: Storage | undefined): void {
  storage?.setItem(`${SESSION_KEY_PREFIX}${roomCode}`, JSON.stringify(session));
}

function loadSession(roomCode: string, storage: Storage | undefined): StoredRoomSession | null {
  const raw = storage?.getItem(`${SESSION_KEY_PREFIX}${roomCode}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRoomSession>;
    return parsed.playerId && parsed.reconnectToken
      ? { playerId: parsed.playerId, reconnectToken: parsed.reconnectToken }
      : null;
  } catch {
    return null;
  }
}

function removeSession(roomCode: string, storage: Storage | undefined): void {
  storage?.removeItem(`${SESSION_KEY_PREFIX}${roomCode}`);
}

function browserLocalStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function normalizeApiBase(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function createActionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toErrorSnapshot(error: unknown): RoomTransportSnapshot {
  return {
    status: 'error',
    room: null,
    error: error instanceof Error ? error.message : 'Could not load multiplayer room.'
  };
}
