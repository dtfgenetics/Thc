import { createRoomCode, requireValidRoomCode } from './roomCodes';
import { getLocalRoom, saveLocalRoom } from './localRoomStorage';
import { upsertRoomPlayer, type HighLandRoomPlayer, type HighLandRoomState } from './roomState';

export type LocalRoomPlayerInput = Omit<HighLandRoomPlayer, 'joinedAt' | 'connected' | 'host'>;

export function createLocalRoom(hostPlayer: LocalRoomPlayerInput, storage?: Storage, roomCode?: string): HighLandRoomState {
  const code = roomCode ? requireValidRoomCode(roomCode) : createUniqueRoomCode(storage);
  if (getLocalRoom(code, storage)) {
    throw new Error(`Room ${code} already exists in local storage.`);
  }

  const now = new Date().toISOString();
  const roomHost: HighLandRoomPlayer = {
    ...hostPlayer,
    joinedAt: now,
    connected: true,
    host: true
  };

  const room: HighLandRoomState = {
    id: `local_room_${code.toLowerCase()}`,
    code,
    status: 'waiting',
    hostPlayerId: roomHost.id,
    players: [roomHost],
    gameState: null,
    createdAt: now,
    updatedAt: now
  };

  saveLocalRoom(room, storage);
  return room;
}

export function joinLocalRoom(roomCode: string, player: LocalRoomPlayerInput, storage?: Storage): HighLandRoomState {
  const code = requireValidRoomCode(roomCode);
  const room = getLocalRoom(code, storage);
  if (!room) {
    throw new Error(`Room ${code} was not found in local storage.`);
  }

  const joinedPlayer: HighLandRoomPlayer = {
    ...player,
    joinedAt: new Date().toISOString(),
    connected: true,
    host: false
  };

  const updatedRoom = upsertRoomPlayer(room, joinedPlayer);
  saveLocalRoom(updatedRoom, storage);
  return updatedRoom;
}

function createUniqueRoomCode(storage?: Storage): string {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = createRoomCode();
    if (!getLocalRoom(code, storage)) return code;
  }

  throw new Error('Could not create a unique local room code.');
}
