import type { RoomTransport, RoomTransportSnapshot } from './roomTransport';
import type { HighLandGameEvent } from '../events/gameEvents';
import { defaultWebsiteRoomApiBase, getWebsiteRoomApi, postWebsiteRoomApi } from './websiteRoomApi';

export type WebsiteRoomTransportOptions = {
  apiBaseUrl?: string;
  gameSlug?: string;
  pollMs?: number;
  credentialProvider?: () => string;
};

const WEBSITE_ROOM_CREDENTIAL_KEY = 'high-land-room-credential-v1';

export function createWebsiteRoomTransport(options: WebsiteRoomTransportOptions = {}): RoomTransport {
  const apiBaseUrl = options.apiBaseUrl ?? defaultWebsiteRoomApiBase();
  const gameSlug = options.gameSlug ?? 'high-land';
  const pollMs = Math.max(1000, options.pollMs ?? 2000);
  const credentialProvider = options.credentialProvider ?? (() => getOrCreateWebsiteRoomCredential());

  return {
    createRoom(hostPlayer) {
      return postWebsiteRoomApi(apiBaseUrl, 'create-room.php', {
        game: gameSlug,
        maxPlayers: 10,
        playerId: hostPlayer.id,
        playerName: hostPlayer.name,
        token: hostPlayer.token,
        color: hostPlayer.color,
        credential: credentialProvider(),
        state: null
      });
    },

    joinRoom(roomCode, player) {
      return postWebsiteRoomApi(apiBaseUrl, 'join-room.php', {
        roomCode,
        playerId: player.id,
        playerName: player.name,
        token: player.token,
        color: player.color,
        credential: credentialProvider()
      });
    },

    updateGameState(roomCode, gameState, requestingPlayerId) {
      return postWebsiteRoomApi(apiBaseUrl, 'update-room.php', {
        roomCode,
        playerId: requestingPlayerId,
        credential: credentialProvider(),
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
        credential: credentialProvider(),
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

export function getOrCreateWebsiteRoomCredential(storage: Storage | null = resolveCredentialStorage()): string {
  const saved = storage?.getItem(WEBSITE_ROOM_CREDENTIAL_KEY) ?? '';
  if (/^[a-f0-9]{64}$/i.test(saved)) {
    return saved;
  }

  const generated = generateWebsiteRoomCredential();
  storage?.setItem(WEBSITE_ROOM_CREDENTIAL_KEY, generated);
  return generated;
}

function resolveCredentialStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
