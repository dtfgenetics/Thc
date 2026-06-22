import { describe, expect, it } from 'vitest';
import { appendLocalRoomEvent, clearLocalRoomEvents, getLocalRoomEvents } from './localRoomEvents';
import type { HighLandGameEvent, HighLandGameEventName } from '../events/gameEvents';

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

function makeEvent(name: HighLandGameEventName): HighLandGameEvent {
  return {
    id: `event-${name}`,
    name,
    roomCode: 'ABCD23',
    playerId: null,
    payload: makePayload(name),
    createdAt: 'now'
  } as HighLandGameEvent;
}

function makePayload(name: HighLandGameEventName): Record<string, unknown> {
  if (name === 'room_created') return { roomCode: 'ABCD23', hostPlayerId: 'host-1' };
  if (name === 'player_joined') return { playerId: 'player-2', playerName: 'Player 2' };
  return {};
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
