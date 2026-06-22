import { createLocalRoom, joinLocalRoom, type LocalRoomPlayerInput } from './localRoomRepository';
import { getLocalRoom, saveLocalRoom } from './localRoomStorage';
import { appendLocalRoomEvent } from './localRoomEvents';
import type { HighLandRoomPlayer, HighLandRoomState } from './roomState';
import type { RoomTransport, RoomTransportSnapshot } from './roomTransport';
import type { GameState } from '../types/gameTypes';

export function createLocalRoomTransport(storage: Storage = window.localStorage): RoomTransport {
  return {
    async createRoom(hostPlayer) {
      return createLocalRoom(toLocalRoomPlayerInput(hostPlayer), storage);
    },

    async joinRoom(roomCode, player) {
      return joinLocalRoom(roomCode, toLocalRoomPlayerInput(player), storage);
    },

    async updateGameState(roomCode, gameState) {
      const room = getLocalRoom(roomCode, storage);
      if (!room) throw new Error(`Room ${roomCode} was not found.`);

      const updatedRoom: HighLandRoomState = {
        ...room,
        status: gameState.winnerId ? 'complete' : 'playing',
        gameState,
        updatedAt: new Date().toISOString()
      };
      saveLocalRoom(updatedRoom, storage);
      return updatedRoom;
    },

    async appendEvent(roomCode, event) {
      appendLocalRoomEvent(roomCode, event, storage);
    },

    subscribe(roomCode, onSnapshot) {
      onSnapshot(createLocalRoomSnapshot(roomCode, storage));
      return () => undefined;
    }
  };
}

export function createLocalRoomSnapshot(roomCode: string, storage: Storage = window.localStorage): RoomTransportSnapshot {
  const room = getLocalRoom(roomCode, storage);
  if (!room) {
    return {
      status: 'error',
      room: null,
      error: `Room ${roomCode} was not found.`
    };
  }

  return {
    status: 'connected',
    room,
    error: null
  };
}

function toLocalRoomPlayerInput(player: HighLandRoomPlayer): LocalRoomPlayerInput {
  return {
    id: player.id,
    name: player.name,
    token: player.token,
    color: player.color
  };
}
