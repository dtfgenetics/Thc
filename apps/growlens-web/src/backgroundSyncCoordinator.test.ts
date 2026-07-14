import { describe, expect, it, vi } from 'vitest';
import { attemptSafeSync, retryDelayMs } from './backgroundSyncCoordinator';
import { emptyState } from './storage';
import { stateHash, type SyncMetadata } from './syncMetadata';
import type { SyncIntent } from './syncIntentStore';
import type { GrowLensState } from './types';

const user = { id: 'user-12345678', email: 'grower@example.com', createdAt: '2026-07-13T00:00:00.000Z' };
const timestamp = '2026-07-13T12:00:00.000Z';

function stateWithNote(title: string): GrowLensState {
  return {
    ...structuredClone(emptyState),
    diary: [{
      id: `entry-${title.toLowerCase().replace(/\s+/g, '-')}`,
      plantId: null,
      cycleId: null,
      type: 'note',
      title,
      notes: '',
      createdAt: timestamp,
    }],
  };
}

function baseline(state: GrowLensState, revision = 2): SyncMetadata {
  return { userId: user.id, revision, stateHash: stateHash(state), updatedAt: timestamp };
}

function intent(metadata: SyncMetadata, localState: GrowLensState): SyncIntent {
  return {
    id: 'latest',
    userId: metadata.userId,
    baseRevision: metadata.revision,
    baseStateHash: metadata.stateHash,
    localStateHash: stateHash(localState),
    status: 'pending',
    retryCount: 0,
    nextAttemptAt: timestamp,
    lastError: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('attemptSafeSync', () => {
  it('uploads local changes only when the remote copy still matches the reconciled baseline', async () => {
    const remoteState = structuredClone(emptyState);
    const localState = stateWithNote('Local update');
    const metadata = baseline(remoteState);
    const push = vi.fn().mockResolvedValue({ revision: 3, updatedAt: timestamp, state: localState });
    const remoteStore = {
      getSession: vi.fn().mockResolvedValue({ authenticated: true, user, csrfToken: 'csrf-safe', revision: 2, updatedAt: timestamp }),
      pull: vi.fn().mockResolvedValue({ user, revision: 2, updatedAt: timestamp, state: remoteState }),
      push,
    };

    const result = await attemptSafeSync({ intent: intent(metadata, localState), metadata, localState, remoteStore });

    expect(result.status).toBe('synced');
    expect(result.metadata).toMatchObject({ userId: user.id, revision: 3, stateHash: stateHash(localState) });
    expect(push).toHaveBeenCalledWith(localState, 2, 'csrf-safe');
  });

  it('blocks instead of overwriting when another device advanced the remote revision', async () => {
    const baselineState = structuredClone(emptyState);
    const localState = stateWithNote('Device update');
    const remoteState = stateWithNote('Other device update');
    const metadata = baseline(baselineState);
    const push = vi.fn();
    const remoteStore = {
      getSession: vi.fn().mockResolvedValue({ authenticated: true, user, csrfToken: 'csrf-safe', revision: 3, updatedAt: timestamp }),
      pull: vi.fn().mockResolvedValue({ user, revision: 3, updatedAt: timestamp, state: remoteState }),
      push,
    };

    const result = await attemptSafeSync({ intent: intent(metadata, localState), metadata, localState, remoteStore });

    expect(result.status).toBe('blocked-conflict');
    expect(push).not.toHaveBeenCalled();
  });

  it('refreshes the baseline without uploading when local and remote already match', async () => {
    const state = stateWithNote('Matching state');
    const metadata = baseline(structuredClone(emptyState), 1);
    const push = vi.fn();
    const remoteStore = {
      getSession: vi.fn().mockResolvedValue({ authenticated: true, user, csrfToken: 'csrf-safe', revision: 5, updatedAt: timestamp }),
      pull: vi.fn().mockResolvedValue({ user, revision: 5, updatedAt: timestamp, state }),
      push,
    };

    const result = await attemptSafeSync({ intent: intent(metadata, state), metadata, localState: state, remoteStore });

    expect(result.status).toBe('noop');
    expect(result.metadata).toMatchObject({ revision: 5, stateHash: stateHash(state) });
    expect(push).not.toHaveBeenCalled();
  });

  it('blocks when the authenticated account is unavailable or changed', async () => {
    const state = stateWithNote('Pending');
    const metadata = baseline(structuredClone(emptyState));
    const pull = vi.fn();
    const result = await attemptSafeSync({
      intent: intent(metadata, state),
      metadata,
      localState: state,
      remoteStore: {
        getSession: vi.fn().mockResolvedValue({ authenticated: false }),
        pull,
        push: vi.fn(),
      },
    });

    expect(result.status).toBe('blocked-auth');
    expect(pull).not.toHaveBeenCalled();
  });

  it('returns a retry result for temporary network failures', async () => {
    const state = stateWithNote('Pending');
    const metadata = baseline(structuredClone(emptyState));
    const result = await attemptSafeSync({
      intent: intent(metadata, state),
      metadata,
      localState: state,
      remoteStore: {
        getSession: vi.fn().mockRejectedValue(new Error('Network offline')),
        pull: vi.fn(),
        push: vi.fn(),
      },
    });

    expect(result).toMatchObject({ status: 'retry', message: 'Network offline' });
  });
});

describe('retryDelayMs', () => {
  it('uses bounded exponential retry delays', () => {
    expect(retryDelayMs(0)).toBe(5_000);
    expect(retryDelayMs(1)).toBe(10_000);
    expect(retryDelayMs(20)).toBe(300_000);
  });
});
