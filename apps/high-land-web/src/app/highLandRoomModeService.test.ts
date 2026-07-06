import { describe, expect, it } from 'vitest';
import {
  addLocalTestPlayerMode,
  createLocalRoomMode,
  createTransportRoomMode,
  joinLocalRoomMode,
  joinTransportRoomMode,
  startLocalRoomMode
} from './highLandRoomModeService';
import { createLocalRoomTransport } from '../game/multiplayer/localRoomTransport';

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

describe('High Land room mode service', () => {
  it('creates a local room mode result', () => {
    const storage = new MemoryStorage();
    const result = createLocalRoomMode('Room Host', 4, storage);

    expect(result.room.players[0].name).toBe('Room Host');
    expect(result.localPlayerName).toBe('Room Host');
    expect(result.inviteUrl).toContain(`room=${result.room.code}`);
    expect(result.playerCount).toBe(4);
  });

  it('joins an existing local room mode', () => {
    const storage = new MemoryStorage();
    const host = createLocalRoomMode('Room Host', 2, storage);
    const guest = joinLocalRoomMode(host.room.code, 'Guest Player', storage);

    expect(guest.room.players).toHaveLength(2);
    expect(guest.localPlayerName).toBe('Guest Player');
    expect(guest.localPlayerId).toBe('local-player-2');
  });

  it('assigns unique IDs to multiple local joiners', () => {
    const storage = new MemoryStorage();
    const host = createLocalRoomMode('Room Host', 3, storage);
    const guestOne = joinLocalRoomMode(host.room.code, 'Guest One', storage);
    const guestTwo = joinLocalRoomMode(host.room.code, 'Guest Two', storage);

    expect(guestOne.localPlayerId).toBe('local-player-2');
    expect(guestTwo.localPlayerId).toBe('local-player-3');
    expect(guestTwo.room.players.map((player) => player.id)).toEqual(['local-player-1', 'local-player-2', 'local-player-3']);
  });

  it('adds a local test player to a room', () => {
    const storage = new MemoryStorage();
    const host = createLocalRoomMode('Room Host', 2, storage);
    const updated = addLocalTestPlayerMode(host.room, storage);

    expect(updated.room.players).toHaveLength(2);
    expect(updated.room.players[1].name).toBe('Player 2');
  });

  it('starts a room mode game from room players', () => {
    const storage = new MemoryStorage();
    const roomResult = createLocalRoomMode('Room Host', 2, storage);
    const joinedRoom = joinLocalRoomMode(roomResult.room.code, 'Guest Player', storage);
    const startResult = startLocalRoomMode(joinedRoom.room);

    expect(startResult.playerCount).toBe(2);
    expect(startResult.gameState.players[0].name).toBe('Room Host');
    expect(startResult.gameState.players[1].name).toBe('Guest Player');
    expect(startResult.message).toBe('Room Host, roll to begin.');
  });

  it('creates and joins through a shared room transport with separate session identities', async () => {
    const roomStorage = new MemoryStorage();
    const hostSession = new MemoryStorage();
    const guestSession = new MemoryStorage();
    const transport = createLocalRoomTransport(roomStorage);

    const host = await createTransportRoomMode('Online Host', 2, transport, hostSession);
    const guest = await joinTransportRoomMode(host.room.code, 'Online Guest', transport, guestSession);

    expect(guest.room.players.map((player) => player.name)).toEqual(['Online Host', 'Online Guest']);
    expect(guest.localPlayerId).not.toBe(host.localPlayerId);
    expect(guest.inviteUrl).toContain(`room=${host.room.code}`);
  });
});
