import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import test from 'node:test';
import { RoomService } from '../domain/RoomService.js';
import { MemoryRoomStore } from '../storage/RoomStore.js';
import { createHttpApp } from './createHttpApp.js';

test('readiness rejects unidentified memory-only deployments', async (context) => {
  const restore = preserveEnvironment(['RELEASE_SHA', 'GITHUB_SHA', 'ROOM_DATA_FILE']);
  delete process.env.RELEASE_SHA;
  delete process.env.GITHUB_SHA;
  delete process.env.ROOM_DATA_FILE;
  context.after(restore);

  const { server, baseUrl } = await startServer();
  context.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}/ready`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.ready, false);
  assert.deepEqual(body.blockers, [
    'release-identity-missing',
    'persistent-room-storage-missing'
  ]);
});

test('readiness accepts an identified staging deployment with persisted room storage', async (context) => {
  const restore = preserveEnvironment(['RELEASE_SHA', 'GITHUB_SHA', 'ROOM_DATA_FILE']);
  process.env.RELEASE_SHA = 'release-test-sha';
  delete process.env.GITHUB_SHA;
  process.env.ROOM_DATA_FILE = './data/test-rooms.json';
  context.after(restore);

  const { server, baseUrl } = await startServer();
  context.after(() => closeServer(server));

  const response = await fetch(`${baseUrl}/ready`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ready, true);
  assert.deepEqual(body.blockers, []);
  assert.equal(body.release, 'release-test-sha');
  assert.equal(body.persistence, 'json-file');
});

async function startServer() {
  const service = new RoomService(new MemoryRoomStore());
  const server = createHttpApp(service).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function preserveEnvironment(keys: string[]) {
  const values = new Map(keys.map((key) => [key, process.env[key]]));
  return () => {
    for (const [key, value] of values) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}
