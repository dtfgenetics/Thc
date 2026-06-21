import type { RoomSnapshot } from './roomTypes';

export function mergeRoomSnapshot(current: RoomSnapshot | null, incoming: RoomSnapshot): RoomSnapshot {
  if (current && incoming.version < current.version) return current;
  if (current?.version === incoming.version) {
    return { ...incoming, gameState: current.gameState };
  }
  return incoming;
}
