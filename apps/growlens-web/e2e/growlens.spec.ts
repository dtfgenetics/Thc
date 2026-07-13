import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('creates a grow structure, diary entry, and persists after reload', async ({ page }) => {
  await page.goto('/#/grow');
  await expect(page.getByRole('heading', { name: 'Spaces, cycles, and plants' })).toBeVisible();

  await page.getByLabel('Space name').fill('Test Tent');
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByText('Grow space “Test Tent” created.')).toBeVisible();

  await page.getByLabel('Cycle name').fill('Foundation Cycle');
  await page.getByLabel('Grow space').nth(1).selectOption({ label: 'Test Tent' });
  await page.getByRole('button', { name: 'Start cycle' }).click();
  await expect(page.getByText('Cycle “Foundation Cycle” started.')).toBeVisible();

  await page.getByLabel('Plant name or ID').fill('BM-F3-01');
  await page.getByLabel('Cultivar').fill('Blue Mango F3');
  await page.getByLabel('Grow space').nth(2).selectOption({ label: 'Test Tent' });
  await page.getByLabel('Cycle').selectOption({ label: 'Foundation Cycle' });
  await page.getByRole('button', { name: 'Add plant' }).click();

  await expect(page.getByRole('heading', { name: 'BM-F3-01' })).toBeVisible();
  await expect(page.getByText('Blue Mango F3')).toBeVisible();

  await page.goto('/#/diary');
  await page.getByLabel('Entry type').selectOption('watering');
  await page.getByLabel('Plant').selectOption({ label: 'BM-F3-01 · Blue Mango F3' });
  await page.getByLabel('Title').fill('First measured irrigation');
  await page.getByLabel('Details').fill('Recorded volume and runoff response.');
  await page.getByRole('button', { name: 'Save entry' }).click();

  await expect(page.getByRole('heading', { name: 'First measured irrigation' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'First measured irrigation' })).toBeVisible();
});

test('renders the core mobile navigation without horizontal overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only layout assertion');
  await page.goto('/#/dashboard');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
