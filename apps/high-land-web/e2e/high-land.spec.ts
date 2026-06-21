import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function startLocalGame(page: Page, count: number, names: string[]): Promise<void> {
  await page.getByRole('tab', { name: 'Local Play' }).click();
  await page.getByLabel('Number of local players').selectOption(String(count));
  for (let index = 0; index < count; index += 1) {
    await page.getByLabel(`Player ${index + 1} name`).fill(names[index] ?? '');
  }
  await page.getByRole('button', { name: 'Start Local Game' }).click();
}

test.describe('High Land browser game', () => {
  test('starts named local games from 1 to 10 players', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.goto('/games/high-land/?hlTestRolls=1');

    await expect(page.getByRole('heading', { name: /High Land/i })).toBeVisible();
    await startLocalGame(page, 1, ['GreenBean']);
    await expect(page.locator('[data-player-id="player-1"]')).toContainText('GreenBean');
    await expect(page.getByText("GreenBean's turn")).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.locator('[data-player-id="player-1"]')).toContainText('Space 1');

    await page.getByRole('button', { name: 'Exit Game' }).click();
    await startLocalGame(page, 10, ['Ruby', 'Blue', '', '', '', '', '', '', '', 'Sky']);
    await expect(page.getByText('Sky')).toBeVisible();
    await expect(page.locator('[data-player-id="player-3"]')).toContainText('Player 3');
    expect(browserErrors).toEqual([]);
  });

  test('local save, load, restart, and mobile layout remain usable', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/high-land/?hlTestRolls=1');
    await startLocalGame(page, 2, ['Ruby Rider', 'Blue Dreamer']);

    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Restart' }).click();
    await expect(page.locator('[data-player-id="player-1"]')).toContainText('Space 0');
    await page.getByRole('button', { name: 'Load' }).click();
    await expect(page.locator('[data-player-id="player-1"]')).toContainText('Space 1');
    await expect(page.locator('canvas')).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      contentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      boardWidth: document.querySelector('.board-wrap')?.getBoundingClientRect().width ?? 0,
      canvasWidth: document.querySelector('canvas')?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    expect(dimensions.canvasWidth).toBeGreaterThan(dimensions.boardWidth * 0.9);
    expect(dimensions.canvasWidth).toBeLessThanOrEqual(dimensions.boardWidth + 1);
    expect(browserErrors).toEqual([]);
  });

  test('shows the required invalid invite message', async ({ page }) => {
    await page.goto('/games/high-land/?game=ABC123');
    await expect(page.getByText('This game invite could not be found. Create a new High Land game.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play locally instead' })).toBeVisible();
  });

  test('synchronizes a two-player invite game, reconnect, HIT card, turns, and winner', async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'The mobile project covers lobby and board layout; room synchronization is browser-size independent.');
    test.setTimeout(120_000);
    const hostErrors = captureBrowserErrors(page);
    await page.goto('/games/high-land/?hlTestRolls=4');
    await page.getByLabel('Display name').fill('GreenBean');
    await page.getByRole('button', { name: 'Create Game' }).click();

    await expect(page.getByText('Joined Players')).toBeVisible();
    await expect(page.getByText('GreenBean')).toBeVisible();
    const inviteUrl = await page.getByLabel('Invite link').inputValue();
    expect(inviteUrl).toMatch(/\?game=[A-Z2-9]{6}$/);

    const guestContext = await createGuestContext(browser);
    const guestPage = await guestContext.newPage();
    const guestErrors = captureBrowserErrors(guestPage);
    await guestPage.goto(`${inviteUrl}&hlTestRolls=1`);
    await guestPage.getByLabel('Display name').fill('MangoMike');
    await guestPage.getByRole('button', { name: 'Join Game' }).click();

    await expect(guestPage.getByText('GreenBean')).toBeVisible();
    await expect(guestPage.getByText('MangoMike')).toBeVisible();
    await expect(page.getByText('MangoMike')).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(guestPage.locator('canvas')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: 'Roll Dice' })).toBeEnabled();
    await expect(guestPage.getByRole('button', { name: 'Waiting for GreenBean' })).toBeDisabled();

    await moveCurrentPlayerTo(page, 23);
    await expect(page.locator('[data-player-id]').filter({ hasText: 'GreenBean' })).toContainText('Space 23', { timeout: 8_000 });
    await page.getByRole('button', { name: 'Roll Dice' }).click();
    const hostDialog = page.getByRole('dialog');
    const guestDialog = guestPage.getByRole('dialog');
    await expect(hostDialog.getByRole('heading', { name: 'Perfect Roll' })).toBeVisible();
    await expect(guestDialog.getByRole('heading', { name: 'Perfect Roll' })).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-player-id]').filter({ hasText: 'GreenBean' })).toContainText('Space 30');
    await expect(guestPage.locator('[data-player-id]').filter({ hasText: 'GreenBean' })).toContainText('Space 30');
    await hostDialog.getByRole('button', { name: 'Continue' }).click();
    await guestDialog.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('button', { name: 'Waiting for MangoMike' })).toBeDisabled();
    await expect(guestPage.getByRole('button', { name: 'Roll Dice' })).toBeEnabled();

    await guestPage.reload();
    await expect(guestPage.getByText("MangoMike's turn")).toBeVisible({ timeout: 8_000 });
    const reconnectDialog = guestPage.getByRole('dialog');
    if (await reconnectDialog.count()) await reconnectDialog.getByRole('button', { name: 'Continue' }).click();

    await moveCurrentPlayerTo(guestPage, 109);
    await expect(guestPage.locator('[data-player-id]').filter({ hasText: 'MangoMike' })).toContainText('Space 109', { timeout: 8_000 });
    await guestPage.getByRole('button', { name: 'Roll Dice' }).click();
    await expect(guestPage.locator('.turn-announcement')).toHaveText('MangoMike reached Cloud 9 Citadel and wins!');
    await expect(page.locator('.turn-announcement')).toHaveText('MangoMike reached Cloud 9 Citadel and wins!', { timeout: 8_000 });

    expect(hostErrors).toEqual([]);
    expect(guestErrors).toEqual([]);
  });
});

async function createGuestContext(browser: Browser) {
  return browser.newContext({ viewport: { width: 430, height: 900 } });
}

async function moveCurrentPlayerTo(page: Page, positionIndex: number): Promise<void> {
  await page.evaluate(async (targetPosition) => {
    const credentialKey = Object.keys(sessionStorage).find((key) => key.startsWith('high-land-room-v1:'));
    if (!credentialKey) throw new Error('Missing room credentials');
    const credentials = JSON.parse(sessionStorage.getItem(credentialKey) ?? '{}');
    const endpoint = new URL('api/', window.location.href).pathname;
    const syncResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', ...credentials })
    });
    const sync = await syncResponse.json();
    const gameState = structuredClone(sync.room.gameState);
    gameState.players[gameState.currentPlayerIndex].positionIndex = targetPosition;
    gameState.lastCard = null;
    gameState.message = `${gameState.players[gameState.currentPlayerIndex].name} moved near Cloud 9 Citadel.`;
    const commitResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'commit',
        ...credentials,
        expectedVersion: sync.room.version,
        gameState
      })
    });
    if (!commitResponse.ok) throw new Error(`State setup failed: ${commitResponse.status}`);
  }, positionIndex);
}
