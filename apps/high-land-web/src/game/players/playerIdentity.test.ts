import { describe, expect, it } from 'vitest';
import { createLocalPlayerIdentity, validatePlayerName } from './playerIdentity';

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

describe('player identity', () => {
  it('trims player names and rejects empty names', () => {
    expect(validatePlayerName('  Blaze Runner  ')).toMatchObject({ valid: true, value: 'Blaze Runner' });
    expect(validatePlayerName(' ')).toMatchObject({ valid: false });
  });

  it('creates stable local player ids with provided storage', () => {
    const storage = new MemoryStorage();
    const first = createLocalPlayerIdentity('Player One', 0, storage);
    const second = createLocalPlayerIdentity('Player One', 1, storage);

    expect(first.id).toBe(second.id);
    expect(first.token).toBe('tokenA');
    expect(second.token).toBe('tokenB');
  });
});
