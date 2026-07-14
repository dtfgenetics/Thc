import {
  growLensRemoteStore,
  GrowLensApiError,
  GrowLensSyncConflictError,
  type GrowLensRemoteStore,
} from './remoteStore';
import { loadState, saveState } from './storage';
import {
  broadcastSyncStatus,
  clearSyncIntent,
  decideSyncAction,
  getSyncIntent,
  isAutoSyncEnabled,
  markSyncIntentBlocked,
  markSyncIntentRetry,
  putSyncIntent,
  readSyncBaseline,
  syncIntentIsDue,
  writeSyncBaseline,
  type SyncIntent,
} from './syncIntentQueue';

export type SyncRunStatus =
  | 'idle'
  | 'busy'
  | 'offline'
  | 'signed-out'
  | 'queued'
  | 'synced'
  | 'uploaded'
  | 'downloaded'
  | 'conflict'
  | 'error';

export type SyncRunResult = {
  status: SyncRunStatus;
  message: string;
  revision?: number;
};

type CoordinatorOptions = {
  remoteStore?: GrowLensRemoteStore;
  force?: boolean;
  now?: () => number;
};

let fallbackLock = false;

function readableError(error: unknown): string {
  if (error instanceof GrowLensApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Synchronization failed.';
}

async function withCoordinatorLock<T>(work: () => Promise<T>, busyValue: T): Promise<T> {
  const locks = navigator.locks;
  if (locks?.request) {
    return locks.request('growlens-safe-sync-v1', { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) return busyValue;
      return work();
    });
  }
  if (fallbackLock) return busyValue;
  fallbackLock = true;
  try {
    return await work();
  } finally {
    fallbackLock = false;
  }
}

async function setWaitingIntent(intent: SyncIntent, message: string): Promise<void> {
  await putSyncIntent({
    ...intent,
    status: 'queued',
    updatedAt: new Date().toISOString(),
    nextAttemptAt: null,
    lastError: message.slice(0, 500),
  });
}

function publish(result: SyncRunResult): SyncRunResult {
  broadcastSyncStatus(result);
  return result;
}

export async function processCurrentStateSync(options: CoordinatorOptions = {}): Promise<SyncRunResult> {
  const remoteStore = options.remoteStore ?? growLensRemoteStore;
  const busyResult: SyncRunResult = { status: 'busy', message: 'Another GrowLens tab is synchronizing.' };

  return withCoordinatorLock(async () => {
    if (!options.force && !isAutoSyncEnabled()) {
      return publish({ status: 'idle', message: 'Safe synchronization is disabled.' });
    }

    const intent = await getSyncIntent();
    if (!intent) return publish({ status: 'idle', message: 'No local changes are queued.' });
    if (intent.status === 'blocked') {
      return publish({ status: 'conflict', message: intent.lastError || 'Manual account resolution is required.' });
    }
    if (!options.force && !syncIntentIsDue(intent, (options.now ?? Date.now)())) {
      return publish({ status: 'queued', message: 'Synchronization is queued for a later retry.' });
    }
    if (!navigator.onLine) {
      await setWaitingIntent(intent, 'Waiting for a network connection.');
      return publish({ status: 'offline', message: 'Changes are queued until GrowLens is online.' });
    }

    publish({ status: 'queued', message: 'Checking the account copy before synchronization.' });

    try {
      const session = await remoteStore.getSession();
      if (!session.authenticated) {
        await setWaitingIntent(intent, 'Sign in to synchronize queued changes.');
        return publish({ status: 'signed-out', message: 'Changes remain queued. Sign in to synchronize them.' });
      }

      const remote = await remoteStore.pull();
      const local = loadState();
      const baseline = readSyncBaseline();
      const decision = decideSyncAction(local, remote.state, baseline, session.user.id);

      if (decision === 'match') {
        writeSyncBaseline(session.user.id, remote.revision, remote.state, remote.updatedAt);
        await clearSyncIntent();
        return publish({ status: 'synced', message: `Device and account match at revision ${remote.revision}.`, revision: remote.revision });
      }

      if (decision === 'needs-baseline') {
        await markSyncIntentBlocked('This account has no trusted sync baseline on this device. Open Account and choose how to reconcile the copies.');
        return publish({ status: 'conflict', message: 'Open Account and choose how to reconcile this device with the account copy.' });
      }

      if (decision === 'conflict') {
        await markSyncIntentBlocked('Both this device and the account changed since the last successful sync. Manual conflict resolution is required.');
        return publish({ status: 'conflict', message: 'Both copies changed. Automatic synchronization stopped without overwriting either copy.' });
      }

      if (decision === 'pull-remote') {
        saveState(remote.state, window.localStorage, 'sync');
        writeSyncBaseline(session.user.id, remote.revision, remote.state, remote.updatedAt);
        await clearSyncIntent();
        return publish({ status: 'downloaded', message: `Account revision ${remote.revision} was safely loaded because this device had not changed.`, revision: remote.revision });
      }

      const saved = await remoteStore.push(local, remote.revision, session.csrfToken);
      writeSyncBaseline(session.user.id, saved.revision, saved.state, saved.updatedAt);
      await clearSyncIntent();
      return publish({ status: 'uploaded', message: `Local changes were safely uploaded as revision ${saved.revision}.`, revision: saved.revision });
    } catch (error) {
      if (error instanceof GrowLensSyncConflictError) {
        await markSyncIntentBlocked('The server revision changed during synchronization. Open Account to compare and resolve the copies.');
        return publish({ status: 'conflict', message: 'The account changed during synchronization. No overwrite occurred.' });
      }
      const message = readableError(error);
      if (error instanceof GrowLensApiError && error.status === 401) {
        const current = await getSyncIntent();
        if (current) await setWaitingIntent(current, 'Sign in to synchronize queued changes.');
        return publish({ status: 'signed-out', message: 'Changes remain queued. Sign in again to synchronize them.' });
      }
      await markSyncIntentRetry(message);
      return publish({ status: 'error', message: `${message} Changes remain queued for retry.` });
    }
  }, busyResult);
}
