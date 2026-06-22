import type { HighLandGameEvent } from '../events/gameEvents';

const LOCAL_ROOM_EVENTS_KEY = 'high-land-local-room-events';

export type LocalRoomEventsByCode = Record<string, HighLandGameEvent[]>;

export function readLocalRoomEvents(storage?: Storage): LocalRoomEventsByCode {
  const targetStorage = requireLocalRoomEventStorage(storage);
  const raw = targetStorage.getItem(LOCAL_ROOM_EVENTS_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as LocalRoomEventsByCode;
  } catch {
    return {};
  }
}

export function appendLocalRoomEvent(roomCode: string, event: HighLandGameEvent, storage?: Storage): HighLandGameEvent[] {
  const targetStorage = requireLocalRoomEventStorage(storage);
  const eventsByRoom = readLocalRoomEvents(targetStorage);
  const roomEvents = eventsByRoom[roomCode] ?? [];
  const nextEvents = [...roomEvents, event];
  eventsByRoom[roomCode] = nextEvents;
  targetStorage.setItem(LOCAL_ROOM_EVENTS_KEY, JSON.stringify(eventsByRoom));
  return nextEvents;
}

export function getLocalRoomEvents(roomCode: string, storage?: Storage): HighLandGameEvent[] {
  return readLocalRoomEvents(storage)[roomCode] ?? [];
}

export function clearLocalRoomEvents(roomCode: string, storage?: Storage): void {
  const targetStorage = requireLocalRoomEventStorage(storage);
  const eventsByRoom = readLocalRoomEvents(targetStorage);
  delete eventsByRoom[roomCode];
  targetStorage.setItem(LOCAL_ROOM_EVENTS_KEY, JSON.stringify(eventsByRoom));
}

function requireLocalRoomEventStorage(storage?: Storage): Storage {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  throw new Error('Local room event storage is unavailable outside the browser. Pass a Storage implementation for tests.');
}
