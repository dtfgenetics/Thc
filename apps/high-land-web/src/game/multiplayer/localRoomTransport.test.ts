import { describe, expect, it } from 'vitest';
import { createInitialGame } from '../systems/gameEngine';
import { createLocalTestPlayer } from './localRoomFlow';
import { getLocalRoomEvents } from './localRoomEvents';
import { createLocalRoomTransport, createLocalRoomSnapshot } from './localRoomTransport';
import type { RoomCreatedEvent } from '../events/gameEvents';

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

function makeRoomCreatedEvent(roomCode: string): RoomCreatedEvent {
  return {
    id: 'event-1',
    name: 'room_created',
    roomCode,
    playerId: 'local-player-1',
    createdAt: 'now',
    payload: { roomCode, hostPlayerId: 'local-player-1' }
  };
}

describe('local room transport', () => {
  it('creates, joins, updates, and snapshots a room', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);

    const room = await transport.createRoom(makeTransportPlayer(0, true));
    const joinedRoom = await transport.joinRoom(room.code, makeTransportPlayer(1));
    const updatedRoom = await transport.updateGameState(room.code, createInitialGame(2), 'local-player-1');
    const snapshot = createLocalRoomSnapshot(room.code, storage);

    expect(joinedRoom.players).toHaveLength(2);
    expect(updatedRoom.status).toBe('playing');
    expect(updatedRoom.gameState?.players).toHaveLength(2);
    expect(snapshot.status).toBe('connected');
    expect(snapshot.room?.code).toBe(room.code);
  });

  it('rejects stale state writes after joining and preserves the latest committed turn', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);
    const created = await transport.createRoom(makeTransportPlayer(0, true));
    const joined = await transport.joinRoom(created.code, makeTransportPlayer(1));
    expect(created.stateRevision).toBe(0);
    expect(joined.stateRevision).toBe(1);

    const state = createInitialGame(2);
    await expect(transport.updateGameState(created.code, state, 'local-player-1', 0))
      .rejects.toThrow('Stale room state revision');
    const committed = await transport.updateGameState(created.code, state, 'local-player-1', 1);
    expect(committed.stateRevision).toBe(2);

    await expect(transport.updateGameState(created.code, state, 'local-player-1', 1))
      .rejects.toThrow('Stale room state revision');
    expect(createLocalRoomSnapshot(created.code, storage).room?.stateRevision).toBe(2);
  });

  it('commits only one update from competing clients on the same revision', async () => {
    const storage = new MemoryStorage();
    const firstClient = createLocalRoomTransport(storage);
    const secondClient = createLocalRoomTransport(storage);
    const room = await firstClient.createRoom(makeTransportPlayer(0, true));
    const joined = await secondClient.joinRoom(room.code, makeTransportPlayer(1));
    const revision = joined.stateRevision ?? 0;

    const firstState = createInitialGame(2);
    firstState.message = 'First action';
    const secondState = createInitialGame(2);
    secondState.message = 'Second action';

    const results = await Promise.allSettled([
      firstClient.updateGameState(room.code, firstState, 'local-player-1', revision),
      secondClient.updateGameState(room.code, secondState, 'local-player-1', revision)
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(createLocalRoomSnapshot(room.code, storage).room).toMatchObject({
      stateRevision: revision + 1,
      gameState: { message: 'First action' }
    });
  });

  it('stores room events', async () => {
    const storage = new MemoryStorage();
    const transport = createLocalRoomTransport(storage);
    const room = await transport.createRoom(makeTransportPlayer(0, true));

    await transport.appendEvent(room.code, makeRoomCreatedEvent(room.code));

    expect(getLocalRoomEvents(room.code, storage)).toHaveLength(1);
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
