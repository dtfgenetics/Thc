import { describe, expect, it } from 'vitest';
import { actionSpaceIndexes, boardPath, finishIndex } from '../data/boardPath';
import { createInitialGame, rollCurrentTurn } from './gameEngine';
import { rollDie, isValidDieRoll } from './diceSystem';
import { calculateMove } from './movementSystem';
import { applyActionCard } from './cardSystem';
import type { ActionCard } from '../types/gameTypes';
import { resolvePendingPlayerChoice } from './effectResolver';

describe('dice system', () => {
  it('rolls from 1 to 6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999)).toBe(6);
    expect(isValidDieRoll(1)).toBe(true);
    expect(isValidDieRoll(6)).toBe(true);
    expect(isValidDieRoll(0)).toBe(false);
    expect(isValidDieRoll(7)).toBe(false);
  });
});

describe('movement system', () => {
  it('clamps movement at start and finish', () => {
    expect(calculateMove(0, -4, finishIndex).toIndex).toBe(0);
    expect(calculateMove(finishIndex - 1, 10, finishIndex).toIndex).toBe(finishIndex);
  });

  it('returns each traversed index', () => {
    expect(calculateMove(2, 3, finishIndex).traversedIndexes).toEqual([3, 4, 5]);
    expect(calculateMove(5, -2, finishIndex).traversedIndexes).toEqual([4, 3]);
  });
});

describe('board path', () => {
  it('has continuous indexes and coordinates', () => {
    boardPath.forEach((space, index) => {
      expect(space.index).toBe(index);
      expect(Number.isFinite(space.x)).toBe(true);
      expect(Number.isFinite(space.y)).toBe(true);
    });
  });

  it('is one ordered route with no disconnected spaces', () => {
    expect(boardPath).toHaveLength(111);
    for (let index = 1; index < boardPath.length; index += 1) {
      const previous = boardPath[index - 1];
      const current = boardPath[index];
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100);
    }
  });

  it('uses only the real High Land board space types', () => {
    const actualTypes = new Set(boardPath.map((space) => space.type));
    expect(actualTypes).toEqual(new Set(['start', 'normal', 'action', 'finish']));
  });

  it('maps the gameplay HIT spaces across the full route', () => {
    const hitIndexes = boardPath.filter((space) => space.type === 'action').map((space) => space.index);
    expect(hitIndexes).toEqual([...actionSpaceIndexes]);
    expect(hitIndexes).toHaveLength(25);
    expect(hitIndexes).toEqual(expect.arrayContaining([27, 70, 83, 96]));
  });

  it('keeps all seven approved locations in order', () => {
    const zones = boardPath.map((space) => space.zone).filter((zone, index, all) => zone !== all[index - 1]);
    expect(zones).toEqual([
      'Rolling Hills',
      'Dankwood Forest',
      'Rosin Rail Station',
      'Munchie Mountain',
      'Kief Caves',
      'Trichome Towers',
      'Cloud 9 Citadel'
    ]);
  });

  it('has start and finish spaces', () => {
    expect(boardPath[0].type).toBe('start');
    expect(boardPath[finishIndex].type).toBe('finish');
  });
});

