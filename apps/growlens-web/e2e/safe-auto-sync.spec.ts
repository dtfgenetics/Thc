import { expect, test } from '@playwright/test';

const timestamp = '2026-07-13T12:00:00.000Z';
const user = { id: 'user-safe-sync', email: 'grower@example.com', createdAt: timestamp };

const emptyState = {
  schemaVersion: 2,
  spaces: [],
  cycles: [],
  plants: [],
  diary: [],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [],
  irrigationRecords: [],
  feedingRecords: [],
  reservoirRecords: [],
  harvestRecords: [],
  observationOutcomes: [],
};

async function seedAutoSync(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((state) => {
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
    localStorage.setItem('growlens-safe-auto-sync-enabled-v1', 'true');
    localStorage.removeItem('growlens-sync-metadata-v1');
  }, emptyState);
}

async function addLocalDiaryEntry(page: import('@playwright/test').Page, title: string): Promise<void> {
  await page.evaluate(({ title, timestamp }) => {
    const key = 'thc-growlens-state-v1';
    const state = JSON.parse(localStorage.getItem(key) ?? '{}');
    state.diary = [...(state.diary ?? []), {
      id: `entry-${title.toLowerCase().replace(/\s+/g, '-')}`,
      plantId: null,
      cycleId: null,
      type: 'note',
      title,
      notes: '',
      createdAt: timestamp,
    }];
    localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('growlens:state-saved', {
      detail: { source: 'external', savedAt: timestamp },
    }));
  }, { title, timestamp });
}

test('automatically uploads a local change only while the remote copy matches the saved baseline', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The complete automatic synchronization contract is covered once on desktop.');
  let remoteRevision = 2;
  let remoteState: Record<string, unknown> = structuredClone(emptyState);
  let uploadedBody: Record<string, unknown> | null = null;
  let csrfHeader = '';

  await seedAutoSync(page);
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: true, user, csrfToken: 'csrf-safe-sync', revision: remoteRevision, updatedAt: timestamp }),
    });
  });
  await page.route('**/api/sync.php', async (route) => {
    if (route.request().method() === 'POST') {
      uploadedBody = route.request().postDataJSON() as Record<string, unknown>;
      csrfHeader = route.request().headers()['x-csrf-token'] ?? '';
      remoteState = uploadedBody.state as Record<string, unknown>;
      remoteRevision += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, revision: remoteRevision, updatedAt: timestamp, state: remoteState }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, user, revision: remoteRevision, updatedAt: timestamp, state: remoteState }),
    });
  });

  await page.goto('/#/dashboard');
  await expect(page.locator('.safe-sync-launcher strong')).toHaveText('Auto-sync ready', { timeout: 10_000 });

  await addLocalDiaryEntry(page, 'Automatic upload proof');

  await expect.poll(() => uploadedBody, { timeout: 10_000 }).not.toBeNull();
  expect(csrfHeader).toBe('csrf-safe-sync');
  expect(uploadedBody).toMatchObject({
    expectedRevision: 2,
    state: {
      schemaVersion: 2,
      diary: [expect.objectContaining({ title: 'Automatic upload proof' })],
    },
  });
  await expect(page.locator('.safe-sync-launcher strong')).toHaveText('Auto-sync ready');
});

test('blocks automatic upload when another device changed the account revision', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The conflict contract is covered once on desktop.');
  let remoteRevision = 2;
  let remoteState: Record<string, unknown> = structuredClone(emptyState);
  let postCount = 0;

  await seedAutoSync(page);
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: true, user, csrfToken: 'csrf-safe-sync', revision: remoteRevision, updatedAt: timestamp }),
    });
  });
  await page.route('**/api/sync.php', async (route) => {
    if (route.request().method() === 'POST') {
      postCount += 1;
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, conflict: true, revision: remoteRevision, updatedAt: timestamp, error: 'Sync conflict.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, user, revision: remoteRevision, updatedAt: timestamp, state: remoteState }),
    });
  });

  await page.goto('/#/dashboard');
  await expect(page.locator('.safe-sync-launcher strong')).toHaveText('Auto-sync ready', { timeout: 10_000 });

  remoteRevision = 3;
  remoteState = {
    ...structuredClone(emptyState),
    diary: [{ id: 'entry-other-device', plantId: null, cycleId: null, type: 'note', title: 'Other device update', notes: '', createdAt: timestamp }],
  };
  await addLocalDiaryEntry(page, 'Local conflicting update');

  await expect(page.locator('.safe-sync-launcher strong')).toHaveText('Sync conflict', { timeout: 10_000 });
  expect(postCount).toBe(0);
  await page.getByRole('button', { name: 'Open safe auto-sync settings' }).click();
  await expect(page.getByText(/Automatic sync stopped before overwriting anything/i)).toBeVisible();
  await expect(page.getByText(/No silent overwrite/i)).toBeVisible();
});

test('safe auto-sync panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only safe auto-sync layout assertion.');
  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, authenticated: false }) });
  });
  await page.goto('/#/dashboard');
  await page.getByRole('button', { name: 'Open safe auto-sync settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Safe auto-sync' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
