import { describe, expect, it } from 'vitest';
import { appendLocalRoomEvent, clearLocalRoomEvents, getLocalRoomEvents } from './localRoomEvents';
import type { HighLandGameEvent } from '../events/gameEvents';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function makeEvent(name: string): HighLandGameEvent {
  return {
    id: `event-${name}`,
    type: name as HighLandGameEvent['type'],
    playerId: null,
    payload: {},
    createdAt: 'now'
  };
}

describe('local room events', () => {
  it('appends and reads events by room code', () => {
    const storage = new MemoryStorage();

    appendLocalRoomEvent('ABCD23', makeEvent('room_created'), storage);
    appendLocalRoomEvent('ABCD23', makeEvent('player_joined'), storage);

    expect(getLocalRoomEvents('ABCD23', storage)).toHaveLength(2);
    expect(getLocalRoomEvents('MISSING', storage)).toEqual([]);
  });

  it('clears events for a room', () => {
    const storage = new MemoryStorage();

    appendLocalRoomEvent('ABCD23', makeEvent('room_created'), storage);
    clearLocalRoomEvents('ABCD23', storage);

    expect(getLocalRoomEvents('ABCD23', storage)).toEqual([]);
  });
});
