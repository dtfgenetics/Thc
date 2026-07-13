#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  ACCEPTANCE_CONFIRMATION,
  GrowLensApiClient,
  assertApiSecurityHeaders,
  assertJsonSuccess,
  buildDeviceOneState,
  buildDeviceTwoState,
  createDisposableCredentials,
  createRunId,
  emptyGrowLensState,
  hasRecord,
  normalizeBaseUrl,
  tinyPngBytes,
} from './growlens-live-acceptance-lib.mjs';

const confirmation = process.env.GROWLENS_ACCEPTANCE_CONFIRM ?? '';
const allowHttpLocal = process.env.GROWLENS_ALLOW_HTTP_LOCAL === 'true';
const accountDomain = process.env.GROWLENS_TEST_EMAIL_DOMAIN || 'example.com';

function logStep(message) {
  process.stdout.write(`\n▶ ${message}\n`);
}

function logPass(message) {
  process.stdout.write(`  ✓ ${message}\n`);
}

function requireConfirmation() {
  if (confirmation !== ACCEPTANCE_CONFIRMATION) {
    throw new Error(`This script creates and deletes disposable accounts. Set GROWLENS_ACCEPTANCE_CONFIRM=${ACCEPTANCE_CONFIRMATION} to run it.`);
  }
}

