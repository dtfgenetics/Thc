import { expect, test } from '@playwright/test';

const seededState = {
  schemaVersion: 1,
  spaces: [{ id: 'space-1', name: 'Flower Tent A', environment: 'indoor', lightHours: 12, createdAt: '2026-07-01T00:00:00Z' }],
  cycles: [{ id: 'cycle-1', name: 'Blue Mango Run', spaceId: 'space-1', startDate: '2026-07-01', stage: 'flowering', status: 'active' }],
  plants: [{
    id: 'plant-1',
    name: 'BM-F3-01',
    strain: 'Blue Mango F3',
    stage: 'flowering',
    status: 'active',
    spaceId: 'space-1',
    cycleId: 'cycle-1',
    startDate: '2026-07-01',
    notes: 'Selected phenotype',
    createdAt: '2026-07-01T00:00:00Z',
  }],
  diary: [{
    id: 'entry-1',
    plantId: 'plant-1',
    cycleId: 'cycle-1',
    type: 'watering',
    title: 'Measured irrigation',
    notes: '500 mL',
    createdAt: '2026-07-13T10:00:00Z',
  }],
  tasks: [{
    id: 'task-1',
    title: 'Inspect leaf undersides',
    dueDate: '2026-07-14',
    plantId: 'plant-1',
    completed: false,
    createdAt: '2026-07-13T00:00:00Z',
  }],
  readings: [
    { id: 'reading-1', spaceId: 'space-1', temperatureC: 24, humidity: 60, ppfd: 400, createdAt: '2026-07-13T08:00:00Z' },
    { id: 'reading-2', spaceId: 'space-1', temperatureC: 26, humidity: 55, ppfd: 500, createdAt: '2026-07-13T10:00:00Z' },
    { id: 'reading-3', spaceId: 'space-1', temperatureC: 28, humidity: 50, ppfd: 600, createdAt: '2026-07-13T12:00:00Z' },
  ],
  calibrationProfiles: [],
  observations: [{
    id: 'observation-1',
    plantId: 'plant-1',
    symptoms: ['webbing'],
    notes: 'Checked upper leaf',
    possibleCauses: ['Possible pest pressure'],
    photoIds: [],
    createdAt: '2026-07-13T11:00:00Z',
  }],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: false }),
    });
  });
  await page.goto('/#/dashboard');
  await page.evaluate((state) => {
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
  }, seededState);
  await page.reload();
  await page.getByRole('button', { name: 'Open GrowLens reports and history' }).click();
  await expect(page.getByRole('dialog', { name: 'Reports & calibration' })).toBeVisible();
});

test('shows grow summary, environment trends, and a combined plant timeline', async ({ page }) => {
  const reports = page.getByRole('dialog', { name: 'Reports & calibration' });
  await expect(reports.getByText('Active plants')).toBeVisible();
  await expect(reports.locator('.reports-stat').filter({ hasText: 'Active plants' })).toContainText('1');
  await expect(reports.getByText('Measured irrigation')).toBeVisible();

  await reports.getByRole('button', { name: 'Environment' }).click();
  await expect(reports.getByRole('img', { name: 'Temperature trend' })).toBeVisible();
  await expect(reports.getByRole('img', { name: 'VPD trend' })).toBeVisible();
  await expect(reports.getByText('3 readings')).toBeVisible();

  await reports.getByRole('button', { name: 'Plant timeline' }).click();
  await expect(reports.getByText('Possible pest pressure')).toBeVisible();
  await expect(reports.getByText('Inspect leaf undersides')).toBeVisible();
  await expect(reports.getByText('Measured irrigation')).toBeVisible();
});

test('saves a median reference-meter calibration without losing grow data', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Calibration persistence is covered once on desktop.');
  const reports = page.getByRole('dialog', { name: 'Reports & calibration' });
  await reports.getByRole('button', { name: 'Calibration' }).click();
  await expect(reports.getByText('Recommended factor')).toBeVisible();
  await reports.getByLabel('Profile name', { exact: true }).fill('Tent A reference');
  await reports.getByLabel('Fixture or spectrum', { exact: true }).fill('Full spectrum fixture at 24 inches');
  await reports.getByRole('button', { name: 'Save calibration profile' }).click();
  await expect(reports.getByText(/Calibration “Tent A reference” saved/)).toBeVisible();

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    return {
      profileCount: state.calibrationProfiles?.length ?? 0,
      factor: state.calibrationProfiles?.[0]?.luxToPpfdFactor ?? 0,
      plantCount: state.plants?.length ?? 0,
      observationCount: state.observations?.length ?? 0,
    };
  })).toEqual({
    profileCount: 1,
    factor: 0.015,
    plantCount: 1,
    observationCount: 1,
  });
});

test('downloads a readings CSV with derived VPD', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Download contract is covered once on desktop.');
  const reports = page.getByRole('dialog', { name: 'Reports & calibration' });
  await reports.getByRole('button', { name: 'Exports' }).click();
  const downloadPromise = page.waitForEvent('download');
  await reports.getByRole('button', { name: 'Download readings.csv' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^growlens-readings-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('reports panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only report layout assertion.');
  const reports = page.getByRole('dialog', { name: 'Reports & calibration' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await reports.getByRole('button', { name: 'Environment' }).click();
  await expect(reports.getByRole('img', { name: 'Temperature trend' })).toBeVisible();
});
