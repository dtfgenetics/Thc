import { describe, expect, it } from 'vitest';
import { initialHighLandAppFlowState, reduceHighLandAppFlow } from './highLandAppFlow';
import type { HighLandRoomState } from '../game/multiplayer/roomState';

function makeRoom(): HighLandRoomState {
  return {
    id: 'room-1',
    code: 'ABCD23',
    status: 'waiting',
    hostPlayerId: 'player-1',
    players: [
      {
        id: 'player-1',
        name: 'Host',
        token: 'tokenA',
        color: '#f43f5e',
        joinedAt: 'now',
        connected: true,
        host: true
      }
    ],
    gameState: null,
    createdAt: 'now',
    updatedAt: 'now'
  };
}

describe('High Land app flow', () => {
  it('moves from landing to local setup', () => {
    const state = reduceHighLandAppFlow(initialHighLandAppFlowState, { type: 'choose_mode', mode: 'local' });

    expect(state.screenMode).toBe('local');
  });

  it('starts local gameplay with a named player', () => {
    const state = reduceHighLandAppFlow(initialHighLandAppFlowState, {
      type: 'local_game_started',
      playerName: 'Blaze Runner',
      playerCount: 4
    });

    expect(state.screenMode).toBe('playing');
    expect(state.localPlayerName).toBe('Blaze Runner');
    expect(state.statusMessage).toBe('Blaze Runner, roll to begin.');
  });

  it('moves created rooms into lobby state', () => {
    const room = makeRoom();
    const state = reduceHighLandAppFlow(initialHighLandAppFlowState, {
      type: 'room_created',
      playerName: 'Host',
      playerId: 'player-1',
      playerCount: 2,
      room
    });

    expect(state.screenMode).toBe('lobby');
    expect(state.room?.code).toBe('ABCD23');
  });

  it('returns to landing after leaving a room', () => {
    const state = reduceHighLandAppFlow({ ...initialHighLandAppFlowState, room: makeRoom(), screenMode: 'lobby' }, { type: 'room_left' });

    expect(state.screenMode).toBe('landing');
    expect(state.room).toBeNull();
    expect(state.statusMessage).toBe('Left the room. Choose a play mode.');
  });
});