describe('game engine', () => {
  it('creates 1 to 10 player games', () => {
    expect(createInitialGame(1).players).toHaveLength(1);
    expect(createInitialGame(2).players).toHaveLength(2);
    expect(createInitialGame(4).players).toHaveLength(4);
    expect(createInitialGame(10).players).toHaveLength(10);
  });

  it('rejects invalid player counts', () => {
    expect(() => createInitialGame(0)).toThrow();
    expect(() => createInitialGame(11)).toThrow();
  });

  it('uses entered names and numbered fallbacks', () => {
    const state = createInitialGame(3, ['GreenBean', '', '  Mango Mike  ']);
    expect(state.players.map((player) => player.name)).toEqual(['GreenBean', 'Player 2', 'Mango Mike']);
  });

  it('rolls, moves, and advances turns', () => {
    const state = createInitialGame(2);
    const next = rollCurrentTurn(state, () => 0);
    expect(next.lastRoll).toBe(1);
    expect(next.players[0].positionIndex).toBe(1);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('declares a winner at the final index', () => {
    const state = createInitialGame(2);
    const nearFinish = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0 ? { ...player, positionIndex: finishIndex - 1 } : player
      )
    };
    const next = rollCurrentTurn(nearFinish, () => 0);
    expect(next.phase).toBe('game_over');
    expect(next.winnerId).toBe('player-1');
  });

  it('applies forward and backward card movement', () => {
    const state = createInitialGame(2);
    const forwardCard: ActionCard = {
      id: 'test-forward',
      title: 'Forward',
      text: 'Move ahead.',
      effect: { type: 'move', amount: 4 }
    };
    const backwardCard: ActionCard = {
      id: 'test-backward',
      title: 'Backward',
      text: 'Move back.',
      effect: { type: 'move', amount: -2 }
    };
    const afterForward = applyActionCard(state, forwardCard);
    expect(afterForward.players[0].positionIndex).toBe(4);
    const afterBackward = applyActionCard({ ...afterForward, currentPlayerIndex: 0 }, backwardCard);
    expect(afterBackward.players[0].positionIndex).toBe(2);
  });

  it('keeps the same player active after a roll-again card', () => {
    const state = createInitialGame(3);
    const card: ActionCard = {
      id: 'test-roll-again',
      title: 'Roll Again',
      text: 'Roll again.',
      effect: { type: 'roll_again' }
    };

    const next = applyActionCard(state, card);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.players[0].positionIndex).toBe(0);
    expect(next.phase).toBe('ready');
  });

  it('moves and keeps the same player active after a move-and-roll-again card', () => {
    const state = createInitialGame(3);
    const card: ActionCard = {
      id: 'test-move-roll-again',
      title: 'Move and Roll Again',
      text: 'Move, then roll again.',
      effect: { type: 'move_and_roll_again', amount: 2 }
    };

    const next = applyActionCard(state, card);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.players[0].positionIndex).toBe(2);
    expect(next.phase).toBe('ready');
  });

  it('applies skip turns', () => {
    const state = createInitialGame(2);
    const skipCard: ActionCard = {
      id: 'test-skip',
      title: 'Skip',
      text: 'Skip next turn.',
      effect: { type: 'skip_turns', amount: 1 }
    };
    const next = applyActionCard(state, skipCard);
    expect(next.players[0].skipTurns).toBe(1);
  });

  it('protects from backward movement once', () => {
    const state = createInitialGame(2);
    const protectCard: ActionCard = {
      id: 'test-protect',
      title: 'Protect',
      text: 'Block backward movement.',
      effect: { type: 'protect_from_backward', uses: 1 }
    };
    const backwardCard: ActionCard = {
      id: 'test-backward-protected',
      title: 'Backward',
      text: 'Move back.',
      effect: { type: 'move', amount: -3 }
    };
    const advanced = {
      ...state,
      players: state.players.map((player, index) => index === 0 ? { ...player, positionIndex: 8 } : player)
    };
    const protectedState = applyActionCard(advanced, protectCard);
    const afterBackward = applyActionCard({ ...protectedState, currentPlayerIndex: 0 }, backwardCard);
    expect(afterBackward.players[0].positionIndex).toBe(8);
    expect(afterBackward.players[0].protectedFromBackward).toBe(0);
  });

  it('supports moving to the next matching color', () => {
    const state = createInitialGame(2);
    const colorCard: ActionCard = {
      id: 'test-color',
      title: 'Color Move',
      text: 'Move to next green.',
      effect: { type: 'move_to_color', color: 'green', direction: 'next' }
    };
    const next = applyActionCard(state, colorCard);
    expect(boardPath[next.players[0].positionIndex].color).toBe('green');
  });

  it('supports reverse turn order', () => {
    const state = createInitialGame(3);
    const reverseCard: ActionCard = {
      id: 'test-reverse',
      title: 'Reverse',
      text: 'Reverse turns.',
      effect: { type: 'reverse_turn_order', turns: 2 }
    };
    const reversed = applyActionCard(state, reverseCard);
    expect(reversed.turnDirection).toBe(-1);
    expect(reversed.reverseTurnsRemaining).toBe(2);
    expect(reversed.currentPlayerIndex).toBe(2);
    const next = rollCurrentTurn(reversed, () => 0);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.reverseTurnsRemaining).toBe(1);
  });

  it('makes every other player skip after Hot Box', () => {
    const state = createInitialGame(4);
    const card: ActionCard = {
      id: 'test-hot-box',
      title: 'Hot Box',
      text: 'Other players skip.',
      effect: { type: 'skip_others', amount: 1 }
    };

    const next = applyActionCard(state, card);
    expect(next.players.map((player) => player.skipTurns)).toEqual([0, 1, 1, 1]);
  });

  it('pauses for a chosen player and then advances the turn', () => {
    const state = createInitialGame(3);
    const card: ActionCard = {
      id: 'test-friend-boost',
      title: 'Friend Boost',
      text: 'Move together.',
      effect: { type: 'choose_player_move', currentAmount: 2, targetAmount: 2 }
    };

    const choosing = applyActionCard(state, card);
    expect(choosing.phase).toBe('choosing_player');
    expect(choosing.players[0].positionIndex).toBe(2);
    expect(choosing.currentPlayerIndex).toBe(0);

    const resolved = resolvePendingPlayerChoice(choosing, 'player-3');
    expect(resolved.phase).toBe('ready');
    expect(resolved.players[2].positionIndex).toBe(2);
    expect(resolved.currentPlayerIndex).toBe(1);
  });
});
