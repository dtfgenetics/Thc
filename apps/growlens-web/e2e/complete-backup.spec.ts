import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const localPhotoId = 'photo-local-backup-12345678';
const importedPhotoId = 'photo-imported-backup-12345678';

const localState = {
  schemaVersion: 1,
  spaces: [],
  cycles: [],
  plants: [{
    id: 'plant-shared',
    name: 'Local plant name',
    strain: 'Blue Mango F3',
    stage: 'vegetative',
    status: 'active',
    spaceId: '',
    cycleId: '',
    startDate: '2026-07-13',
    notes: 'Current device version',
    createdAt: '2026-07-13T12:00:00.000Z',
  }],
  diary: [],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [{
    id: 'observation-local',
    plantId: 'plant-shared',
    symptoms: ['webbing'],
    notes: 'Local observation',
    possibleCauses: ['Possible pest pressure'],
    photoIds: [localPhotoId],
    createdAt: '2026-07-13T12:00:00.000Z',
  }],
};

function archiveDocument(options: { includeSharedPhoto?: boolean; includeNewPhoto?: boolean } = {}) {
  const photos = [];
  if (options.includeSharedPhoto) {
    photos.push({
      id: localPhotoId,
      plantId: 'plant-shared',
      observationId: 'observation-local',
      capturedAt: '2026-07-13T12:00:00.000Z',
      width: 1,
      height: 1,
      mimeType: 'image/jpeg',
      bytes: 1,
      wasUploaded: true,
      dataBase64: Buffer.from([9]).toString('base64'),
    });
  }
  if (options.includeNewPhoto) {
    photos.push({
      id: importedPhotoId,
      plantId: 'plant-shared',
      observationId: 'observation-imported',
      capturedAt: '2026-07-14T12:00:00.000Z',
      width: 1,
      height: 1,
      mimeType: 'image/jpeg',
      bytes: 2,
      wasUploaded: true,
      dataBase64: Buffer.from([7, 8]).toString('base64'),
    });
  }
  return {
    format: 'thc-growlens-complete-backup',
    version: 1,
    app: 'THC GrowLens',
    exportedAt: '2026-07-14T13:00:00.000Z',
    state: {
      ...localState,
      plants: [{ ...localState.plants[0], name: 'Imported plant name', notes: 'Imported version' }],
      tasks: [{
        id: 'task-imported',
        title: 'Imported scouting task',
        dueDate: '2026-07-15',
        plantId: 'plant-shared',
        completed: false,
        createdAt: '2026-07-14T12:00:00.000Z',
      }],
      observations: [
        ...localState.observations,
        ...(options.includeNewPhoto ? [{
          id: 'observation-imported',
          plantId: 'plant-shared',
          symptoms: ['stippling'],
          notes: 'Imported observation',
          possibleCauses: ['Possible pest pressure'],
          photoIds: [importedPhotoId],
          createdAt: '2026-07-14T12:00:00.000Z',
        }] : []),
      ],
    },
    photos,
  };
}

async function seedLocalData(page: Page): Promise<void> {
  await page.evaluate(async ({ state, photoId }) => {
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('growlens-media-v1', 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('photos')) {
          database.createObjectStore('photos', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('photos', 'readwrite');
        transaction.objectStore('photos').put({
          id: photoId,
          blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
          plantId: 'plant-shared',
          observationId: 'observation-local',
          capturedAt: '2026-07-13T12:00:00.000Z',
          width: 1,
          height: 1,
          mimeType: 'image/jpeg',
          bytes: 4,
          uploaded: true,
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, { state: localState, photoId: localPhotoId });
}

async function readPhotoBytes(page: Page): Promise<Record<string, { bytes: number[]; uploaded: boolean }>> {
  return page.evaluate(async () => {
    return new Promise<Record<string, { bytes: number[]; uploaded: boolean }>>((resolve, reject) => {
      const request = indexedDB.open('growlens-media-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('photos', 'readonly');
        const allRequest = transaction.objectStore('photos').getAll();
        allRequest.onerror = () => reject(allRequest.error);
        allRequest.onsuccess = async () => {
          const output: Record<string, { bytes: number[]; uploaded: boolean }> = {};
          for (const photo of allRequest.result) {
            output[photo.id] = {
              bytes: [...new Uint8Array(await photo.blob.arrayBuffer())],
              uploaded: photo.uploaded,
            };
          }
          resolve(output);
        };
        transaction.oncomplete = () => database.close();
      };
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: false }) });
  });
  await page.goto('/#/dashboard');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('growlens-media-v1');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await seedLocalData(page);
  await page.reload();
  await page.getByRole('button', { name: 'Open GrowLens complete backups' }).click();
  await expect(page.getByRole('dialog', { name: 'Complete backups' })).toBeVisible();
});

test('downloads a complete archive containing normalized records and local photo bytes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Archive file inspection is covered once on desktop.');
  const backup = page.getByRole('dialog', { name: 'Complete backups' });
  const downloadPromise = page.waitForEvent('download');
  await backup.getByRole('button', { name: 'Download complete backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^growlens-complete-backup-\d{4}-\d{2}-\d{2}\.growlens\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const document = JSON.parse(await readFile(path!, 'utf8'));
  expect(document).toMatchObject({
    format: 'thc-growlens-complete-backup',
    version: 1,
    state: { plants: [expect.objectContaining({ name: 'Local plant name' })] },
    photos: [expect.objectContaining({ id: localPhotoId, bytes: 4 })],
  });
  expect([...Buffer.from(document.photos[0].dataBase64, 'base64')]).toEqual([1, 2, 3, 4]);
});

test('validates before replacing records and photos', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Replace restore is covered once on desktop.');
  const backup = page.getByRole('dialog', { name: 'Complete backups' });
  const archive = archiveDocument({ includeNewPhoto: true });
  await backup.locator('input[type="file"]').setInputFiles({
    name: 'replacement.growlens.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await expect(backup.getByText('Backup validated. Nothing has been imported yet. Choose Replace or Merge.')).toBeVisible();
  await expect(backup.getByText('Validated backup')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await backup.getByRole('button', { name: 'Replace this device' }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    return { plant: state.plants?.[0]?.name, tasks: state.tasks?.length, observations: state.observations?.length };
  })).toEqual({ plant: 'Imported plant name', tasks: 1, observations: 2 });
  await expect.poll(() => readPhotoBytes(page)).toEqual({
    [importedPhotoId]: { bytes: [7, 8], uploaded: false },
  });
});

test('merges unique records and photos while retaining current device versions of matching IDs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Merge restore is covered once on desktop.');
  const backup = page.getByRole('dialog', { name: 'Complete backups' });
  const archive = archiveDocument({ includeSharedPhoto: true, includeNewPhoto: true });
  await backup.locator('input[type="file"]').setInputFiles({
    name: 'merge.growlens.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  page.once('dialog', (dialog) => dialog.accept());
  await backup.getByRole('button', { name: 'Merge with this device' }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    return { plant: state.plants?.[0]?.name, tasks: state.tasks?.length, observations: state.observations?.length };
  })).toEqual({ plant: 'Local plant name', tasks: 1, observations: 2 });
  await expect.poll(() => readPhotoBytes(page)).toEqual({
    [localPhotoId]: { bytes: [1, 2, 3, 4], uploaded: true },
    [importedPhotoId]: { bytes: [7, 8], uploaded: false },
  });
});

test('complete backup panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only backup layout assertion.');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('button', { name: 'Download complete backup' })).toBeVisible();
});
