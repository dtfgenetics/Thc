import { describe, expect, it } from 'vitest';
import { createLocalRoomTransport } from './localRoomTransport';
import { createLocalTestPlayer } from './localRoomFlow';
import { getLocalRoomEvents } from './localRoomEvents';
import { startRoomWithTransport, rollRoomWithTransport } from './roomActionExecutor';

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

describe('room action executor', () => {
  it('starts and rolls a local transport-backed room', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);

    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));
    const startedRoom = await startRoomWithTransport(joinedRoom, transport, 'local-player-1');
    const rolledRoom = await rollRoomWithTransport(startedRoom, transport, 'local-player-1', () => 0);

    expect(startedRoom.status).toBe('playing');
    expect(rolledRoom.gameState?.lastRoll).toBe(1);
    expect(getLocalRoomEvents(room.code, storage).map((event) => event.name)).toEqual(['game_started', 'dice_rolled']);
  });

  it('rejects starts from non-host players', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);

    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));

    await expect(startRoomWithTransport(joinedRoom, transport, 'local-player-2')).rejects.toThrow('Only the room host');
  });

  it('rejects rolls from non-current players', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);

    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));
    const startedRoom = await startRoomWithTransport(joinedRoom, transport, 'local-player-1');

    await expect(rollRoomWithTransport(startedRoom, transport, 'local-player-2', () => 0)).rejects.toThrow('not this player');
  });
});
