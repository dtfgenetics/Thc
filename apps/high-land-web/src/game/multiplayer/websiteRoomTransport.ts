import type { RoomTransport, RoomTransportSnapshot } from './roomTransport';
import type { HighLandGameEvent } from '../events/gameEvents';
import { defaultWebsiteRoomApiBase, getWebsiteRoomApi, postWebsiteRoomApi } from './websiteRoomApi';

export type WebsiteRoomTransportOptions = {
  apiBaseUrl?: string;
  gameSlug?: string;
  pollMs?: number;
  credentialProvider?: () => string;
  credentialStorage?: Storage | null;
  legacyCredentialStorage?: Storage | null;
};

const WEBSITE_ROOM_CREDENTIAL_KEY = 'high-land-room-credential-v1';
const WEBSITE_ROOM_SCOPED_CREDENTIAL_PREFIX = 'high-land-room-player-credential-v2';

export function createWebsiteRoomTransport(options: WebsiteRoomTransportOptions = {}): RoomTransport {
  const apiBaseUrl = options.apiBaseUrl ?? defaultWebsiteRoomApiBase();
  const gameSlug = options.gameSlug ?? 'high-land';
  const pollMs = Math.max(1000, options.pollMs ?? 2000);
  const credentialProvider = options.credentialProvider ?? generateWebsiteRoomCredential;
  const credentialStorage = options.credentialStorage === undefined ? resolveSessionStorage() : options.credentialStorage;
  const legacyCredentialStorage = options.legacyCredentialStorage === undefined ? resolveLocalStorage() : options.legacyCredentialStorage;
  const runtimeCredentials = new Map<string, string>();

  function rememberCredential(roomCode: string, playerId: string, credential: string): void {
    const key = scopedCredentialKey(roomCode, playerId);
    runtimeCredentials.set(key, credential);
    try {
      credentialStorage?.setItem(key, credential);
    } catch {
      // Restrictive browser modes can block sessionStorage. Runtime memory still keeps the active room usable.
    }
  }

  function readScopedCredential(roomCode: string, playerId: string): string | null {
    const key = scopedCredentialKey(roomCode, playerId);
    const runtimeValue = runtimeCredentials.get(key);
    if (runtimeValue) return runtimeValue;
    try {
      const stored = credentialStorage?.getItem(key) ?? null;
      if (/^[a-f0-9]{64}$/i.test(stored ?? '')) {
        runtimeCredentials.set(key, stored as string);
        return stored;
      }
    } catch {
      // Runtime memory remains available when storage access fails.
    }
    return null;
  }

  function readLegacyCredential(): string | null {
    try {
      const saved = legacyCredentialStorage?.getItem(WEBSITE_ROOM_CREDENTIAL_KEY) ?? null;
      return /^[a-f0-9]{64}$/i.test(saved ?? '') ? saved : null;
    } catch {
      return null;
    }
  }

  function requireCredential(roomCode: string, playerId: string): string {
    const scoped = readScopedCredential(roomCode, playerId);
    if (scoped) return scoped;

    const legacy = readLegacyCredential();
    if (legacy) {
      rememberCredential(roomCode, playerId, legacy);
      return legacy;
    }

    throw new Error('Secure room session is missing. Rejoin the room before making changes.');
  }

  return {
    async createRoom(hostPlayer) {
      const credential = credentialProvider();
      const room = await postWebsiteRoomApi(apiBaseUrl, 'create-room.php', {
        game: gameSlug,
        maxPlayers: 10,
        playerId: hostPlayer.id,
        playerName: hostPlayer.name,
        token: hostPlayer.token,
        color: hostPlayer.color,
        credential,
        state: null
      });
      rememberCredential(room.code, hostPlayer.id, credential);
      return room;
    },

    async joinRoom(roomCode, player) {
      const normalizedRoomCode = roomCode.trim().toUpperCase();
      let credential = readScopedCredential(normalizedRoomCode, player.id);

      if (!credential) {
        const room = await getWebsiteRoomApi(apiBaseUrl, normalizedRoomCode);
        const reconnectingExistingPlayer = room.players.some((roomPlayer) => roomPlayer.id === player.id);
        credential = reconnectingExistingPlayer ? readLegacyCredential() : null;
        credential ??= credentialProvider();
      }

      const room = await postWebsiteRoomApi(apiBaseUrl, 'join-room.php', {
        roomCode: normalizedRoomCode,
        playerId: player.id,
        playerName: player.name,
        token: player.token,
        color: player.color,
        credential
      });
      rememberCredential(room.code, player.id, credential);
      return room;
    },

    updateGameState(roomCode, gameState, requestingPlayerId) {
      return postWebsiteRoomApi(apiBaseUrl, 'update-room.php', {
        roomCode,
        playerId: requestingPlayerId,
        credential: requireCredential(roomCode, requestingPlayerId),
        status: gameState.winnerId ? 'complete' : 'playing',
        state: gameState
      });
    },

    async appendEvent(roomCode, event, requestingPlayerId) {
      const playerId = requestingPlayerId ?? event.playerId;
      if (!playerId) {
        throw new Error('Authenticated player id is required to append a room event.');
      }
      await postWebsiteRoomApi(apiBaseUrl, 'append-event.php', {
        roomCode,
        playerId,
        credential: requireCredential(roomCode, playerId),
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

export function getOrCreateWebsiteRoomCredential(storage: Storage | null = resolveLocalStorage()): string {
  const saved = storage?.getItem(WEBSITE_ROOM_CREDENTIAL_KEY) ?? '';
  if (/^[a-f0-9]{64}$/i.test(saved)) {
    return saved;
  }

  const generated = generateWebsiteRoomCredential();
  storage?.setItem(WEBSITE_ROOM_CREDENTIAL_KEY, generated);
  return generated;
}

function resolveSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function resolveLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function scopedCredentialKey(roomCode: string, playerId: string): string {
  return `${WEBSITE_ROOM_SCOPED_CREDENTIAL_PREFIX}:${roomCode.trim().toUpperCase()}:${playerId}`;
}

function generateWebsiteRoomCredential(): string {
  const secureCrypto = globalThis.crypto;
  if (!secureCrypto?.getRandomValues) {
    throw new Error('Secure browser randomness is unavailable; online room creation is disabled.');
  }
  const bytes = new Uint8Array(32);
  secureCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function snapshotFromWebsiteRoom(snapshot: RoomTransportSnapshot): RoomTransportSnapshot {
  return snapshot;
}

export type WebsiteRoomEvent = HighLandGameEvent;
