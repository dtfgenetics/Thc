import { stateHash, type SyncMetadata } from './syncMetadata';
import type { GrowLensState } from './types';

export type SyncIntentStatus = 'pending' | 'syncing' | 'blocked-auth' | 'blocked-conflict' | 'failed';

export type SyncIntent = {
  id: 'latest';
  userId: string;
  baseRevision: number;
  baseStateHash: string;
  localStateHash: string;
  status: SyncIntentStatus;
  retryCount: number;
  nextAttemptAt: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

const DATABASE_NAME = 'growlens-sync-v1';
const DATABASE_VERSION = 1;
const INTENT_STORE = 'intents';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Sync intent request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Sync intent transaction was aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Sync intent transaction failed.'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    throw new Error('Safe auto-sync storage is not available in this browser.');
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(INTENT_STORE)) {
      database.createObjectStore(INTENT_STORE, { keyPath: 'id' });
    }
  };
  return requestResult(request);
}

export async function getSyncIntent(): Promise<SyncIntent | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(INTENT_STORE, 'readonly');
    const completed = transactionDone(transaction);
    const result = await requestResult(transaction.objectStore(INTENT_STORE).get('latest'));
    await completed;
    return result ?? null;
  } finally {
    database.close();
  }
}

export async function putSyncIntent(intent: SyncIntent): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(INTENT_STORE, 'readwrite');
    const completed = transactionDone(transaction);
    transaction.objectStore(INTENT_STORE).put(intent);
    await completed;
  } finally {
    database.close();
  }
}

export async function clearSyncIntent(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(INTENT_STORE, 'readwrite');
    const completed = transactionDone(transaction);
    transaction.objectStore(INTENT_STORE).delete('latest');
    await completed;
  } finally {
    database.close();
  }
}

export async function queueSyncIntent(
  metadata: SyncMetadata,
  state: GrowLensState,
  now = new Date(),
): Promise<SyncIntent> {
  const existing = await getSyncIntent().catch(() => null);
  const timestamp = now.toISOString();
  const intent: SyncIntent = {
    id: 'latest',
    userId: metadata.userId,
    baseRevision: metadata.revision,
    baseStateHash: metadata.stateHash,
    localStateHash: stateHash(state),
    status: 'pending',
    retryCount: 0,
    nextAttemptAt: timestamp,
    lastError: '',
    createdAt: existing?.userId === metadata.userId ? existing.createdAt : timestamp,
    updatedAt: timestamp,
  };
  await putSyncIntent(intent);
  return intent;
}
