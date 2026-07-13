import { expect, test } from '@playwright/test';

const legacyState = {
  schemaVersion: 1,
  spaces: [{ id: 'space-legacy-12345678', name: 'Flower Tent A', environment: 'indoor', lightHours: 12, createdAt: '2026-07-01T00:00:00.000Z' }],
  cycles: [{ id: 'cycle-legacy-12345678', name: 'Blue Mango Run', spaceId: 'space-legacy-12345678', startDate: '2026-07-01', stage: 'flowering', status: 'active' }],
  plants: [{ id: 'plant-legacy-12345678', name: 'BM-F3-01', strain: 'Blue Mango F3', stage: 'flowering', status: 'active', spaceId: 'space-legacy-12345678', cycleId: 'cycle-legacy-12345678', startDate: '2026-07-01', notes: '', createdAt: '2026-07-01T00:00:00.000Z' }],
  diary: [{ id: 'entry-legacy-12345678', plantId: 'plant-legacy-12345678', cycleId: 'cycle-legacy-12345678', type: 'note', title: 'Legacy diary entry', notes: 'Must survive migration', createdAt: '2026-07-01T00:00:00.000Z' }],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [{ id: 'observation-legacy-12345678', plantId: 'plant-legacy-12345678', symptoms: ['webbing'], notes: 'Fine webbing under leaf', possibleCauses: ['Possible pest pressure'], photoIds: [], createdAt: '2026-07-10T00:00:00.000Z' }],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: false }) });
  });
  await page.goto('/#/dashboard');
  await page.evaluate((state) => {
    localStorage.clear();
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
  }, legacyState);
  await page.reload();
});

test('migrates legacy data and records irrigation, feeding, reservoir, harvest, and outcome history', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Full structured-record workflow is covered once on desktop.');
  await page.getByRole('button', { name: 'Open structured cultivation records' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cultivation records' });
  await expect(dialog).toBeVisible();

  let form = dialog.locator('.cultivation-form');
  await form.locator('select').nth(0).selectOption('plant-legacy-12345678');
  await form.getByLabel('Source water', { exact: true }).fill('Filtered tap');
  await form.getByLabel('Volume applied (mL)', { exact: true }).fill('1500');
  await form.getByLabel('Runoff volume (mL)', { exact: true }).fill('225');
  await form.getByLabel('Input pH', { exact: true }).fill('6.2');
  await form.getByLabel('Input EC (mS/cm)', { exact: true }).fill('1.8');
  await form.getByLabel('Runoff pH', { exact: true }).fill('6.4');
  await form.getByLabel('Runoff EC (mS/cm)', { exact: true }).fill('2.1');
  await form.getByRole('button', { name: 'Save irrigation' }).click();
  await expect(dialog.getByText('Irrigation record saved.')).toBeVisible();
  await expect(dialog.getByText('15% runoff')).toBeVisible();

  await dialog.getByRole('button', { name: /Reservoirs/ }).click();
  form = dialog.locator('.cultivation-form');
  await form.getByLabel('Name', { exact: true }).fill('Tent A reservoir');
  await form.locator('select').nth(0).selectOption('space-legacy-12345678');
  await form.getByLabel('Capacity (L)', { exact: true }).fill('40');
  await form.getByLabel('Current volume (L)', { exact: true }).fill('30');
  await form.getByLabel('pH', { exact: true }).fill('6.1');
  await form.getByLabel('EC (mS/cm)', { exact: true }).fill('1.9');
  await form.getByRole('button', { name: 'Save reservoir' }).click();
  await expect(dialog.getByText('Reservoir record saved.')).toBeVisible();

  await dialog.getByRole('button', { name: /Feeding/ }).click();
  form = dialog.locator('.cultivation-form');
  await form.locator('select').nth(0).selectOption('plant-legacy-12345678');
  await form.getByLabel('Water volume (mL)', { exact: true }).fill('4000');
  await form.getByLabel('Starting EC (mS/cm)', { exact: true }).fill('0.4');
  await form.getByLabel('Final EC (mS/cm)', { exact: true }).fill('1.9');
  await form.getByLabel('Final pH', { exact: true }).fill('6.1');
  await form.getByLabel('PPM', { exact: true }).fill('950');
  await form.locator('select').nth(2).selectOption('500');
  await form.getByLabel('Products: name | amount | unit', { exact: true }).fill('Bloom A | 8 | mL\nBloom B | 8 | mL');
  await form.getByRole('button', { name: 'Save feeding' }).click();
  await expect(dialog.getByText('Feeding record saved.')).toBeVisible();

  await dialog.getByRole('button', { name: /Harvest/ }).click();
  form = dialog.locator('.cultivation-form');
  await form.locator('select').nth(0).selectOption('plant-legacy-12345678');
  await form.getByLabel('Lot ID', { exact: true }).fill('BM-F3-LOT-01');
  await form.getByLabel('Wet weight (g)', { exact: true }).fill('1000');
  await form.getByLabel('Dry weight (g)', { exact: true }).fill('240');
  await form.getByLabel('Trimmed weight (g)', { exact: true }).fill('210');
  await form.getByLabel('Waste/loss (g)', { exact: true }).fill('30');
  await form.getByRole('button', { name: 'Save harvest' }).click();
  await expect(dialog.getByText('Harvest record saved and plant marked harvested.')).toBeVisible();
  await expect(dialog.getByText('76% wet-to-dry loss')).toBeVisible();

  await dialog.getByRole('button', { name: /Outcomes/ }).click();
  form = dialog.locator('.cultivation-form');
  await form.locator('select').nth(0).selectOption('observation-legacy-12345678');
  await form.locator('select').nth(1).selectOption('resolved');
  await form.getByLabel('Verified cause or conclusion', { exact: true }).fill('Spider mites verified with magnification');
  await form.getByLabel('Action taken', { exact: true }).fill('Removed affected leaves and increased scouting frequency.');
  await form.getByRole('button', { name: 'Save outcome' }).click();
  await expect(dialog.getByText('Observation outcome saved.')).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}'));
  expect(stored.schemaVersion).toBe(2);
  expect(stored.diary).toHaveLength(1);
  expect(stored.diary[0].title).toBe('Legacy diary entry');
  expect(stored.irrigationRecords).toHaveLength(1);
  expect(stored.feedingRecords).toHaveLength(1);
  expect(stored.reservoirRecords).toHaveLength(1);
  expect(stored.harvestRecords).toHaveLength(1);
  expect(stored.observationOutcomes).toHaveLength(1);
  expect(stored.plants[0].status).toBe('harvested');

  await dialog.getByRole('button', { name: /Irrigation/ }).click();
  await dialog.getByRole('button', { name: 'Edit' }).first().click();
  form = dialog.locator('.cultivation-form');
  await form.getByLabel('Volume applied (mL)', { exact: true }).fill('1600');
  await form.getByRole('button', { name: 'Update irrigation' }).click();
  await expect(dialog.getByText('Irrigation record updated.')).toBeVisible();

  await page.reload();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}'));
  expect(reloaded.irrigationRecords).toHaveLength(1);
  expect(reloaded.irrigationRecords[0].volumeAppliedMl).toBe(1600);
  expect(reloaded.harvestRecords[0].lotId).toBe('BM-F3-LOT-01');
});

test('structured cultivation panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only layout assertion.');
  await page.getByRole('button', { name: 'Open structured cultivation records' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cultivation records' });
  await expect(dialog).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await dialog.getByRole('button', { name: /Harvest/ }).click();
  await expect(dialog.getByLabel('Harvest date', { exact: true })).toBeVisible();
});
