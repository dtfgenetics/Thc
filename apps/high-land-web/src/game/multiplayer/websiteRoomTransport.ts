import type { RoomTransport, RoomTransportSnapshot } from './roomTransport';
import type { HighLandGameEvent } from '../events/gameEvents';
import { defaultWebsiteRoomApiBase, getWebsiteRoomApi, postWebsiteRoomApi } from './websiteRoomApi';

export type WebsiteRoomTransportOptions = {
  apiBaseUrl?: string;
  gameSlug?: string;
  pollMs?: number;
  authStorage?: Storage | null;
  createAuthKey?: () => string;
};

const authStoragePrefix = 'high-land-room-auth-v1';

export function createWebsiteRoomTransport(options: WebsiteRoomTransportOptions = {}): RoomTransport {
  const apiBaseUrl = options.apiBaseUrl ?? defaultWebsiteRoomApiBase();
  const gameSlug = options.gameSlug ?? 'high-land';
  const pollMs = Math.max(1000, options.pollMs ?? 2000);
  const authStorage = options.authStorage === undefined ? browserSessionStorage() : options.authStorage;
  const createAuthKey = options.createAuthKey ?? generateRoomAuthKey;
  const inMemoryAuth = new Map<string, string>();

  function rememberAuth(roomCode: string, playerId: string, authKey: string): void {
    const key = roomAuthStorageKey(roomCode, playerId);
    inMemoryAuth.set(key, authKey);
    try {
      authStorage?.setItem(key, authKey);
    } catch {
      // Session storage can be unavailable in restrictive browser modes.
    }
  }

  function readAuth(roomCode: string, playerId: string): string | null {
    const key = roomAuthStorageKey(roomCode, playerId);
    const memoryValue = inMemoryAuth.get(key);
    if (memoryValue) return memoryValue;
    try {
      const stored = authStorage?.getItem(key) ?? null;
      if (stored) {
        inMemoryAuth.set(key, stored);
        return stored;
      }
    } catch {
      // Fall back to the runtime-only map.
    }
    return null;
  }

  function requireAuth(roomCode: string, playerId: string): string {
    const authKey = readAuth(roomCode, playerId);
    if (!authKey) {
      throw new Error('Secure room session is missing. Rejoin the room before making changes.');
    }
    return authKey;
  }

  return {
    async createRoom(hostPlayer) {
      const authKey = createAuthKey();
      const room = await postWebsiteRoomApi(apiBaseUrl, 'create-room.php', {
        game: gameSlug,
        maxPlayers: 10,
        playerId: hostPlayer.id,
        playerName: hostPlayer.name,
        token: hostPlayer.token,
        color: hostPlayer.color,
        authKey,
        state: null
      });
      rememberAuth(room.code, hostPlayer.id, authKey);
      return room;
    },

    async joinRoom(roomCode, player) {
      const normalizedRoomCode = roomCode.trim().toUpperCase();
      const authKey = readAuth(normalizedRoomCode, player.id) ?? createAuthKey();
      const room = await postWebsiteRoomApi(apiBaseUrl, 'join-room.php', {
        roomCode: normalizedRoomCode,
        playerId: player.id,
        playerName: player.name,
        token: player.token,
        color: player.color,
        authKey
      });
      rememberAuth(room.code, player.id, authKey);
      return room;
    },

    updateGameState(roomCode, gameState, requestingPlayerId) {
      const authKey = requireAuth(roomCode, requestingPlayerId);
      return postWebsiteRoomApi(apiBaseUrl, 'update-room.php', {
        roomCode,
        playerId: requestingPlayerId,
        authKey,
        status: gameState.winnerId ? 'complete' : 'playing',
        state: gameState
      });
    },

    async appendEvent(roomCode, event) {
      const playerId = event.playerId;
      if (!playerId) {
        throw new Error('Room events must identify the authenticated player.');
      }
      const authKey = requireAuth(roomCode, playerId);
      await postWebsiteRoomApi(apiBaseUrl, 'append-event.php', {
        roomCode,
        playerId,
        authKey,
        event
      });
    },

    subscribe(roomCode, onSnapshot) {
      let active = true;
      let timer: number | undefined;

      const poll = async () => {
        if (!active) return;
        try {
          const room = await getWebsiteRoomApi(apiBaseUrl, roomCode);
          onSnapshot({ status: 'connected', room, error: null });
        } catch (error) {
          onSnapshot({ status: 'error', room: null, error: error instanceof Error ? error.message : 'Could not load room.' });
        }
        if (active) timer = window.setTimeout(poll, pollMs);
      };

      poll();
      return () => {
        active = false;
        if (timer) window.clearTimeout(timer);
      };
    }
  };
}

function browserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function roomAuthStorageKey(roomCode: string, playerId: string): string {
  return `${authStoragePrefix}:${roomCode.trim().toUpperCase()}:${playerId}`;
}

function generateRoomAuthKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function snapshotFromWebsiteRoom(snapshot: RoomTransportSnapshot): RoomTransportSnapshot {
  return snapshot;
}

export type WebsiteRoomEvent = HighLandGameEvent;
