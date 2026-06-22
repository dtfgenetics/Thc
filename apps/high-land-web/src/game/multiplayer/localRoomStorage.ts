import type { HighLandRoomState } from './roomState';

const LOCAL_ROOM_STORAGE_KEY = 'high-land-local-rooms';

export function readLocalRooms(storage?: Storage): Record<string, HighLandRoomState> {
  const targetStorage = requireLocalRoomStorage(storage);
  const raw = targetStorage.getItem(LOCAL_ROOM_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, HighLandRoomState>;
  } catch {
    return {};
  }
}

export function writeLocalRooms(rooms: Record<string, HighLandRoomState>, storage?: Storage): void {
  requireLocalRoomStorage(storage).setItem(LOCAL_ROOM_STORAGE_KEY, JSON.stringify(rooms));
}

export function saveLocalRoom(room: HighLandRoomState, storage?: Storage): void {
  const rooms = readLocalRooms(storage);
  rooms[room.code] = room;
  writeLocalRooms(rooms, storage);
}

export function getLocalRoom(roomCode: string, storage?: Storage): HighLandRoomState | null {
  return readLocalRooms(storage)[roomCode] ?? null;
}

export function clearLocalRoom(roomCode: string, storage?: Storage): void {
  const rooms = readLocalRooms(storage);
  delete rooms[roomCode];
  writeLocalRooms(rooms, storage);
}

function requireLocalRoomStorage(storage?: Storage): Storage {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  throw new Error('Local room storage is unavailable outside the browser. Pass a Storage implementation for tests.');
}
