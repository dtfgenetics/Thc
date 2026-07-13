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
    notes: '',
    createdAt: '2026-07-01T00:00:00Z',
  }],
  diary: [],
  tasks: [],
  readings: [],
  calibrationProfiles: [],
  observations: [],
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
    localStorage.removeItem('growlens-task-reminders-enabled-v1');
    localStorage.removeItem('growlens-task-reminders-last-date-v1');
  }, seededState);
  await page.reload();
  await page.getByRole('button', { name: 'Open GrowLens routines and reminders' }).click();
  await expect(page.getByRole('dialog', { name: 'Routines & reminders' })).toBeVisible();
});

test('creates and advances a weekly routine without duplicating the task', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Routine persistence contract is covered once on desktop.');
  const routines = page.getByRole('dialog', { name: 'Routines & reminders' });
  await routines.getByLabel('Task', { exact: true }).fill('Weekly canopy scout');
  await routines.getByLabel('Due date').fill('2099-01-01');
  await routines.getByLabel('Repeat').selectOption('weekly');
  await routines.getByLabel('Plant').selectOption('plant-1');
  await routines.getByRole('button', { name: 'Add routine' }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    const task = state.tasks?.find((candidate: { title?: string }) => candidate.title === 'Weekly canopy scout');
    return task ? {
      count: state.tasks.length,
      dueDate: task.dueDate,
      recurrence: task.recurrence,
      completed: task.completed,
    } : null;
  })).toEqual({
    count: 1,
    dueDate: '2099-01-01',
    recurrence: 'weekly',
    completed: false,
  });

  await page.reload();
  await page.getByRole('button', { name: 'Open GrowLens routines and reminders' }).click();
  const reopened = page.getByRole('dialog', { name: 'Routines & reminders' });
  await reopened.getByRole('button', { name: 'Complete Weekly canopy scout' }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    const task = state.tasks?.find((candidate: { title?: string }) => candidate.title === 'Weekly canopy scout');
    return task ? {
      count: state.tasks.length,
      dueDate: task.dueDate,
      completed: task.completed,
      completionCount: task.completionCount,
      hasCompletionTime: typeof task.lastCompletedAt === 'string' && task.lastCompletedAt.length > 0,
    } : null;
  })).toEqual({
    count: 1,
    dueDate: '2099-01-08',
    completed: false,
    completionCount: 1,
    hasCompletionTime: true,
  });
});

test('repairs a recurring task checked through the original task screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Compatibility repair is covered once on desktop.');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    state.tasks = [{
      id: 'task-recurring-1',
      title: 'Daily room check',
      dueDate: '2099-02-01',
      plantId: null,
      completed: true,
      recurrence: 'daily',
      completionCount: 0,
      lastCompletedAt: null,
      createdAt: '2026-07-13T00:00:00Z',
    }];
    localStorage.setItem('thc-growlens-state-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open GrowLens routines and reminders' }).click();

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('thc-growlens-state-v1') ?? '{}');
    const task = state.tasks?.[0];
    return task ? {
      completed: task.completed,
      dueDate: task.dueDate,
      completionCount: task.completionCount,
    } : null;
  })).toEqual({
    completed: false,
    dueDate: '2099-02-02',
    completionCount: 1,
  });
});

test('routines panel fits the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only routines layout assertion.');
  const routines = page.getByRole('dialog', { name: 'Routines & reminders' });
  await expect(routines.getByText('Add task or routine')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
