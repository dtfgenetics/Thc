import {
  growLensRemoteStore,
  GrowLensApiError,
  GrowLensSyncConflictError,
  type GrowLensRemoteStore,
} from './remoteStore';
import { loadState } from './storage';
import {
  clearSyncMetadata,
  loadSyncMetadata,
  saveSyncMetadata,
  stateHash,
  writeSyncMetadata,
  type SyncMetadata,
} from './syncMetadata';
import {
  clearSyncIntent,
  getSyncIntent,
  putSyncIntent,
  queueSyncIntent,
  type SyncIntent,
} from './syncIntentStore';
import { AUTO_SYNC_CHANNEL, AUTO_SYNC_STATUS_EVENT } from './syncEvents';
import type { GrowLensState } from './types';

export type SafeSyncStatus = 'synced' | 'noop' | 'blocked-auth' | 'blocked-conflict' | 'retry';

export type SafeSyncResult = {
  status: SafeSyncStatus;
  message: string;
  metadata?: SyncMetadata;
};

type SyncRemoteStore = Pick<GrowLensRemoteStore, 'getSession' | 'pull' | 'push'>;

type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

let fallbackLock: Promise<void> = Promise.resolve();

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'The synchronization attempt failed.';
}

export function retryDelayMs(retryCount: number): number {
  return Math.min(5 * 60_000, 5_000 * (2 ** Math.max(0, retryCount)));
}

export async function attemptSafeSync(options: {
  intent: SyncIntent;
  metadata: SyncMetadata | null;
  localState: GrowLensState;
  remoteStore: SyncRemoteStore;
}): Promise<SafeSyncResult> {
  const { intent, metadata, localState, remoteStore } = options;
  try {
    if (!metadata || metadata.userId !== intent.userId) {
      return {
        status: 'blocked-auth',
        message: 'Reconnect the GrowLens account before automatic synchronization can continue.',
      };
    }

    const session = await remoteStore.getSession();
    if (!session.authenticated || session.user.id !== metadata.userId) {
      return {
        status: 'blocked-auth',
        message: 'The GrowLens account session expired or changed. Sign in again to continue.',
      };
    }

    const remote = await remoteStore.pull();
    const localHash = stateHash(localState);
    const remoteHash = stateHash(remote.state);

    if (localHash === remoteHash) {
      return {
        status: 'noop',
        message: `Device and account already match at revision ${remote.revision}.`,
        metadata: {
          userId: session.user.id,
          revision: remote.revision,
          stateHash: remoteHash,
          updatedAt: remote.updatedAt,
        },
      };
    }

    if (remote.revision !== metadata.revision || remoteHash !== metadata.stateHash) {
      return {
        status: 'blocked-conflict',
        message: 'Another device changed the account copy. Automatic sync stopped before overwriting anything.',
      };
    }

    const saved = await remoteStore.push(localState, remote.revision, session.csrfToken);
    return {
      status: 'synced',
      message: `Automatically synced to revision ${saved.revision}.`,
      metadata: {
        userId: session.user.id,
        revision: saved.revision,
        stateHash: stateHash(saved.state),
        updatedAt: saved.updatedAt,
      },
    };
  } catch (error) {
    if (error instanceof GrowLensSyncConflictError) {
      return {
        status: 'blocked-conflict',
        message: 'The server rejected a stale revision. Automatic sync stopped for manual conflict resolution.',
      };
    }
    if (error instanceof GrowLensApiError && [401, 403].includes(error.status)) {
      return {
        status: 'blocked-auth',
        message: 'The GrowLens session is no longer authorized. Sign in again to continue.',
      };
    }
    return {
      status: 'retry',
      message: readableError(error),
    };
  }
}

async function withFallbackLock<T>(task: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const previous = fallbackLock;
  fallbackLock = previous.then(() => gate);
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

async function withOriginLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined') {
    const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
    if (locks) return locks.request('growlens-safe-auto-sync', task);
  }
  return withFallbackLock(task);
}

