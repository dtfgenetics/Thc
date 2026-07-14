import { expect, test, type Page, type Route } from '@playwright/test';

const timestamp = '2026-07-13T12:00:00.000Z';
const user = { id: 'user-safe-sync', email: 'sync@example.com', createdAt: timestamp };
const baseState = {
  schemaVersion: 2,
  spaces: [{ id: 'space-safe-sync-12345678', name: 'Safe Sync Tent', environment: 'indoor', lightHours: 18, createdAt: timestamp }],
  cycles: [], plants: [], diary: [], tasks: [], readings: [], calibrationProfiles: [], observations: [],
  irrigationRecords: [], feedingRecords: [], reservoirRecords: [], harvestRecords: [], observationOutcomes: [],
};

async function clearBrowserData(page: Page, state = baseState): Promise<void> {
  await page.evaluate(async (seed) => {
    localStorage.clear();
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(seed));
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('growlens-sync-v1');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }, state);
}

async function createMockAccount(page: Page) {
  let remoteState = structuredClone(baseState);
  let revision = 2;
  let updatedAt = timestamp;
  const posts: Array<{ expectedRevision: number; state: typeof baseState }> = [];

  await page.route('**/api/session.php', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: true, user, csrfToken: 'csrf-safe-sync', revision, updatedAt }),
    });
  });
  await page.route('**/api/sync.php', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, user, revision, updatedAt, state: remoteState }),
      });
      return;
    }
    const body = route.request().postDataJSON() as { expectedRevision: number; state: typeof baseState };
    posts.push(body);
    if (body.expectedRevision !== revision) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Sync conflict.', conflict: true, revision, updatedAt }),
      });
      return;
    }
    remoteState = structuredClone(body.state);
    revision += 1;
    updatedAt = new Date(new Date(updatedAt).getTime() + 60_000).toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, revision, updatedAt, state: remoteState }),
    });
  });

  return {
    posts,
    getRemoteState: () => remoteState,
    getRevision: () => revision,
    setRemoteState(next: typeof baseState) {
      remoteState = structuredClone(next);
      revision += 1;
      updatedAt = new Date(new Date(updatedAt).getTime() + 60_000).toISOString();
    },
  };
}

async function openAndEnable(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open safe synchronization queue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Safe synchronization queue' });
  await expect(dialog).toBeVisible();
  const enable = dialog.getByRole('button', { name: 'Enable safe synchronization' });
  if (await enable.count()) await enable.click();
  await expect(dialog.getByText(/Device and account match at revision 2/)).toBeVisible();
}

test('queues a local change and uploads only against a fresh matching remote baseline', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Full safe-sync upload contract is covered once on desktop.');
  const account = await createMockAccount(page);
  await page.goto('/#/dashboard');
  await clearBrowserData(page);
  await page.reload();
  await openAndEnable(page);

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    state.diary.push({ id: 'entry-safe-sync-12345678', plantId: null, cycleId: null, type: 'note', title: 'Queued local change', notes: '', createdAt: new Date().toISOString() });
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('growlens:state-saved', { detail: { source: 'app', savedAt: new Date().toISOString() } }));
  });

  const dialog = page.getByRole('dialog', { name: 'Safe synchronization queue' });
  await expect(dialog.getByText(/Local changes were safely uploaded as revision 3/)).toBeVisible({ timeout: 10_000 });
  expect(account.posts).toHaveLength(1);
  expect(account.posts[0].expectedRevision).toBe(2);
  expect(account.posts[0].state.diary).toHaveLength(1);
  expect(account.getRemoteState().diary[0].title).toBe('Queued local change');
  const baseline = await page.evaluate(() => JSON.parse(localStorage.getItem('growlens-sync-baseline-v1') ?? '{}'));
  expect(baseline).toMatchObject({ userId: user.id, revision: 3 });
});

test('safely downloads a remote-only change when the device still matches the baseline', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Full safe-sync download contract is covered once on desktop.');
  const account = await createMockAccount(page);
  await page.goto('/#/dashboard');
  await clearBrowserData(page);
  await page.reload();
  await openAndEnable(page);

  account.setRemoteState({
    ...structuredClone(baseState),
    tasks: [{ id: 'task-remote-safe-12345678', title: 'Remote-only task', dueDate: '2026-07-14', plantId: null, completed: false, createdAt: timestamp }],
  });

  const dialog = page.getByRole('dialog', { name: 'Safe synchronization queue' });
  await dialog.getByRole('button', { name: 'Try queued sync now' }).click();
  await expect(dialog.getByText(/was safely loaded because this device had not changed/)).toBeVisible({ timeout: 10_000 });
  expect(account.posts).toHaveLength(0);
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}'));
  expect(local.tasks).toHaveLength(1);
  expect(local.tasks[0].title).toBe('Remote-only task');
});

test('blocks without posting when local and remote copies both changed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Full safe-sync conflict contract is covered once on desktop.');
  const account = await createMockAccount(page);
  await page.goto('/#/dashboard');
  await clearBrowserData(page);
  await page.reload();
  await openAndEnable(page);

  account.setRemoteState({
    ...structuredClone(baseState),
    tasks: [{ id: 'task-conflict-remote-12345678', title: 'Remote conflict', dueDate: '2026-07-14', plantId: null, completed: false, createdAt: timestamp }],
  });
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    state.diary.push({ id: 'entry-conflict-local-12345678', plantId: null, cycleId: null, type: 'note', title: 'Local conflict', notes: '', createdAt: new Date().toISOString() });
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('growlens:state-saved', { detail: { source: 'app', savedAt: new Date().toISOString() } }));
  });

  const dialog = page.getByRole('dialog', { name: 'Safe synchronization queue' });
  await expect(dialog.getByText(/Both copies changed.*stopped without overwriting/i)).toBeVisible({ timeout: 10_000 });
  expect(account.posts).toHaveLength(0);
  await expect(dialog.getByText('blocked', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Account controls' }).click();
  await expect(page.getByRole('dialog', { name: 'GrowLens account' })).toBeVisible();
});

test('safe synchronization panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only safe-sync layout assertion.');
  await createMockAccount(page);
  await page.goto('/#/dashboard');
  await clearBrowserData(page);
  await page.reload();
  await page.getByRole('button', { name: 'Open safe synchronization queue' }).click();
  await expect(page.getByRole('dialog', { name: 'Safe synchronization queue' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
