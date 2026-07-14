import { describe, expect, it } from 'vitest';
import { emptyState } from './storage';
import {
  clearSyncBaseline,
  decideSyncAction,
  readSyncBaseline,
  syncIntentIsDue,
  writeSyncBaseline,
  type SyncIntent,
} from './syncIntentQueue';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
}

const base = structuredClone(emptyState);
const changedLocal = { ...structuredClone(emptyState), diary: [{ id: 'entry-local-12345678', plantId: null, cycleId: null, type: 'note' as const, title: 'Local', notes: '', createdAt: '2026-07-13T00:00:00.000Z' }] };
const changedRemote = { ...structuredClone(emptyState), tasks: [{ id: 'task-remote-12345678', title: 'Remote', dueDate: '2026-07-14', plantId: null, completed: false, createdAt: '2026-07-13T00:00:00.000Z' }] };

describe('safe synchronization decisions', () => {
  it('records and clears a trusted account baseline', () => {
    const storage = memoryStorage();
    const baseline = writeSyncBaseline('user-1', 4, base, '2026-07-13T00:00:00.000Z', storage);
    expect(readSyncBaseline(storage)).toEqual(baseline);
    clearSyncBaseline(storage);
    expect(readSyncBaseline(storage)).toBeNull();
  });

  it('treats equal copies as synchronized without requiring a baseline', () => {
    expect(decideSyncAction(base, base, null, 'user-1')).toBe('match');
  });

  it('requires manual reconciliation before trusting a different account or missing baseline', () => {
    const storage = memoryStorage();
    const baseline = writeSyncBaseline('user-1', 1, base, '2026-07-13T00:00:00.000Z', storage);
    expect(decideSyncAction(changedLocal, base, null, 'user-1')).toBe('needs-baseline');
    expect(decideSyncAction(changedLocal, base, baseline, 'user-2')).toBe('needs-baseline');
  });

  it('uploads only when the local copy alone changed', () => {
    const storage = memoryStorage();
    const baseline = writeSyncBaseline('user-1', 2, base, '2026-07-13T00:00:00.000Z', storage);
    expect(decideSyncAction(changedLocal, base, baseline, 'user-1')).toBe('push-local');
  });

  it('downloads only when the remote copy alone changed', () => {
    const storage = memoryStorage();
    const baseline = writeSyncBaseline('user-1', 2, base, '2026-07-13T00:00:00.000Z', storage);
    expect(decideSyncAction(base, changedRemote, baseline, 'user-1')).toBe('pull-remote');
  });

  it('blocks instead of overwriting when both copies changed', () => {
    const storage = memoryStorage();
    const baseline = writeSyncBaseline('user-1', 2, base, '2026-07-13T00:00:00.000Z', storage);
    expect(decideSyncAction(changedLocal, changedRemote, baseline, 'user-1')).toBe('conflict');
  });

  it('honors queued retry timestamps and permanent conflict blocks', () => {
    const queued: SyncIntent = {
      id: 'current-state', queuedAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z',
      attempts: 1, status: 'queued', nextAttemptAt: '2026-07-13T00:10:00.000Z', lastError: 'offline',
    };
    expect(syncIntentIsDue(queued, new Date('2026-07-13T00:09:59.000Z').getTime())).toBe(false);
    expect(syncIntentIsDue(queued, new Date('2026-07-13T00:10:00.000Z').getTime())).toBe(true);
    expect(syncIntentIsDue({ ...queued, status: 'blocked', nextAttemptAt: null })).toBe(false);
  });
});
