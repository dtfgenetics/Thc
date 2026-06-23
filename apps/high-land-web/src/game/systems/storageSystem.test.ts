import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishIndex } from '../data/boardPath';
import { createInitialGame } from './gameEngine';
import { clearSavedGameState, loadGameState, saveGameState } from './storageSystem';

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage system', () => {
  it('is safe when browser localStorage is unavailable', () => {
    expect(() => saveGameState(createInitialGame(2))).not.toThrow();
    expect(() => clearSavedGameState()).not.toThrow();
    expect(loadGameState()).toBeNull();
  });

  it('hydrates old saved players with safe fallback values', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    storage.setItem('high-land-save-v1', JSON.stringify({
      players: [{ name: 'Old One', positionIndex: -10 }, { name: 'Old Two', positionIndex: 9999 }],
      currentPlayerIndex: 99,
      turnDirection: 0,
      reverseTurnsRemaining: -3,
      cardCursor: -10
    }));

    const loaded = loadGameState();

    expect(loaded?.players.map((player) => player.id)).toEqual(['player-restored-1', 'player-restored-2']);
    expect(loaded?.players.map((player) => player.token)).toEqual(['tokenA', 'tokenB']);
    expect(loaded?.players.map((player) => player.color)).toEqual(['#f43f5e', '#22c55e']);
    expect(loaded?.players.map((player) => player.positionIndex)).toEqual([0, finishIndex]);
    expect(loaded?.currentPlayerIndex).toBe(1);
    expect(loaded?.turnDirection).toBe(1);
    expect(loaded?.reverseTurnsRemaining).toBe(0);
    expect(loaded?.cardCursor).toBe(0);
  });
});
