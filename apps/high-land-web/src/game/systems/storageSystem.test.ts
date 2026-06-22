import { describe, expect, it } from 'vitest';
import { createInitialGame } from './gameEngine';
import { clearSavedGameState, loadGameState, saveGameState } from './storageSystem';

describe('storage system', () => {
  it('is safe when browser localStorage is unavailable', () => {
    expect(() => saveGameState(createInitialGame(2))).not.toThrow();
    expect(() => clearSavedGameState()).not.toThrow();
    expect(loadGameState()).toBeNull();
  });
});
