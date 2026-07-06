import type { RoomTransport, RoomTransportSnapshot } from './roomTransport';
import type { HighLandGameEvent } from '../events/gameEvents';
import { defaultWebsiteRoomApiBase, getWebsiteRoomApi, postWebsiteRoomApi } from './websiteRoomApi';

export type WebsiteRoomTransportOptions = {
  apiBaseUrl?: string;
  gameSlug?: string;
  pollMs?: number;
};

export function createWebsiteRoomTransport(options: WebsiteRoomTransportOptions = {}): RoomTransport {
  const apiBaseUrl = options.apiBaseUrl ?? defaultWebsiteRoomApiBase();
  const gameSlug = options.gameSlug ?? 'high-land';
  const pollMs = Math.max(1000, options.pollMs ?? 2000);

  return {
    createRoom(hostPlayer) {
      return postWebsiteRoomApi(apiBaseUrl, 'create-room.php', {
        game: gameSlug,
        maxPlayers: 10,
        playerId: hostPlayer.id,
        playerName: hostPlayer.name,
        token: hostPlayer.token,
        color: hostPlayer.color,
        state: null
      });
    },

    joinRoom(roomCode, player) {
      return postWebsiteRoomApi(apiBaseUrl, 'join-room.php', {
        roomCode,
        playerId: player.id,
        playerName: player.name,
        token: player.token,
        color: player.color
      });
    },

    updateGameState(roomCode, gameState, requestingPlayerId) {
      return postWebsiteRoomApi(apiBaseUrl, 'update-room.php', {
        roomCode,
        playerId: requestingPlayerId,
        status: gameState.winnerId ? 'complete' : 'playing',
        state: gameState
      });
    },

    async appendEvent(roomCode, event) {
      await postWebsiteRoomApi(apiBaseUrl, 'append-event.php', {
        roomCode,
        playerId: event.playerId ?? 'system-event',
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

export function snapshotFromWebsiteRoom(snapshot: RoomTransportSnapshot): RoomTransportSnapshot {
  return snapshot;
}

export type WebsiteRoomEvent = HighLandGameEvent;
