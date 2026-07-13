import { expect, test } from '@playwright/test';

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

const localState = {
  ...emptyState,
  plants: [{
    id: 'plant-local-1',
    name: 'BM-F3-01',
    strain: 'Blue Mango F3',
    stage: 'vegetative',
    status: 'active',
    spaceId: 'space-local-1',
    cycleId: '',
    startDate: '2026-07-13',
    notes: 'Local device record',
    createdAt: '2026-07-13T00:00:00.000Z',
  }],
};

test('requires an explicit choice before uploading existing local data to a new account', async ({ page }) => {
  let uploadedBody: Record<string, unknown> | null = null;
  let csrfHeader = '';

  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: false }),
    });
  });

  await page.route('**/api/register.php', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        user: { id: 'user-test', email: 'grower@example.com', createdAt: '2026-07-13T00:00:00Z' },
        csrfToken: 'csrf-test',
        revision: 0,
        updatedAt: '2026-07-13T00:00:00Z',
        state: emptyState,
      }),
    });
  });

  await page.route('**/api/sync.php', async (route) => {
    if (route.request().method() === 'POST') {
      csrfHeader = route.request().headers()['x-csrf-token'] ?? '';
      uploadedBody = route.request().postDataJSON() as Record<string, unknown>;
      const bodyState = uploadedBody.state;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          revision: 1,
          updatedAt: '2026-07-13T01:00:00Z',
          state: bodyState,
        }),
      });
      return;
    }

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

  await page.goto('/#/dashboard');
  await page.evaluate((state) => {
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
  }, localState);
  await page.reload();

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Email', { exact: true }).fill('grower@example.com');
  await page.getByLabel('Password', { exact: true }).fill('a-secure-test-password');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Choose how to resolve different copies' })).toBeVisible();
  await expect(page.getByText('1 records', { exact: true }).first()).toBeVisible();
  expect(uploadedBody).toBeNull();

  await page.getByRole('button', { name: 'Keep this device' }).click();
  await expect(page.getByText('Device copy uploaded as revision 1.')).toBeVisible();

  expect(csrfHeader).toBe('csrf-test');
  expect(uploadedBody).toMatchObject({
    expectedRevision: 0,
    state: {
      plants: [expect.objectContaining({ id: 'plant-local-1', name: 'BM-F3-01' })],
    },
  });
});

test('account panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only account panel assertion');

  await page.route('**/api/session.php', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, authenticated: false }),
    });
  });

  await page.goto('/#/dashboard');
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('dialog', { name: 'GrowLens account' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
