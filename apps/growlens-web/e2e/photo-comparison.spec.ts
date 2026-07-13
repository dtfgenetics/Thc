import { expect, test } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII=',
  'base64',
);

async function resetGrowLens(page: import('@playwright/test').Page): Promise<void> {
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
}

async function capturePhoto(page: import('@playwright/test').Page, notes: string): Promise<void> {
  await page.locator('.camera-file-input input[type="file"]').setInputFiles({
    name: `${notes.toLowerCase().replace(/\s+/g, '-')}.png`,
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await expect(page.getByAltText('Prepared plant observation')).toBeVisible();
  await page.getByLabel('Context notes', { exact: true }).fill(notes);
  await page.getByRole('button', { name: 'Save photo observation' }).click();
  await expect(page.getByText('Observation saved locally. Private upload remains pending.')).toBeVisible();
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
  await resetGrowLens(page);
});

test('compares two offline observation photos in chronological order', async ({ page }) => {
  await page.getByRole('button', { name: 'Open camera observation' }).click();
  await capturePhoto(page, 'Earlier whole-plant view');
  await capturePhoto(page, 'Later whole-plant view');
  await page.getByRole('button', { name: 'Close camera observation' }).click();

  await page.getByRole('button', { name: 'Open photo history and comparison' }).click();
  const dialog = page.getByRole('dialog', { name: 'Photo history and comparison' });
  await expect(dialog).toBeVisible();

  const photoButtons = dialog.getByRole('button', { name: /Select photo from .* for comparison/ });
  await expect(photoButtons).toHaveCount(2);
  await photoButtons.nth(0).click();
  await photoButtons.nth(1).click();

  await expect(dialog.getByAltText(/Earlier observation for/)).toBeVisible();
  await expect(dialog.getByAltText(/Later observation for/)).toBeVisible();
  await expect(dialog.locator('.photo-comparison-figure figcaption > span')).toHaveText(['Earlier', 'Later']);
  await expect(dialog.getByText('Earlier whole-plant view')).toBeVisible();
  await expect(dialog.getByText('Later whole-plant view')).toBeVisible();
});

test('photo comparison panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only comparison layout assertion.');
  await page.getByRole('button', { name: 'Open photo history and comparison' }).click();
  await expect(page.getByRole('dialog', { name: 'Photo history and comparison' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
