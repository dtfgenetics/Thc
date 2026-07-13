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

  await dialog.getByLabel('Plant', { exact: true }).selectOption('plant-legacy-12345678');
  await dialog.getByLabel('Source water', { exact: true }).fill('Filtered tap');
  await dialog.getByLabel('Volume applied (mL)', { exact: true }).fill('1500');
  await dialog.getByLabel('Runoff volume (mL)', { exact: true }).fill('225');
  await dialog.getByLabel('Input pH', { exact: true }).fill('6.2');
  await dialog.getByLabel('Input EC (mS/cm)', { exact: true }).fill('1.8');
  await dialog.getByLabel('Runoff pH', { exact: true }).fill('6.4');
  await dialog.getByLabel('Runoff EC (mS/cm)', { exact: true }).fill('2.1');
  await dialog.getByRole('button', { name: 'Save irrigation' }).click();
  await expect(dialog.getByText('Irrigation record saved.')).toBeVisible();
  await expect(dialog.getByText('15% runoff')).toBeVisible();

  await dialog.getByRole('button', { name: /Reservoirs/ }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('Tent A reservoir');
  await dialog.getByLabel('Grow space', { exact: true }).selectOption('space-legacy-12345678');
  await dialog.getByLabel('Capacity (L)', { exact: true }).fill('40');
  await dialog.getByLabel('Current volume (L)', { exact: true }).fill('30');
  await dialog.getByLabel('pH', { exact: true }).fill('6.1');
  await dialog.getByLabel('EC (mS/cm)', { exact: true }).fill('1.9');
  await dialog.getByRole('button', { name: 'Save reservoir' }).click();
  await expect(dialog.getByText('Reservoir record saved.')).toBeVisible();

  await dialog.getByRole('button', { name: /Feeding/ }).click();
  await dialog.getByLabel('Plant', { exact: true }).selectOption('plant-legacy-12345678');
  await dialog.getByLabel('Water volume (mL)', { exact: true }).fill('4000');
  await dialog.getByLabel('Starting EC (mS/cm)', { exact: true }).fill('0.4');
  await dialog.getByLabel('Final EC (mS/cm)', { exact: true }).fill('1.9');
  await dialog.getByLabel('Final pH', { exact: true }).fill('6.1');
  await dialog.getByLabel('PPM', { exact: true }).fill('950');
  await dialog.getByLabel('PPM scale', { exact: true }).selectOption('500');
  await dialog.getByLabel('Products: name | amount | unit', { exact: true }).fill('Bloom A | 8 | mL\nBloom B | 8 | mL');
  await dialog.getByRole('button', { name: 'Save feeding' }).click();
  await expect(dialog.getByText('Feeding record saved.')).toBeVisible();

  await dialog.getByRole('button', { name: /Harvest/ }).click();
  await dialog.getByLabel('Plant', { exact: true }).selectOption('plant-legacy-12345678');
  await dialog.getByLabel('Lot ID', { exact: true }).fill('BM-F3-LOT-01');
  await dialog.getByLabel('Wet weight (g)', { exact: true }).fill('1000');
  await dialog.getByLabel('Dry weight (g)', { exact: true }).fill('240');
  await dialog.getByLabel('Trimmed weight (g)', { exact: true }).fill('210');
  await dialog.getByLabel('Waste/loss (g)', { exact: true }).fill('30');
  await dialog.getByRole('button', { name: 'Save harvest' }).click();
  await expect(dialog.getByText('Harvest record saved and plant marked harvested.')).toBeVisible();
  await expect(dialog.getByText('76% wet-to-dry loss')).toBeVisible();

  await dialog.getByRole('button', { name: /Outcomes/ }).click();
  await dialog.getByLabel('Observation', { exact: true }).selectOption('observation-legacy-12345678');
  await dialog.getByLabel('Outcome status', { exact: true }).selectOption('resolved');
  await dialog.getByLabel('Verified cause or conclusion', { exact: true }).fill('Spider mites verified with magnification');
  await dialog.getByLabel('Action taken', { exact: true }).fill('Removed affected leaves and increased scouting frequency.');
  await dialog.getByRole('button', { name: 'Save outcome' }).click();
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
  await dialog.getByLabel('Volume applied (mL)', { exact: true }).fill('1600');
  await dialog.getByRole('button', { name: 'Update irrigation' }).click();
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
