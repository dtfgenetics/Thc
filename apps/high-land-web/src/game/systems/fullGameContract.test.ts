import { describe, expect, it } from 'vitest';
import { finishIndex } from '../data/boardPath';
import type { GameState } from '../types/gameTypes';
import { resolvePendingPlayerChoice } from './effectResolver';
import { createInitialGame, rollCurrentTurn } from './gameEngine';

function seededRandom(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x1_0000_0000;
  };
}

function resolveChoiceDeterministically(state: GameState): GameState {
  const choice = state.pendingChoice;
  if (!choice || state.phase !== 'choosing_player') return state;
  const target = state.players.find((player) => player.id !== choice.sourcePlayerId);
  if (!target) throw new Error('A pending player choice did not expose a valid target.');
  const resolved = resolvePendingPlayerChoice(state, target.id);
  if (resolved === state) throw new Error('A valid pending player choice did not resolve.');
  return resolved;
}

function playCompleteGame(playerCount: number, seed: number, turnLimit = 2500): { state: GameState; turns: number } {
  const random = seededRandom(seed);
  let state = createInitialGame(playerCount);
  let turns = 0;

  while (state.phase !== 'game_over' && turns < turnLimit) {
    expect(state.winnerId).toBeNull();
    expect(state.players).toHaveLength(playerCount);
    state.players.forEach((player) => {
      expect(player.positionIndex).toBeGreaterThanOrEqual(0);
      expect(player.positionIndex).toBeLessThanOrEqual(finishIndex);
      expect(player.skipTurns).toBeGreaterThanOrEqual(0);
      expect(player.protectedFromBackward).toBeGreaterThanOrEqual(0);
    });

    if (state.phase === 'choosing_player') {
      state = resolveChoiceDeterministically(state);
      continue;
    }

    expect(state.phase).toBe('ready');
    state = rollCurrentTurn(state, random);
    turns += 1;
  }

  if (state.phase !== 'game_over') {
    throw new Error(`High Land did not finish within ${turnLimit} turns for ${playerCount} players / seed ${seed}.`);
  }

  return { state, turns };
}

describe('complete High Land game contract', () => {
  it.each([
    [2, 1], [2, 7], [2, 23],
    [4, 3], [4, 11], [4, 29],
    [6, 5], [6, 19],
    [10, 13], [10, 31]
  ])('reaches a legitimate winner for %i players with seed %i', (playerCount, seed) => {
    const { state, turns } = playCompleteGame(playerCount, seed);
    const winner = state.players.find((player) => player.id === state.winnerId);

    expect(turns).toBeGreaterThan(0);
    expect(state.phase).toBe('game_over');
    expect(state.pendingChoice).toBeNull();
    expect(winner).toBeDefined();
    expect(winner?.positionIndex).toBe(finishIndex);
    expect(state.players.filter((player) => player.positionIndex >= finishIndex).length).toBeGreaterThanOrEqual(1);
  });

  it('never creates an impossible board position during long deterministic play', () => {
    const random = seededRandom(20260912);
    let state = createInitialGame(10);

    for (let turn = 0; turn < 750 && state.phase !== 'game_over'; turn += 1) {
      if (state.phase === 'choosing_player') state = resolveChoiceDeterministically(state);
      if (state.phase !== 'game_over') state = rollCurrentTurn(state, random);

      for (const player of state.players) {
        expect(Number.isInteger(player.positionIndex)).toBe(true);
        expect(player.positionIndex).toBeGreaterThanOrEqual(0);
        expect(player.positionIndex).toBeLessThanOrEqual(finishIndex);
      }
    }
  });
});
