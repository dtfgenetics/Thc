import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('creates a grow structure, diary entry, and persists after reload', async ({ page }) => {
  await page.goto('/#/grow');
  await expect(page.getByRole('heading', { name: 'Spaces, cycles, and plants' })).toBeVisible();

  const spaceSection = page.locator('section').filter({ has: page.getByRole('heading', { name: '1. Add a space' }) });
  const cycleSection = page.locator('section').filter({ has: page.getByRole('heading', { name: '2. Start a cycle' }) });
  const plantSection = page.locator('section').filter({ has: page.getByRole('heading', { name: '3. Add a plant' }) });

  await spaceSection.getByLabel('Space name', { exact: true }).fill('Test Tent');
  await spaceSection.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByText('Grow space “Test Tent” created.')).toBeVisible();

  await cycleSection.getByLabel('Cycle name', { exact: true }).fill('Foundation Cycle');
  await cycleSection.getByLabel('Grow space', { exact: true }).selectOption({ label: 'Test Tent' });
  await cycleSection.getByRole('button', { name: 'Start cycle' }).click();
  await expect(page.getByText('Cycle “Foundation Cycle” started.')).toBeVisible();

  await plantSection.getByLabel('Plant name or ID', { exact: true }).fill('BM-F3-01');
  await plantSection.getByLabel('Cultivar', { exact: true }).fill('Blue Mango F3');
  await plantSection.getByLabel('Grow space', { exact: true }).selectOption({ label: 'Test Tent' });
  await plantSection.getByLabel('Cycle', { exact: true }).selectOption({ label: 'Foundation Cycle' });
  await plantSection.getByRole('button', { name: 'Add plant' }).click();

  const plantCard = page.locator('.plant-card').filter({ hasText: 'BM-F3-01' });
  await expect(plantCard.getByRole('heading', { name: 'BM-F3-01' })).toBeVisible();
  await expect(plantCard).toContainText('Blue Mango F3');

  await page.goto('/#/diary');
  await page.getByLabel('Entry type', { exact: true }).selectOption('watering');
  await page.getByLabel('Plant', { exact: true }).selectOption({ label: 'BM-F3-01 · Blue Mango F3' });
  await page.getByLabel('Title', { exact: true }).fill('First measured irrigation');
  await page.getByLabel('Details', { exact: true }).fill('Recorded volume and runoff response.');
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
