import { stateFingerprint } from './syncMerge';
import type { GrowLensState } from './types';

export const SYNC_METADATA_KEY = 'growlens-sync-metadata-v1';

export type SyncMetadata = {
  userId: string;
  revision: number;
  stateHash: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stateHash(value: unknown): string {
  const input = stateFingerprint(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function loadSyncMetadata(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): SyncMetadata | null {
  try {
    const raw = storage.getItem(SYNC_METADATA_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const revision = Number(parsed.revision);
    if (
      typeof parsed.userId !== 'string'
      || parsed.userId.length === 0
      || !Number.isInteger(revision)
      || revision < 0
      || typeof parsed.stateHash !== 'string'
      || parsed.stateHash.length === 0
      || typeof parsed.updatedAt !== 'string'
    ) return null;
    return {
      userId: parsed.userId,
      revision,
      stateHash: parsed.stateHash,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeSyncMetadata(
  metadata: SyncMetadata,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata));
}

export function saveSyncMetadata(
  userId: string,
  revision: number,
  state: GrowLensState,
  updatedAt: string,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): SyncMetadata {
  const metadata: SyncMetadata = {
    userId,
    revision,
    stateHash: stateHash(state),
    updatedAt,
  };
  writeSyncMetadata(metadata, storage);
  return metadata;
}

export function clearSyncMetadata(
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
): void {
  storage.removeItem(SYNC_METADATA_KEY);
}
