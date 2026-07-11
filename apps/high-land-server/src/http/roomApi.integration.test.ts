import assert from 'node:assert/strict';
import { type AddressInfo } from 'node:net';
import test from 'node:test';
import { RoomService } from '../domain/RoomService.js';
import { MemoryRoomStore } from '../storage/RoomStore.js';
import { createHttpApp } from './createHttpApp.js';

type Session = {
  playerId: string;
  reconnectToken: string;
};

type JsonObject = Record<string, unknown>;

test('health check identifies the deployed release and prevents stale caching', async (context) => {
  const previousReleaseSha = process.env.RELEASE_SHA;
  process.env.RELEASE_SHA = 'release-test-sha';
  context.after(() => {
    if (previousReleaseSha === undefined) {
      delete process.env.RELEASE_SHA;
    } else {
      process.env.RELEASE_SHA = previousReleaseSha;
    }
  });

  const service = new RoomService(new MemoryRoomStore());
  const server = createHttpApp(service).listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.ok, true);
  assert.equal(body.service, 'high-land-multiplayer');
  assert.equal(body.release, 'release-test-sha');
  assert.match(body.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('two independent clients can create, join, ready, start, roll, retry and reconnect', async (context) => {
  const values = [0.2, 0];
  const service = new RoomService(
    new MemoryRoomStore(),
    () => values.shift() ?? 0,
    () => new Date('2026-07-10T12:00:00.000Z')
  );
  const server = createHttpApp(service).listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const created = await request(baseUrl, '/rooms', {
    method: 'POST',
    body: { playerName: 'Host', token: 'tokenA', maxPlayers: 10 }
  });
  assert.equal(created.status, 201);
  const roomCode = String(created.body.room.code);
  const host: Session = {
    playerId: String(created.body.playerId),
    reconnectToken: String(created.body.reconnectToken)
  };
  assert.match(roomCode, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

  const joined = await request(baseUrl, `/rooms/${roomCode}/join`, {
    method: 'POST',
    body: { playerName: 'Guest', token: 'tokenB' }
  });
  assert.equal(joined.status, 201);
  const guest: Session = {
    playerId: String(joined.body.playerId),
    reconnectToken: String(joined.body.reconnectToken)
  };
  assert.equal((joined.body.room.players as unknown[]).length, 2);

  const invalidReady = await authenticatedRequest(baseUrl, roomCode, host, `/rooms/${roomCode}/ready`, {
    ready: 'false',
    expectedVersion: Number(joined.body.room.version)
  });
  assert.equal(invalidReady.status, 400);
  assert.equal(invalidReady.body.error.code, 'INVALID_INPUT');

  const hostReady = await authenticatedRequest(baseUrl, roomCode, host, `/rooms/${roomCode}/ready`, {
    ready: true,
    expectedVersion: Number(joined.body.room.version)
  });
  const guestReady = await authenticatedRequest(baseUrl, roomCode, guest, `/rooms/${roomCode}/ready`, {
    ready: true,
    expectedVersion: Number(hostReady.body.room.version)
  });
  const started = await authenticatedRequest(baseUrl, roomCode, host, `/rooms/${roomCode}/start`, {
    expectedVersion: Number(guestReady.body.room.version)
  });
  assert.equal(started.body.room.status, 'playing');

  const versionBeforeRoll = Number(started.body.room.version);
  const rolled = await authenticatedRequest(baseUrl, roomCode, host, `/rooms/${roomCode}/actions`, {
    type: 'ROLL_DICE',
    actionId: 'integration-roll-1',
    expectedVersion: versionBeforeRoll
  });
  assert.equal(rolled.body.room.gameState.lastRoll, 2);
  assert.equal(rolled.body.room.gameState.lastCard.id, 'card-001');
  assert.equal(rolled.body.room.gameState.players[0].positionIndex, 5);
  assert.equal(rolled.body.room.gameState.currentPlayerIndex, 1);

  const duplicate = await authenticatedRequest(baseUrl, roomCode, host, `/rooms/${roomCode}/actions`, {
    type: 'ROLL_DICE',
    actionId: 'integration-roll-1',
    expectedVersion: versionBeforeRoll
  });
  assert.equal(duplicate.body.room.version, rolled.body.room.version);
  assert.equal(duplicate.body.room.gameState.players[0].positionIndex, 5);

  const outOfTurn = await authenticatedRequest(baseUrl, roomCode, host, `/rooms/${roomCode}/actions`, {
    type: 'ROLL_DICE',
    actionId: 'integration-roll-2',
    expectedVersion: Number(rolled.body.room.version)
  });
  assert.equal(outOfTurn.status, 409);
  assert.equal(outOfTurn.body.error.code, 'OUT_OF_TURN');

  const invalidSession = await request(baseUrl, `/rooms/${roomCode}`, {
    method: 'GET',
    headers: {
      'X-Player-Id': host.playerId,
      'X-Session-Token': 'wrong-token'
    }
  });
  assert.equal(invalidSession.status, 401);
  assert.equal(invalidSession.body.error.code, 'INVALID_SESSION');

  const reconnected = await request(baseUrl, `/rooms/${roomCode}/reconnect`, {
    method: 'POST',
    body: {
      playerId: guest.playerId,
      reconnectToken: guest.reconnectToken
    }
  });
  assert.equal(reconnected.status, 200);
  assert.equal(reconnected.body.playerId, guest.playerId);
  assert.equal(reconnected.body.room.status, 'playing');
  assert.equal('reconnectToken' in reconnected.body, false);
});

test('create room rejects missing display names and invalid player limits', async (context) => {
  const service = new RoomService(new MemoryRoomStore());
  const server = createHttpApp(service).listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const missingName = await request(baseUrl, '/rooms', {
    method: 'POST',
    body: { playerName: '' }
  });
  assert.equal(missingName.status, 400);

  const invalidLimit = await request(baseUrl, '/rooms', {
    method: 'POST',
    body: { playerName: 'Host', maxPlayers: '10' }
  });
  assert.equal(invalidLimit.status, 400);
});

async function authenticatedRequest(
  baseUrl: string,
  roomCode: string,
  session: Session,
  path: string,
  body: JsonObject
): Promise<{ status: number; body: any }> {
  return request(baseUrl, path, {
    method: 'POST',
    body,
    headers: {
      'X-Player-Id': session.playerId,
      'X-Session-Token': session.reconnectToken,
      'X-Room-Code': roomCode
    }
  });
}

async function request(
  baseUrl: string,
  path: string,
  options: { method: 'GET' | 'POST'; body?: JsonObject; headers?: Record<string, string> }
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  return { status: response.status, body };
}
