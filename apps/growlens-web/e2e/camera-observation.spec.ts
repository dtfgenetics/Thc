import { expect, test } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII=',
  'base64',
);

const emptyState = {
  schemaVersion: 1,
  spaces: [],
  cycles: [],
  plants: [],
  diary: [],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [],
};

async function readLocalPhotoCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const request = indexedDB.open('growlens-media-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('photos', 'readonly');
        const countRequest = transaction.objectStore('photos').count();
        countRequest.onerror = () => reject(countRequest.error);
        countRequest.onsuccess = () => resolve(countRequest.result);
        transaction.oncomplete = () => database.close();
      };
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: false }),
    });
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
  await page.reload();
});

test('compresses and saves a photo observation offline', async ({ page }) => {
  await page.getByRole('button', { name: 'Open camera observation' }).click();
  await expect(page.getByRole('dialog', { name: 'Camera observation' })).toBeVisible();

  await page.locator('.camera-file-input input[type="file"]').setInputFiles({
    name: 'plant.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });

  await expect(page.getByAltText('Prepared plant observation')).toBeVisible();
  await expect(page.getByText(/metadata removed by re-encoding/i)).toBeVisible();
  await page.getByText('Fine webbing is present', { exact: true }).click();
  await page.getByLabel('Context notes', { exact: true }).fill('Webbing seen beneath one upper fan leaf.');
  await page.getByRole('button', { name: 'Save photo observation' }).click();

  await expect(page.getByText('Observation saved locally. Private upload remains pending.')).toBeVisible();
  await expect(page.getByText('Upload pending')).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}'));
  expect(saved.observations).toHaveLength(1);
  expect(saved.observations[0].photoIds).toHaveLength(1);
  expect(saved.observations[0].symptoms).toContain('webbing');
  expect(saved.diary[0]).toMatchObject({ type: 'photo', title: 'Photo observation' });
  expect(await readLocalPhotoCount(page)).toBe(1);
});

test('uploads a processed observation privately with session CSRF protection', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Private upload contract is covered once on desktop.');
  let uploadHeader = '';
  let uploadContentType = '';

  await page.unroute('**/api/session.php');
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        authenticated: true,
        user: { id: 'user-test', email: 'grower@example.com', createdAt: '2026-07-13T00:00:00Z' },
        csrfToken: 'csrf-photo-test',
        revision: 0,
        updatedAt: '2026-07-13T00:00:00Z',
      }),
    });
  });
  await page.route('**/api/sync.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        user: { id: 'user-test', email: 'grower@example.com', createdAt: '2026-07-13T00:00:00Z' },
        revision: 0,
        updatedAt: '2026-07-13T00:00:00Z',
        state: emptyState,
      }),
    });
  });
  await page.route('**/api/upload-image.php', async (route) => {
    uploadHeader = route.request().headers()['x-csrf-token'] ?? '';
    uploadContentType = route.request().headers()['content-type'] ?? '';
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        image: {
          id: 'photo-test',
          plantId: null,
          observationId: 'observation-test',
          capturedAt: '2026-07-13T00:00:00Z',
          mimeType: 'image/jpeg',
          width: 1,
          height: 1,
          bytes: 100,
          createdAt: '2026-07-13T00:00:00Z',
        },
      }),
    });
  });

  await page.reload();
  await page.getByRole('button', { name: 'Open camera observation' }).click();
  await page.locator('.camera-file-input input[type="file"]').setInputFiles({
    name: 'plant.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await expect(page.getByAltText('Prepared plant observation')).toBeVisible();
  await page.getByRole('button', { name: 'Save photo observation' }).click();

  await expect.poll(async () => ({
    messages: await page.locator('.camera-panel .account-message').allTextContents(),
    uploadHeader,
    uploadContentType,
  }), {
    message: 'Expected private image upload, CSRF header, multipart body, and uploaded status message.',
    timeout: 7_000,
  }).toMatchObject({
    messages: expect.arrayContaining(['Observation saved locally and uploaded privately.']),
    uploadHeader: 'csrf-photo-test',
    uploadContentType: expect.stringContaining('multipart/form-data'),
  });

  await expect(page.getByText('Private copy uploaded')).toBeVisible();
});

test('camera observation panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only camera layout assertion.');
  await page.getByRole('button', { name: 'Open camera observation' }).click();
  await expect(page.getByRole('dialog', { name: 'Camera observation' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
