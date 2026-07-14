import { expect, test } from '@playwright/test';

const timestamp = '2026-07-13T12:00:00.000Z';
const seededState = {
  schemaVersion: 2,
  spaces: [
    { id: 'space-one-12345678', name: 'Flower Tent A', environment: 'indoor', lightHours: 12, createdAt: timestamp },
    { id: 'space-two-12345678', name: 'Flower Tent B', environment: 'indoor', lightHours: 12, createdAt: timestamp },
  ],
  cycles: [
    { id: 'cycle-one-12345678', name: 'Blue Mango Run', spaceId: 'space-one-12345678', startDate: '2026-06-01', stage: 'flowering', status: 'active' },
    { id: 'cycle-two-12345678', name: 'Cali Orange Run', spaceId: 'space-two-12345678', startDate: '2026-06-15', stage: 'flowering', status: 'active' },
  ],
  plants: [
    { id: 'plant-one-12345678', name: 'BM-01', strain: 'Blue Mango F3', stage: 'complete', status: 'harvested', spaceId: 'space-one-12345678', cycleId: 'cycle-one-12345678', startDate: '2026-06-01', notes: '', createdAt: timestamp },
    { id: 'plant-two-12345678', name: 'BM-02', strain: 'Blue Mango F3', stage: 'flowering', status: 'active', spaceId: 'space-one-12345678', cycleId: 'cycle-one-12345678', startDate: '2026-06-01', notes: '', createdAt: timestamp },
    { id: 'plant-three-12345678', name: 'CO-01', strain: 'Cali Orange F2', stage: 'flowering', status: 'active', spaceId: 'space-two-12345678', cycleId: 'cycle-two-12345678', startDate: '2026-06-15', notes: '', createdAt: timestamp },
  ],
  diary: [], tasks: [], readings: [], calibrationProfiles: [],
  observations: [
    { id: 'observation-one-12345678', plantId: 'plant-one-12345678', symptoms: ['webbing'], notes: '', possibleCauses: ['Possible pest pressure'], photoIds: [], createdAt: timestamp },
    { id: 'observation-two-12345678', plantId: 'plant-two-12345678', symptoms: ['spots'], notes: '', possibleCauses: ['Possible stress'], photoIds: [], createdAt: timestamp },
  ],
  irrigationRecords: [
    { id: 'irrigation-one-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', spaceId: 'space-one-12345678', sourceWater: 'RO', volumeAppliedMl: 1500, runoffVolumeMl: 225, inputPh: 6.2, inputEcMsCm: 1.8, runoffPh: 6.4, runoffEcMsCm: 2.1, substrateMoisturePercent: null, drybackPercent: null, irrigationTimeMinutes: null, reservoirId: null, recipeNotes: '', productsUsed: [], createdAt: timestamp, updatedAt: timestamp },
    { id: 'irrigation-two-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', spaceId: 'space-one-12345678', sourceWater: 'RO', volumeAppliedMl: 1500, runoffVolumeMl: 300, inputPh: 6.1, inputEcMsCm: 1.9, runoffPh: 6.3, runoffEcMsCm: 2.0, substrateMoisturePercent: null, drybackPercent: null, irrigationTimeMinutes: null, reservoirId: null, recipeNotes: '', productsUsed: [], createdAt: timestamp, updatedAt: timestamp },
    { id: 'irrigation-three-12345678', plantId: 'plant-two-12345678', cycleId: 'cycle-one-12345678', spaceId: 'space-one-12345678', sourceWater: 'RO', volumeAppliedMl: 1000, runoffVolumeMl: null, inputPh: 6.2, inputEcMsCm: 1.7, runoffPh: null, runoffEcMsCm: null, substrateMoisturePercent: null, drybackPercent: null, irrigationTimeMinutes: null, reservoirId: null, recipeNotes: '', productsUsed: [], createdAt: timestamp, updatedAt: timestamp },
  ],
  feedingRecords: [{ id: 'feeding-one-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', reservoirId: null, waterVolumeMl: 3000, sourceWater: 'RO', startingEcMsCm: 0.2, finalEcMsCm: 1.9, finalPh: 6.1, ppm: 950, ppmScale: 500, products: [], additives: [], mixingNotes: '', createdAt: timestamp, updatedAt: timestamp }],
  reservoirRecords: [],
  harvestRecords: [{ id: 'harvest-one-12345678', plantId: 'plant-one-12345678', cycleId: 'cycle-one-12345678', lotId: 'LOT-01', harvestDate: '2026-07-10', wetWeightG: 1000, dryWeightG: 240, trimmedWeightG: 210, wasteWeightG: 30, dryingTemperatureC: 18, dryingHumidity: 60, dryingDays: 10, cureStartedAt: timestamp, cureCheckpoints: [], finalPhotoIds: [], notes: '', createdAt: timestamp, updatedAt: timestamp }],
  observationOutcomes: [
    { id: 'outcome-one-12345678', observationId: 'observation-one-12345678', plantId: 'plant-one-12345678', status: 'resolved', verifiedCause: 'Spider mites', actionTaken: '', outcomeNotes: '', resolvedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
    { id: 'outcome-two-12345678', observationId: 'observation-two-12345678', plantId: 'plant-two-12345678', status: 'monitoring', verifiedCause: '', actionTaken: '', outcomeNotes: '', resolvedAt: null, createdAt: timestamp, updatedAt: timestamp },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: false }) });
  });
  await page.goto('/#/dashboard');
  await page.evaluate((state) => localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state)), seededState);
  await page.reload();
  await page.getByRole('button', { name: 'Open cultivation analytics' }).click();
  await expect(page.getByRole('dialog', { name: 'Cultivation analytics' })).toBeVisible();
});

test('shows measured overview and grouped comparisons', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Full analytics flow is covered once on desktop.');
  const dialog = page.getByRole('dialog', { name: 'Cultivation analytics' });
  const metrics = dialog.locator('.analytics-metrics');
  await expect(metrics.getByText('4 L', { exact: true })).toBeVisible();
  await expect(metrics.getByText('17.5%', { exact: true })).toBeVisible();
  await expect(metrics.getByText('210 g', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/do not prove that a treatment/i)).toBeVisible();
  await expect(dialog.getByText('Blue Mango F3', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Cycles' }).click();
  await expect(dialog.getByText('Blue Mango Run', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Cali Orange Run', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Spaces' }).click();
  await expect(dialog.getByText('Flower Tent A', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Flower Tent B', { exact: true })).toBeVisible();
});

test('filters plant analytics and downloads the plant dataset', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Download and filter contract is covered once on desktop.');
  const dialog = page.getByRole('dialog', { name: 'Cultivation analytics' });
  await dialog.getByRole('button', { name: 'Plants' }).click();
  await dialog.getByLabel('Search plants', { exact: true }).fill('Cali Orange');
  await expect(dialog.getByText('CO-01', { exact: true })).toBeVisible();
  await expect(dialog.getByText('BM-01', { exact: true })).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download analytics CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^growlens-plant-analytics-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('analytics panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only analytics layout assertion.');
  const dialog = page.getByRole('dialog', { name: 'Cultivation analytics' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await dialog.getByRole('button', { name: 'Plants' }).click();
  await expect(dialog.getByLabel('Search plants', { exact: true })).toBeVisible();
});
