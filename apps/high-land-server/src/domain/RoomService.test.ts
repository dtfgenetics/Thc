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

test('authoritative rooms reject blank or too-short player names', () => {
  const service = createService();

  assert.throws(
    () => service.createRoom({ playerName: '   ' }),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'PLAYER_NAME_REQUIRED' && error.status === 400
  );

  assert.throws(
    () => service.createRoom({ playerName: 'A' }),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'PLAYER_NAME_REQUIRED' && error.status === 400
  );

  const host = service.createRoom({ playerName: 'Host' });
  assert.throws(
    () => service.joinRoom({ roomCode: host.room.code, playerName: '' }),
    (error: unknown) => error instanceof RoomServiceError && error.code === 'PLAYER_NAME_REQUIRED' && error.status === 400
  );
});

test('authoritative rooms normalize player name whitespace and strip simple markup', () => {
  const service = createService();
  const host = service.createRoom({ playerName: '  <b>Mango</b>    Mike  ' });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: '  Blue    Dreamer  ' });

  assert.equal(host.room.players[0]?.name, 'Mango Mike');
  assert.equal(guest.room.players[1]?.name, 'Blue Dreamer');
});

test('a guest who leaves the lobby is removed instead of becoming a ghost player', () => {
  const service = createService();
  const host = service.createRoom({ playerName: 'Host' });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: 'Guest' });

  const room = service.leaveRoom(host.room.code, {
    playerId: guest.playerId,
    reconnectToken: guest.reconnectToken,
    expectedVersion: guest.room.version
  });

  assert.equal(room.status, 'waiting');
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0]?.id, host.playerId);
  assert.equal(room.hostPlayerId, host.playerId);
});

test('host ownership transfers when the host leaves a waiting lobby', () => {
  const service = createService();
  const host = service.createRoom({ playerName: 'Host' });
  const guest = service.joinRoom({ roomCode: host.room.code, playerName: 'Guest' });

  const room = service.leaveRoom(host.room.code, {
    playerId: host.playerId,
    reconnectToken: host.reconnectToken,
    expectedVersion: guest.room.version
  });

  assert.equal(room.status, 'waiting');
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0]?.id, guest.playerId);
  assert.equal(room.players[0]?.host, true);
  assert.equal(room.hostPlayerId, guest.playerId);
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
