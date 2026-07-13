import { describe, expect, it } from 'vitest';
import {
  COMPLETE_BACKUP_FORMAT,
  COMPLETE_BACKUP_VERSION,
  mergeCompleteBackup,
  parseCompleteBackup,
  serializeCompleteBackup,
} from './completeBackup';
import type { LocalPhotoAsset } from './photoStore';
import { emptyState } from './storage';

const photo: LocalPhotoAsset = {
  id: 'photo-backup-test-12345678',
  blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
  plantId: 'plant-1',
  observationId: 'observation-1',
  capturedAt: '2026-07-13T12:00:00.000Z',
  width: 800,
  height: 600,
  mimeType: 'image/jpeg',
  bytes: 4,
  uploaded: true,
};

const state = {
  ...structuredClone(emptyState),
  plants: [{
    id: 'plant-1',
    name: 'BM-F3-01',
    strain: 'Blue Mango F3',
    stage: 'vegetative' as const,
    status: 'active' as const,
    spaceId: 'space-1',
    cycleId: '',
    startDate: '2026-07-13',
    notes: '',
    createdAt: '2026-07-13T12:00:00.000Z',
  }],
  observations: [{
    id: 'observation-1',
    plantId: 'plant-1',
    symptoms: ['webbing'],
    notes: 'Local evidence',
    possibleCauses: ['Possible pest pressure'],
    photoIds: [photo.id],
    createdAt: '2026-07-13T12:00:00.000Z',
  }],
};

describe('GrowLens complete backups', () => {
  it('round-trips state and photo bytes through the versioned archive', async () => {
    const serialized = await serializeCompleteBackup(state, [photo]);
    const parsed = await parseCompleteBackup(serialized);

    expect(JSON.parse(serialized)).toMatchObject({
      format: COMPLETE_BACKUP_FORMAT,
      version: COMPLETE_BACKUP_VERSION,
      app: 'THC GrowLens',
    });
    expect(parsed.state).toEqual(state);
    expect(parsed.summary).toEqual({ records: 2, photos: 1, photoBytes: 4 });
    expect(parsed.photos[0]).toMatchObject({
      id: photo.id,
      observationId: photo.observationId,
      bytes: 4,
      uploaded: false,
    });
    expect([...new Uint8Array(await parsed.photos[0].blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it('rejects unsupported formats before import', async () => {
    await expect(parseCompleteBackup(JSON.stringify({
      format: 'other-backup',
      version: 1,
      exportedAt: '2026-07-13T12:00:00.000Z',
      state: emptyState,
      photos: [],
    }))).rejects.toThrow('not a supported GrowLens complete backup');
  });

  it('rejects duplicate photo IDs and byte-length mismatches', async () => {
    const valid = JSON.parse(await serializeCompleteBackup(state, [photo]));
    valid.photos.push(valid.photos[0]);
    await expect(parseCompleteBackup(JSON.stringify(valid))).rejects.toThrow('duplicate photo ID');

    const mismatched = JSON.parse(await serializeCompleteBackup(state, [photo]));
    mismatched.photos[0].bytes = 10;
    await expect(parseCompleteBackup(JSON.stringify(mismatched))).rejects.toThrow('byte-length check');
  });

  it('merges unique imported records and photos while keeping local versions of matching IDs', async () => {
    const importedState = {
      ...state,
      plants: [{ ...state.plants[0], name: 'Imported version' }],
      tasks: [{
        id: 'task-imported',
        title: 'Imported task',
        dueDate: '2026-07-14',
        plantId: 'plant-1',
        completed: false,
        createdAt: '2026-07-13T12:00:00.000Z',
      }],
    };
    const importedPhoto = { ...photo, blob: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }), bytes: 1, uploaded: false };
    const imported = await parseCompleteBackup(await serializeCompleteBackup(importedState, [importedPhoto]));
    const merged = mergeCompleteBackup(state, [photo], imported);

    expect(merged.state.plants[0].name).toBe('BM-F3-01');
    expect(merged.state.tasks[0].id).toBe('task-imported');
    expect([...new Uint8Array(await merged.photos[0].blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });
});
