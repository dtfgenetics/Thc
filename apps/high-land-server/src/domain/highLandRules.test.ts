import assert from 'node:assert/strict';
import test from 'node:test';
import { HIGH_LAND_ACTION_SPACE_INDEXES, HIGH_LAND_SPACE_COLORS } from './highLandBoard.js';
import { HIGH_LAND_HIT_CARDS } from './highLandCards.js';
import { applyHighLandCard, rollHighLandTurn } from './highLandRules.js';
import { HIGH_LAND_FINISH_INDEX, type AuthoritativeGameState } from './roomTypes.js';

function state(playerCount = 2): AuthoritativeGameState {
  return {
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      token: `token${String.fromCharCode(65 + index)}`,
      color: '#22c55e',
      positionIndex: 0,
      skipTurns: 0,
      protectedFromBackward: 0
    })),
    currentPlayerIndex: 0,
    phase: 'ready',
    turnDirection: 1,
    reverseTurnsRemaining: 0,
    lastRoll: null,
    lastMove: null,
    lastCard: null,
    message: 'Ready.',
    winnerId: null,
    cardCursor: 0
  };
}

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

test('authoritative metadata matches the approved board and card deck', () => {
  assert.equal(HIGH_LAND_SPACE_COLORS.length, 109);
  assert.equal(HIGH_LAND_ACTION_SPACE_INDEXES.size, 22);
  assert.equal(HIGH_LAND_HIT_CARDS.length, 39);
  assert.equal(HIGH_LAND_FINISH_INDEX, 108);
});

test('landing on HIT draws and resolves a card on the server', () => {
  const result = rollHighLandTurn(state(), sequence([0.2, 0]));

  assert.equal(result.lastRoll, 2);
  assert.equal(result.lastMove?.toIndex, 2);
  assert.equal(result.lastCard?.id, 'card-001');
  assert.equal(result.players[0]?.positionIndex, 5);
  assert.equal(result.currentPlayerIndex, 1);
  assert.equal(result.cardCursor, 1);
});

test('backward protection is consumed instead of moving the player backward', () => {
  const initial = state();
  initial.players[0]!.positionIndex = 10;
  const protectedState = applyHighLandCard(initial, HIGH_LAND_HIT_CARDS[26]!, () => 0);
  protectedState.currentPlayerIndex = 0;
  const afterBackwardCard = applyHighLandCard(protectedState, HIGH_LAND_HIT_CARDS[5]!, () => 0);

  assert.equal(afterBackwardCard.players[0]?.positionIndex, 10);
  assert.equal(afterBackwardCard.players[0]?.protectedFromBackward, 0);
});

test('draw-again cards chain through the authoritative deck', () => {
  const initial = state();
  const result = applyHighLandCard(initial, HIGH_LAND_HIT_CARDS[38]!, sequence([0]));

  assert.equal(result.lastCard?.id, 'card-001');
  assert.equal(result.players[0]?.positionIndex, 3);
  assert.equal(result.cardCursor, 1);
  assert.equal(result.currentPlayerIndex, 1);
});

test('reverse rotation selects the prior player for one round', () => {
  const initial = state(3);
  initial.currentPlayerIndex = 1;
  const reversed = applyHighLandCard(initial, HIGH_LAND_HIT_CARDS[22]!, () => 0);

  assert.equal(reversed.turnDirection, -1);
  assert.equal(reversed.currentPlayerIndex, 0);
  assert.equal(reversed.reverseTurnsRemaining, 1);

  const afterNextTurn = rollHighLandTurn(reversed, () => 0);
  assert.equal(afterNextTurn.turnDirection, 1);
  assert.equal(afterNextTurn.reverseTurnsRemaining, 0);
  assert.equal(afterNextTurn.currentPlayerIndex, 1);
});

test('reaching board index 108 completes the game', () => {
  const initial = state();
  initial.players[0]!.positionIndex = HIGH_LAND_FINISH_INDEX - 1;
  const result = rollHighLandTurn(initial, () => 0);

  assert.equal(result.players[0]?.positionIndex, HIGH_LAND_FINISH_INDEX);
  assert.equal(result.winnerId, 'player-1');
  assert.equal(result.phase, 'game_over');
});
