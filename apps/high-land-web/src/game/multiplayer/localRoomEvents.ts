import type { HighLandGameEvent } from '../events/gameEvents';

const LOCAL_ROOM_EVENTS_KEY = 'high-land-local-room-events';

export type LocalRoomEventsByCode = Record<string, HighLandGameEvent[]>;

export function readLocalRoomEvents(storage: Storage = window.localStorage): LocalRoomEventsByCode {
  const raw = storage.getItem(LOCAL_ROOM_EVENTS_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as LocalRoomEventsByCode;
  } catch {
    return {};
  }
}

export function appendLocalRoomEvent(roomCode: string, event: HighLandGameEvent, storage: Storage = window.localStorage): HighLandGameEvent[] {
  const eventsByRoom = readLocalRoomEvents(storage);
  const roomEvents = eventsByRoom[roomCode] ?? [];
  const nextEvents = [...roomEvents, event];
  eventsByRoom[roomCode] = nextEvents;
  storage.setItem(LOCAL_ROOM_EVENTS_KEY, JSON.stringify(eventsByRoom));
  return nextEvents;
}

export function getLocalRoomEvents(roomCode: string, storage: Storage = window.localStorage): HighLandGameEvent[] {
  return readLocalRoomEvents(storage)[roomCode] ?? [];
}

export function clearLocalRoomEvents(roomCode: string, storage: Storage = window.localStorage): void {
  const eventsByRoom = readLocalRoomEvents(storage);
  delete eventsByRoom[roomCode];
  storage.setItem(LOCAL_ROOM_EVENTS_KEY, JSON.stringify(eventsByRoom));
}