function notify(intent: SyncIntent | null, message: string): void {
  const detail = { intent, message, sentAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTO_SYNC_STATUS_EVENT, { detail }));
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTO_SYNC_CHANNEL);
    channel.postMessage(detail);
    channel.close();
  }
}

export async function ensureSyncBaseline(
  remoteStore: SyncRemoteStore = growLensRemoteStore,
): Promise<SyncMetadata | null> {
  const existing = loadSyncMetadata();
  if (existing) return existing;

  try {
    const session = await remoteStore.getSession();
    if (!session.authenticated) {
      notify(null, 'Sign in and reconcile this device before enabling safe auto-sync.');
      return null;
    }
    const remote = await remoteStore.pull();
    const local = loadState();
    if (stateHash(local) !== stateHash(remote.state)) {
      notify(null, 'Device and account copies differ. Use the account controls to choose, merge, or upload before enabling auto-sync.');
      return null;
    }
    const metadata = saveSyncMetadata(session.user.id, remote.revision, remote.state, remote.updatedAt);
    notify(null, `Safe auto-sync baseline established at revision ${remote.revision}.`);
    return metadata;
  } catch (error) {
    notify(null, readableError(error));
    return null;
  }
}

export async function queueCurrentStateForSync(
  remoteStore: SyncRemoteStore = growLensRemoteStore,
): Promise<SyncIntent | null> {
  const metadata = await ensureSyncBaseline(remoteStore);
  if (!metadata) return null;
  const intent = await queueSyncIntent(metadata, loadState());
  notify(intent, 'Local changes queued for safe automatic synchronization.');
  return intent;
}

export async function clearQueuedSync(message = 'Automatic synchronization queue cleared.'): Promise<void> {
  try {
    await clearSyncIntent();
  } catch {
    // The queue may not exist in restricted browsers; account state still clears normally.
  }
  notify(null, message);
}

export async function getQueuedSync(): Promise<SyncIntent | null> {
  try {
    return await getSyncIntent();
  } catch {
    return null;
  }
}

export async function runQueuedSync(
  remoteStore: SyncRemoteStore = growLensRemoteStore,
  now = new Date(),
): Promise<SafeSyncResult | null> {
  return withOriginLock(async () => {
    const intent = await getQueuedSync();
    if (!intent) return null;
    if (new Date(intent.nextAttemptAt).getTime() > now.getTime()) return null;

    const syncing: SyncIntent = {
      ...intent,
      status: 'syncing',
      updatedAt: now.toISOString(),
      lastError: '',
    };
    await putSyncIntent(syncing);
    notify(syncing, 'Checking the latest device and account revisions.');

    const result = await attemptSafeSync({
      intent: syncing,
      metadata: loadSyncMetadata(),
      localState: loadState(),
      remoteStore,
    });

    if ((result.status === 'synced' || result.status === 'noop') && result.metadata) {
      writeSyncMetadata(result.metadata);
      await clearSyncIntent();
      notify(null, result.message);
      return result;
    }

    const retryCount = result.status === 'retry' ? syncing.retryCount + 1 : syncing.retryCount;
    const updated: SyncIntent = {
      ...syncing,
      status: result.status === 'blocked-auth'
        ? 'blocked-auth'
        : result.status === 'blocked-conflict'
          ? 'blocked-conflict'
          : 'failed',
      retryCount,
      nextAttemptAt: result.status === 'retry'
        ? new Date(now.getTime() + retryDelayMs(retryCount)).toISOString()
        : now.toISOString(),
      lastError: result.message,
      updatedAt: now.toISOString(),
    };
    await putSyncIntent(updated);
    notify(updated, result.message);
    return result;
  });
}

export function establishSyncBaseline(
  userId: string,
  revision: number,
  state: GrowLensState,
  updatedAt: string,
): SyncMetadata {
  return saveSyncMetadata(userId, revision, state, updatedAt);
}

export function forgetSyncBaseline(): void {
  clearSyncMetadata();
}
