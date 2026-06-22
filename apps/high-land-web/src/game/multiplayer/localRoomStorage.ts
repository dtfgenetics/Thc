import type { HighLandRoomState } from './roomState';

const LOCAL_ROOM_STORAGE_KEY = 'high-land-local-rooms';

export function readLocalRooms(storage: Storage = window.localStorage): Record<string, HighLandRoomState> {
  const raw = storage.getItem(LOCAL_ROOM_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, HighLandRoomState>;
  } catch {
    return {};
  }
}

export function writeLocalRooms(rooms: Record<string, HighLandRoomState>, storage: Storage = window.localStorage): void {
  storage.setItem(LOCAL_ROOM_STORAGE_KEY, JSON.stringify(rooms));
}

export function saveLocalRoom(room: HighLandRoomState, storage: Storage = window.localStorage): void {
  const rooms = readLocalRooms(storage);
  rooms[room.code] = room;
  writeLocalRooms(rooms, storage);
}

export function getLocalRoom(roomCode: string, storage: Storage = window.localStorage): HighLandRoomState | null {
  return readLocalRooms(storage)[roomCode] ?? null;
}

export function clearLocalRoom(roomCode: string, storage: Storage = window.localStorage): void {
  const rooms = readLocalRooms(storage);
  delete rooms[roomCode];
  writeLocalRooms(rooms, storage);
}
