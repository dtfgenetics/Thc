#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  GrowLensApiClient,
  buildDeviceOneState,
  buildDeviceTwoState,
  createDisposableCredentials,
  createRunId,
  extractSessionCookie,
  hasRecord,
  normalizeBaseUrl,
  redactPayload,
  tinyPngBytes,
  validatePasswordSeed,
} from './growlens-live-acceptance-lib.mjs';

const baseUrl = normalizeBaseUrl('https://dtfseeds.com/growlens/');
assert.equal(baseUrl.href, 'https://dtfseeds.com/growlens');
assert.throws(() => normalizeBaseUrl('http://dtfseeds.com/growlens'), /requires HTTPS/);
assert.throws(() => normalizeBaseUrl('https://dtfseeds.com/wordpress'), /must end in \/growlens/);
assert.equal(
  normalizeBaseUrl('http://127.0.0.1:8080/growlens', true).href,
  'http://127.0.0.1:8080/growlens',
);

const runId = createRunId(new Date('2026-07-13T20:30:00.000Z'), 'ABC_123');
assert.equal(runId, '20260713203000-abc123');
const seed = validatePasswordSeed('self-test-seed-that-is-at-least-thirty-two-characters');
const credentials = createDisposableCredentials(runId, 'A', 'example.com', seed);
const repeatedCredentials = createDisposableCredentials(runId, 'A', 'example.com', seed);
const secondAccountCredentials = createDisposableCredentials(runId, 'B', 'example.com', seed);
assert.equal(credentials.email, 'growlens-accept-a-20260713203000-abc123@example.com');
assert(credentials.password.length >= 40);
assert.equal(credentials.password, repeatedCredentials.password);
assert.notEqual(credentials.password, secondAccountCredentials.password);
assert(!credentials.password.includes(credentials.email));
assert.throws(() => validatePasswordSeed('too-short'), /32 to 1000/);

assert.equal(
  extractSessionCookie('growlens_session=abc_DEF-123; expires=Wed, 12 Aug 2026 20:30:00 GMT; path=/growlens/; HttpOnly'),
  'abc_DEF-123',
);
assert.equal(
  extractSessionCookie(['other=value; Path=/', 'growlens_session=; Max-Age=0; Path=/growlens/']),
  null,
);
assert.equal(extractSessionCookie(undefined), undefined);

const photoId = `photo-accept-${runId}`;
const firstState = buildDeviceOneState(runId, photoId);
assert(hasRecord(firstState, 'plants', `plant-accept-${runId}`));
assert.equal(firstState.observations[0].photoIds[0], photoId);
assert.equal(firstState.tasks[0].recurrence, 'weekly');
const secondState = buildDeviceTwoState(firstState, runId);
assert.equal(firstState.diary.length, 1);
assert.equal(secondState.diary.length, 2);
assert(hasRecord(secondState, 'diary', `entry-device-two-${runId}`));

const redacted = redactPayload({
  password: 'secret',
  nested: { csrfToken: 'token', safe: 'visible' },
  items: [{ sessionCookie: 'cookie' }],
});
assert.deepEqual(redacted, {
  password: '[REDACTED]',
  nested: { csrfToken: '[REDACTED]', safe: 'visible' },
  items: [{ sessionCookie: '[REDACTED]' }],
});

const client = new GrowLensApiClient(baseUrl, 'self-test');
assert.equal(client.endpoint('health.php').href, 'https://dtfseeds.com/growlens/api/health.php');
assert.equal(client.endpoint('/image.php?id=photo-test').href, 'https://dtfseeds.com/growlens/api/image.php?id=photo-test');
client.captureCookie(new Headers({
  'set-cookie': 'growlens_session=test-session; Path=/growlens/; HttpOnly',
}));
assert.equal(client.sessionCookie, 'test-session');

const png = tinyPngBytes();
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert(png.length > 60);

process.stdout.write('GrowLens live acceptance client self-test passed.\n');
