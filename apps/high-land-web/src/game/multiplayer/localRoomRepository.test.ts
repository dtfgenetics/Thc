import { describe, expect, it } from 'vitest';
import { createLocalRoom, joinLocalRoom } from './localRoomRepository';

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

const hostPlayer = {
  id: 'host-1',
  name: 'Host Player',
  token: 'tokenA' as const,
  color: '#ef4444'
};

const joiningPlayer = {
  id: 'guest-1',
  name: 'Guest Player',
  token: 'tokenB' as const,
  color: '#22c55e'
};

describe('local room repository', () => {
  it('creates a local room with a host', () => {
    const storage = new MemoryStorage();
    const room = createLocalRoom(hostPlayer, storage, 'ABCD23');

    expect(room.code).toBe('ABCD23');
    expect(room.players).toHaveLength(1);
    expect(room.players[0].host).toBe(true);
  });

  it('rejects duplicate explicit room codes instead of overwriting rooms', () => {
    const storage = new MemoryStorage();
    createLocalRoom(hostPlayer, storage, 'ABCD23');

    expect(() => createLocalRoom({ ...hostPlayer, id: 'host-2' }, storage, 'ABCD23')).toThrow('Room ABCD23 already exists');
  });

  it('joins an existing local room', () => {
    const storage = new MemoryStorage();
    createLocalRoom(hostPlayer, storage, 'ABCD23');

    const room = joinLocalRoom('ABCD23', joiningPlayer, storage);

    expect(room.players).toHaveLength(2);
    expect(room.players[1].name).toBe('Guest Player');
    expect(room.players[1].host).toBe(false);
  });

  it('preserves the host flag when an existing host rejoins', () => {
    const storage = new MemoryStorage();
    createLocalRoom(hostPlayer, storage, 'ABCD23');

    const room = joinLocalRoom('ABCD23', { ...hostPlayer, name: 'Host Player Updated' }, storage);

    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe('Host Player Updated');
    expect(room.players[0].host).toBe(true);
  });
});
