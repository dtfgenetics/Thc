import { normalizeState } from './storage';
import { stateFingerprint } from './syncMerge';
import type { GrowLensState } from './types';

export const AUTO_SYNC_ENABLED_KEY = 'growlens-safe-sync-enabled-v1';
export const SYNC_BASELINE_KEY = 'growlens-sync-baseline-v1';
export const SYNC_STATUS_EVENT = 'growlens:sync-status';
export const SYNC_WAKE_TAG = 'growlens-sync-intent-v1';

const DATABASE_NAME = 'growlens-sync-v1';
const DATABASE_VERSION = 1;
const INTENT_STORE = 'intents';
const CURRENT_STATE_INTENT_ID = 'current-state';
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

export type SyncIntentStatus = 'queued' | 'blocked';

export type SyncIntent = {
  id: typeof CURRENT_STATE_INTENT_ID;
  queuedAt: string;
  updatedAt: string;
  attempts: number;
  status: SyncIntentStatus;
  nextAttemptAt: string | null;
  lastError: string;
};

export type SyncBaseline = {
  userId: string;
  revision: number;
  fingerprint: string;
  updatedAt: string;
};

export type SyncDecision = 'match' | 'push-local' | 'pull-remote' | 'conflict' | 'needs-baseline';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Sync queue request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Sync queue transaction was aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Sync queue transaction failed.'));
  });
}

async function openQueueDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) throw new Error('Offline synchronization queue is unavailable in this browser.');
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(INTENT_STORE)) {
      database.createObjectStore(INTENT_STORE, { keyPath: 'id' });
    }
  };
  return requestResult(request);
}

export function isAutoSyncEnabled(storage: Pick<Storage, 'getItem'> = window.localStorage): boolean {
  return storage.getItem(AUTO_SYNC_ENABLED_KEY) === 'true';
}

export function setAutoSyncEnabled(enabled: boolean, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(AUTO_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function readSyncBaseline(storage: Pick<Storage, 'getItem'> = window.localStorage): SyncBaseline | null {
  try {
    const raw = storage.getItem(SYNC_BASELINE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const userId = typeof value.userId === 'string' ? value.userId : '';
    const revision = Number(value.revision);
    const fingerprint = typeof value.fingerprint === 'string' ? value.fingerprint : '';
    const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
    if (!userId || !Number.isInteger(revision) || revision < 0 || !fingerprint || !updatedAt) return null;
    return { userId, revision, fingerprint, updatedAt };
  } catch {
    return null;
  }
}

export function writeSyncBaseline(
  userId: string,
  revision: number,
  state: GrowLensState,
  updatedAt: string,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): SyncBaseline {
  const baseline: SyncBaseline = {
    userId,
    revision: Math.max(0, Math.trunc(revision)),
    fingerprint: stateFingerprint(normalizeState(state)),
    updatedAt,
  };
  storage.setItem(SYNC_BASELINE_KEY, JSON.stringify(baseline));
  return baseline;
}

export function clearSyncBaseline(storage: Pick<Storage, 'removeItem'> = window.localStorage): void {
  storage.removeItem(SYNC_BASELINE_KEY);
}

export function decideSyncAction(
  localState: GrowLensState,
  remoteState: GrowLensState,
  baseline: SyncBaseline | null,
  currentUserId: string,
): SyncDecision {
  const localFingerprint = stateFingerprint(localState);
  const remoteFingerprint = stateFingerprint(remoteState);
  if (localFingerprint === remoteFingerprint) return 'match';
  if (!baseline || baseline.userId !== currentUserId) return 'needs-baseline';
  const localChanged = localFingerprint !== baseline.fingerprint;
  const remoteChanged = remoteFingerprint !== baseline.fingerprint;
  if (localChanged && !remoteChanged) return 'push-local';
  if (!localChanged && remoteChanged) return 'pull-remote';
  return 'conflict';
}

export async function getSyncIntent(): Promise<SyncIntent | null> {
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(INTENT_STORE, 'readonly');
    const completed = transactionDone(transaction);
    const intent = await requestResult(transaction.objectStore(INTENT_STORE).get(CURRENT_STATE_INTENT_ID));
    await completed;
    return intent ?? null;
  } finally {
    database.close();
  }
}

export async function putSyncIntent(intent: SyncIntent): Promise<void> {
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(INTENT_STORE, 'readwrite');
    const completed = transactionDone(transaction);
    transaction.objectStore(INTENT_STORE).put(intent);
    await completed;
  } finally {
    database.close();
  }
}

export async function enqueueCurrentStateSync(): Promise<SyncIntent> {
  const existing = await getSyncIntent();
  const now = new Date().toISOString();
  const intent: SyncIntent = existing
    ? {
      ...existing,
      updatedAt: now,
      status: existing.status === 'blocked' ? 'blocked' : 'queued',
      nextAttemptAt: existing.status === 'blocked' ? existing.nextAttemptAt : null,
    }
    : {
      id: CURRENT_STATE_INTENT_ID,
      queuedAt: now,
      updatedAt: now,
      attempts: 0,
      status: 'queued',
      nextAttemptAt: null,
      lastError: '',
    };
  await putSyncIntent(intent);
  await registerSyncWakeup();
  return intent;
}

export async function clearSyncIntent(): Promise<void> {
  const database = await openQueueDatabase();
  try {
    const transaction = database.transaction(INTENT_STORE, 'readwrite');
    const completed = transactionDone(transaction);
    transaction.objectStore(INTENT_STORE).delete(CURRENT_STATE_INTENT_ID);
    await completed;
  } finally {
    database.close();
  }
}

export async function markSyncIntentBlocked(message: string): Promise<SyncIntent> {
  const current = await getSyncIntent() ?? await enqueueCurrentStateSync();
  const updated: SyncIntent = {
    ...current,
    status: 'blocked',
    updatedAt: new Date().toISOString(),
    nextAttemptAt: null,
    lastError: message.slice(0, 500),
  };
  await putSyncIntent(updated);
  return updated;
}

export async function markSyncIntentRetry(message: string): Promise<SyncIntent> {
  const current = await getSyncIntent() ?? await enqueueCurrentStateSync();
  const attempts = current.attempts + 1;
  const delay = Math.min(MAX_RETRY_DELAY_MS, 2 ** Math.min(attempts, 10) * 1000);
  const updated: SyncIntent = {
    ...current,
    attempts,
    status: 'queued',
    updatedAt: new Date().toISOString(),
    nextAttemptAt: new Date(Date.now() + delay).toISOString(),
    lastError: message.slice(0, 500),
  };
  await putSyncIntent(updated);
  await registerSyncWakeup();
  return updated;
}

export function syncIntentIsDue(intent: SyncIntent, now = Date.now()): boolean {
  if (intent.status === 'blocked') return false;
  if (!intent.nextAttemptAt) return true;
  const timestamp = new Date(intent.nextAttemptAt).getTime();
  return Number.isNaN(timestamp) || timestamp <= now;
}

export async function registerSyncWakeup(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    }).sync;
    if (syncManager) await syncManager.register(SYNC_WAKE_TAG);
  } catch {
    // App-start, online, focus, and visibility retries remain available.
  }
}

export function broadcastSyncStatus(detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail }));
  if ('BroadcastChannel' in globalThis) {
    const channel = new BroadcastChannel('growlens-sync-v1');
    channel.postMessage(detail);
    channel.close();
  }
}
