import { describe, expect, it } from 'vitest';
import { createInitialGame } from '../systems/gameEngine';
import { createLocalTestPlayer } from './localRoomFlow';
import { createLocalRoomTransport, createLocalRoomSnapshot } from './localRoomTransport';

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

function makeTransportPlayer(index: number, host = false) {
  return {
    ...createLocalTestPlayer(index),
    joinedAt: 'now',
    connected: true,
    host
  };
}

describe('local room transport', () => {
  it('creates, joins, updates, and snapshots a room', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);

    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));
    const updatedRoom = await transport.updateGameState(room.code, createInitialGame(2));
    const snapshot = createLocalRoomSnapshot(room.code, storage);

    expect(joinedRoom.players).toHaveLength(2);
    expect(updatedRoom.gameState?.players).toHaveLength(2);
    expect(snapshot.status).toBe('connected');
    expect(snapshot.room?.code).toBe(room.code);
  });

  it('subscribes with an immediate snapshot', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);
    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const statuses: string[] = [];

    const unsubscribe = transport.subscribe(room.code, (snapshot) => statuses.push(snapshot.status));
    unsubscribe();

    expect(statuses).toEqual(['connected']);
  });
});
