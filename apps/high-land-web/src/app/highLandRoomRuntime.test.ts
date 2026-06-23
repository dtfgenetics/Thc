import { describe, expect, it } from 'vitest';
import { createLocalRoomTransport } from '../game/multiplayer/localRoomTransport';
import { createLocalTestPlayer } from '../game/multiplayer/localRoomFlow';
import { getLocalRoomEvents } from '../game/multiplayer/localRoomEvents';
import { startRoomRuntime, rollRoomRuntime } from './highLandRoomRuntime';

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

describe('High Land room runtime', () => {
  it('starts and rolls through local room transport', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);
    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));

    const started = await startRoomRuntime(joinedRoom, transport);
    const rolled = await rollRoomRuntime(started.room, 'local-player-1', transport, () => 0);

    expect(started.room.status).toBe('playing');
    expect(rolled.room.gameState?.lastRoll).toBe(1);
    expect(getLocalRoomEvents(room.code, storage).map((event) => event.name)).toEqual(['game_started', 'dice_rolled']);
  });

  it('rejects room rolls from a player who does not have the current turn', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);
    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));
    const started = await startRoomRuntime(joinedRoom, transport);

    await expect(rollRoomRuntime(started.room, 'local-player-2', transport, () => 0)).rejects.toThrow('not this player');
  });
});
