import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryRoomStore } from '../storage/RoomStore.js';
import { RoomService, RoomServiceError } from './RoomService.js';

function createService(random: () => number = () => 0.4): RoomService {
  return new RoomService(new MemoryRoomStore(), random, () => new Date('2026-07-10T12:00:00.000Z'));
}

test('host and guest can ready, start, and roll through authoritative state', () => {
  const service = createService();
  const host = service.createRoom({ playerName: 'Host', token: 'tokenA', maxPlayers: 10 });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: 'Guest', token: 'tokenB' });

  let room = service.setReady(host.room.code, true, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: guest.room.version
  });
  room = service.setReady(host.room.code, true, {
    playerId: guest.playerId,
    reconnectToken: guest.reconnectToken,
    expectedVersion: room.version
  });
  room = service.startGame(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: room.version
  });

  assert.equal(room.status, 'playing');
  assert.equal(room.gameState?.players.length, 2);
  assert.equal(room.gameState?.players[0]?.positionIndex, 0);

  room = service.rollDice(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: room.version,
    actionId: 'roll-1'
  });

  assert.equal(room.gameState?.lastRoll, 3);
  assert.equal(room.gameState?.players[0]?.positionIndex, 3);
  assert.deepEqual(room.gameState?.lastMove?.traversedIndexes, [1, 2, 3]);
  assert.equal(room.gameState?.currentPlayerIndex, 1);
});

test('duplicate action IDs are idempotent even when the caller retries an old version', () => {
  const service = createService(() => 0);
  const host = service.createRoom({ playerName: 'Host' });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: 'Guest' });
  let room = service.setReady(host.room.code, true, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: guest.room.version
  });
  room = service.setReady(host.room.code, true, {
    playerId: guest.playerId,
    reconnectToken: guest.reconnectToken,
    expectedVersion: room.version
  });
  room = service.startGame(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: room.version
  });
  const preRollVersion = room.version;
  const first = service.rollDice(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: preRollVersion,
    actionId: 'same-action'
  });
  const retry = service.rollDice(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: preRollVersion,
    actionId: 'same-action'
  });

  assert.equal(first.version, retry.version);
  assert.equal(retry.gameState?.players[0]?.positionIndex, 1);
});

test('out-of-turn, stale-version, and invalid-session mutations are rejected', () => {
  const service = createService();
  const host = service.createRoom({ playerName: 'Host' });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: 'Guest' });

  assert.throws(
    () =>
      service.setReady(host.room.code, true, {
        playerId: host.playerId,
        reconnectToken: host.reconnectToken,
        expectedVersion: host.room.version
      }),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'STALE_VERSION'
  );

  let room = service.setReady(host.room.code, true, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: guest.room.version
  });
  room = service.setReady(host.room.code, true, {
    playerId: guest.playerId,
    reconnectToken: guest.reconnectToken,
    expectedVersion: room.version
  });
  room = service.startGame(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: room.version
  });

  assert.throws(
    () =>
      service.rollDice(host.room.code, {
        playerId: guest.playerId,
        reconnectToken: guest.reconnectToken,
        expectedVersion: room.version,
        actionId: 'guest-roll'
      }),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'OUT_OF_TURN'
  );

  assert.throws(
    () => service.reconnect(host.room.code, host.playerId, 'wrong-token'),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'INVALID_SESSION'
  );
});

test('all players must be ready before the host can start', () => {
  const service = createService();
  const host = service.createRoom({ playerName: 'Host' });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: 'Guest' });
  const room = service.setReady(host.room.code, true, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: guest.room.version
  });

  assert.throws(
    () =>
      service.startGame(host.room.code, {
        playerId: host.playerId,
        reconnectToken: host.reconnectToken,
        expectedVersion: room.version
      }),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'PLAYERS_NOT_READY'
  );
});