async function cleanupAccount({ registered, deleted, credentials, clients, baseUrl, label }) {
  if (!registered || deleted) return null;

  for (const client of clients) {
    if (!client?.sessionCookie || !client?.csrfToken) continue;
    try {
      await client.deleteAccount(credentials.password);
      return null;
    } catch {
      // Try another live session, then a fresh login below.
    }
  }

  const recovery = new GrowLensApiClient(baseUrl, `${label}-cleanup`);
  try {
    const login = await recovery.login(credentials, [200, 401]);
    if (login.response.status === 401) return null;
    await recovery.deleteAccount(credentials.password);
    return null;
  } catch (error) {
    return new Error(`${label} cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function run() {
  requireConfirmation();
  const baseUrl = normalizeBaseUrl(process.env.GROWLENS_BASE_URL, allowHttpLocal);
  const runId = createRunId();
  const accountA = createDisposableCredentials(runId, 'a', accountDomain);
  const accountB = createDisposableCredentials(runId, 'b', accountDomain);
  const photoOneId = `photo-accept-${runId}`;
  const photoTwoId = `photo-delete-${runId}`;
  const pngBytes = tinyPngBytes();

  const anonymous = new GrowLensApiClient(baseUrl, 'anonymous');
  const deviceA1 = new GrowLensApiClient(baseUrl, 'account-a-device-1');
  const deviceA2 = new GrowLensApiClient(baseUrl, 'account-a-device-2');
  const deviceB = new GrowLensApiClient(baseUrl, 'account-b');

  let accountARegistered = false;
  let accountBRegistered = false;
  let accountADeleted = false;
  let accountBDeleted = false;
  let primaryFailure = null;
  const startedAt = Date.now();

  try {
    logStep('Verify the deployed API and storage health');
    const health = await anonymous.request('health.php');
    assertJsonSuccess(health.payload, 'Health endpoint');
    assert.equal(health.payload.service, 'growlens-api');
    assert.equal(health.payload.storageReady, true);
    assertApiSecurityHeaders(health.response, 'Health endpoint');
    logPass('API is reachable and private storage is writable.');

    logStep('Verify unauthenticated and cross-origin boundaries');
    const unauthorizedSync = await anonymous.request('sync.php', { expectedStatuses: [401] });
    assert.equal(unauthorizedSync.payload?.error, 'Authentication required.');
    const rejectedOrigin = await anonymous.request('register.php', {
      method: 'POST',
      origin: 'https://rejected-origin.example',
      json: {
        email: `rejected-${runId}@example.com`,
        password: 'This-password-is-never-registered-123!',
      },
      expectedStatuses: [403],
    });
    assert.equal(rejectedOrigin.payload?.error, 'Origin rejected.');
    logPass('Protected routes reject anonymous access and foreign origins.');

    logStep('Register two disposable, isolated accounts');
    const registeredA = await deviceA1.register(accountA);
    accountARegistered = true;
    assertJsonSuccess(registeredA.payload, 'Account A registration');
    assert.equal(registeredA.payload.revision, 0);
    assert.deepEqual(registeredA.payload.state, emptyGrowLensState());
    assertApiSecurityHeaders(registeredA.response, 'Account A registration');

    const registeredB = await deviceB.register(accountB);
    accountBRegistered = true;
    assertJsonSuccess(registeredB.payload, 'Account B registration');
    assert.equal(registeredB.payload.revision, 0);
    assert.deepEqual(registeredB.payload.state, emptyGrowLensState());
    assert.notEqual(registeredA.payload.user?.id, registeredB.payload.user?.id);
    logPass('Accounts received different user IDs, sessions, CSRF tokens, and empty state.');

    logStep('Verify session persistence and CSRF enforcement');
    const sessionA = await deviceA1.request('session.php');
    assert.equal(sessionA.payload?.authenticated, true);
    assert.equal(sessionA.payload?.revision, 0);
    assert.equal(sessionA.payload?.user?.id, registeredA.payload.user?.id);

    const stateOne = buildDeviceOneState(runId, photoOneId);
    const rejectedCsrf = await deviceA1.request('sync.php', {
      method: 'POST',
      json: { expectedRevision: 0, state: stateOne },
      expectedStatuses: [403],
    });
    assert.equal(rejectedCsrf.payload?.error, 'CSRF token rejected.');
    const unchangedAfterCsrf = await deviceA1.request('sync.php');
    assert.equal(unchangedAfterCsrf.payload?.revision, 0);
    logPass('Session cookie persists and writes without the session CSRF token are rejected.');

    logStep('Save device-one state and verify cross-device login');
    const savedOne = await deviceA1.request('sync.php', {
      method: 'POST',
      csrf: true,
      json: { expectedRevision: 0, state: stateOne },
    });
    assertJsonSuccess(savedOne.payload, 'Device one sync');
    assert.equal(savedOne.payload.revision, 1);
    assert(hasRecord(savedOne.payload.state, 'diary', `entry-device-one-${runId}`));

    const loginA2 = await deviceA2.login(accountA);
    assertJsonSuccess(loginA2.payload, 'Account A second-device login');
    assert.equal(loginA2.payload.revision, 1);
    assert(hasRecord(loginA2.payload.state, 'plants', `plant-accept-${runId}`));
    logPass('A second independent session received the exact synchronized grow state.');

    logStep('Verify revision advancement and stale-write conflict protection');
    const stateTwo = buildDeviceTwoState(loginA2.payload.state, runId);
    const savedTwo = await deviceA2.request('sync.php', {
      method: 'POST',
      csrf: true,
      json: { expectedRevision: 1, state: stateTwo },
    });
    assert.equal(savedTwo.payload?.revision, 2);
    assert(hasRecord(savedTwo.payload.state, 'diary', `entry-device-two-${runId}`));

    const staleWrite = await deviceA1.request('sync.php', {
      method: 'POST',
      csrf: true,
      json: { expectedRevision: 1, state: stateOne },
      expectedStatuses: [409],
    });
    assert.equal(staleWrite.payload?.conflict, true);
    assert.equal(staleWrite.payload?.revision, 2);

    const refreshedA1 = await deviceA1.request('sync.php');
    assert.equal(refreshedA1.payload?.revision, 2);
    assert(hasRecord(refreshedA1.payload.state, 'diary', `entry-device-two-${runId}`));
    logPass('The server rejected the stale device and preserved the newer revision.');

    logStep('Verify account-state isolation');
    const stateB = await deviceB.request('sync.php');
    assert.equal(stateB.payload?.revision, 0);
    assert.deepEqual(stateB.payload?.state, emptyGrowLensState());
    assert(!JSON.stringify(stateB.payload).includes(runId));
    logPass('Account B cannot see account A records or revision history.');

    logStep('Upload a private observation image and verify same-account access');
    const observationId = `observation-accept-${runId}`;
    const plantId = `plant-accept-${runId}`;
    const uploadForm = new FormData();
    uploadForm.append('photoId', photoOneId);
    uploadForm.append('plantId', plantId);
    uploadForm.append('observationId', observationId);
    uploadForm.append('capturedAt', new Date().toISOString());
    uploadForm.append('image', new Blob([pngBytes], { type: 'image/png' }), `${photoOneId}.png`);
    const uploadOne = await deviceA1.request('upload-image.php', {
      method: 'POST',
      csrf: true,
      body: uploadForm,
      expectedStatuses: [201],
    });
    assertJsonSuccess(uploadOne.payload, 'Private image upload');
    assert.equal(uploadOne.payload.image?.id, photoOneId);

    const listA2 = await deviceA2.request('list-images.php');
    assert(listA2.payload?.images?.some((image) => image.id === photoOneId));
    const fetchedImage = await deviceA2.request(`image.php?id=${encodeURIComponent(photoOneId)}`, {
      parse: 'bytes',
    });
    assert(Buffer.from(fetchedImage.payload).equals(pngBytes));
    assertApiSecurityHeaders(fetchedImage.response, 'Private image response', { privateCache: true });
    assert.equal(fetchedImage.response.headers.get('content-type'), 'image/png');
    logPass('The second device can list and stream the first device’s private image without caching it publicly.');

    logStep('Verify private-image isolation and authorization');
    const listB = await deviceB.request('list-images.php');
    assert(!listB.payload?.images?.some((image) => image.id === photoOneId));
    const fetchB = await deviceB.request(`image.php?id=${encodeURIComponent(photoOneId)}`, {
      expectedStatuses: [404],
    });
    assert.equal(fetchB.payload?.error, 'Image not found.');
    const deleteB = await deviceB.request('delete-image.php', {
      method: 'POST',
      csrf: true,
      json: { photoId: photoOneId },
      expectedStatuses: [404],
    });
    assert.equal(deleteB.payload?.error, 'Image not found.');
    const fetchAnonymous = await anonymous.request(`image.php?id=${encodeURIComponent(photoOneId)}`, {
      expectedStatuses: [401],
    });
    assert.equal(fetchAnonymous.payload?.error, 'Authentication required.');
    logPass('Another account cannot list, stream, or delete the image; anonymous access is rejected.');

    logStep('Verify account export completeness and secret exclusion');
    const exported = await deviceA2.request('export.php');
    assert.equal(exported.payload?.app, 'THC GrowLens');
    assert.equal(exported.payload?.revision, 2);
    assert(hasRecord(exported.payload.state, 'diary', `entry-device-two-${runId}`));
    assertApiSecurityHeaders(exported.response, 'Account export');
    assert.match(exported.response.headers.get('content-disposition') ?? '', /^attachment;/i);
    const exportedText = JSON.stringify(exported.payload);
    assert(!/passwordHash|csrfToken|growlens_session/i.test(exportedText));
    logPass('Export contains the current account state without password, CSRF, or session secrets.');

    logStep('Verify individual image deletion propagates across sessions');
    const deletedImage = await deviceA2.request('delete-image.php', {
      method: 'POST',
      csrf: true,
      json: { photoId: photoOneId },
    });
    assert.equal(deletedImage.payload?.deleted, true);
    const listAfterDelete = await deviceA1.request('list-images.php');
    assert(!listAfterDelete.payload?.images?.some((image) => image.id === photoOneId));
    const fetchAfterDelete = await deviceA1.request(`image.php?id=${encodeURIComponent(photoOneId)}`, {
      expectedStatuses: [404],
    });
    assert.equal(fetchAfterDelete.payload?.error, 'Image not found.');
    logPass('Image bytes and metadata are no longer available to either account-A session.');

    logStep('Leave a second private image for account-deletion cleanup verification');
    const deletionForm = new FormData();
    deletionForm.append('photoId', photoTwoId);
    deletionForm.append('plantId', plantId);
    deletionForm.append('observationId', observationId);
    deletionForm.append('capturedAt', new Date().toISOString());
    deletionForm.append('image', new Blob([pngBytes], { type: 'image/png' }), `${photoTwoId}.png`);
    const uploadTwo = await deviceA1.request('upload-image.php', {
      method: 'POST',
      csrf: true,
      body: deletionForm,
      expectedStatuses: [201],
    });
    assert.equal(uploadTwo.payload?.image?.id, photoTwoId);
    const verifySecondImage = await deviceA2.request('list-images.php');
    assert(verifySecondImage.payload?.images?.some((image) => image.id === photoTwoId));
    logPass('A second image exists before deleting the account.');

    logStep('Delete account A and verify all sessions and credentials are revoked');
    const deletedA = await deviceA2.deleteAccount(accountA.password);
    accountADeleted = true;
    assert.equal(deletedA.payload?.deleted, true);
    assert.equal(deletedA.payload?.authenticated, false);

    const sessionAfterDeleteA1 = await deviceA1.request('session.php');
    const sessionAfterDeleteA2 = await deviceA2.request('session.php');
    assert.equal(sessionAfterDeleteA1.payload?.authenticated, false);
    assert.equal(sessionAfterDeleteA2.payload?.authenticated, false);

    const deletedLoginClient = new GrowLensApiClient(baseUrl, 'deleted-account-login');
    const deletedLogin = await deletedLoginClient.login(accountA, [401]);
    assert.equal(deletedLogin.payload?.error, 'Invalid email or password.');
    const imageFromBPostDeletion = await deviceB.request(`image.php?id=${encodeURIComponent(photoTwoId)}`, {
      expectedStatuses: [404],
    });
    assert.equal(imageFromBPostDeletion.payload?.error, 'Image not found.');
    logPass('Account A no longer authenticates, both sessions are revoked, and its image remains inaccessible to account B.');

    logStep('Confirm account B remained isolated, then delete it');
    const finalStateB = await deviceB.request('sync.php');
    assert.equal(finalStateB.payload?.revision, 0);
    assert.deepEqual(finalStateB.payload?.state, emptyGrowLensState());
    const deletedB = await deviceB.deleteAccount(accountB.password);
    accountBDeleted = true;
    assert.equal(deletedB.payload?.deleted, true);
    const sessionAfterDeleteB = await deviceB.request('session.php');
    assert.equal(sessionAfterDeleteB.payload?.authenticated, false);
    logPass('Account B stayed unchanged and was removed successfully.');
  } catch (error) {
    primaryFailure = error instanceof Error ? error : new Error(String(error));
  } finally {
    const cleanupFailures = [];
    const cleanupA = await cleanupAccount({
      registered: accountARegistered,
      deleted: accountADeleted,
      credentials: accountA,
      clients: [deviceA2, deviceA1],
      baseUrl,
      label: 'Account A',
    });
    if (cleanupA) cleanupFailures.push(cleanupA);

    const cleanupB = await cleanupAccount({
      registered: accountBRegistered,
      deleted: accountBDeleted,
      credentials: accountB,
      clients: [deviceB],
      baseUrl,
      label: 'Account B',
    });
    if (cleanupB) cleanupFailures.push(cleanupB);

    if (primaryFailure || cleanupFailures.length) {
      const messages = [primaryFailure, ...cleanupFailures]
        .filter(Boolean)
        .map((error) => error.message);
      throw new Error(messages.join('\n'));
    }
  }

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`\nGrowLens live acceptance passed in ${durationSeconds}s.\n`);
  process.stdout.write('Verified: health, origin/CSRF, two accounts, two sessions, sync revisions, conflict handling, record isolation, private images, export, image deletion, account deletion, and cleanup.\n');
}

run().catch((error) => {
  process.stderr.write(`\nGrowLens live acceptance failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
