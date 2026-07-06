import { expect, test, type Page } from '@playwright/test';

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (isExpectedBrowserNoise(text)) return;
    errors.push(text);
  });
  return errors;
}

function isExpectedBrowserNoise(text: string): boolean {
  return [
    'favicon.ico',
    'Failed to load resource',
    'card-001.png',
    'card-002.png',
    'card-003.png',
    'card-004.png',
    'card-005.png',
    'assets/audio/',
    'AudioContext'
  ].some((pattern) => text.includes(pattern));
}

async function forceNextDiceRoll(page: Page, roll: 1 | 2 | 3 | 4 | 5 | 6): Promise<void> {
  await page.evaluate((value) => {
    const url = new URL(window.location.href);
    url.searchParams.set('hlTestRoll', String(value));
    window.history.replaceState({}, '', url);
  }, roll);
}

test.describe('High Land browser game', () => {
  test('can preview the HIT card animation from the landing screen', async ({ page }) => {
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Preview HIT Animation' }).click();

    const hitDialog = page.getByRole('dialog', { name: 'HIT card drawn' });
    await expect(hitDialog).toBeVisible();
    await expect(hitDialog.getByText('HIT CARD')).toBeVisible();
    await expect(hitDialog.locator('.hit-card-art')).toBeVisible();
    await expect(hitDialog.getByText('Cloud Drift')).toBeVisible();
    await hitDialog.getByRole('button', { name: 'Continue' }).click();
    await expect(hitDialog).toHaveCount(0);
  });

  test('loads the approved board, starts 10-player local play, and rolls from board controls', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto('/games/high-land/');

    const boardResponse = await page.request.get('/games/high-land/assets/images/board/high-land-board.png');
    expect(boardResponse.ok()).toBe(true);
    expect(boardResponse.headers()['content-type']).toContain('image/png');
    const boardImageStatus = await page.evaluate(async () => {
      const image = new Image();
      image.src = '/games/high-land/assets/images/board/high-land-board.png';
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    expect(boardImageStatus.width).toBeGreaterThan(0);
    expect(boardImageStatus.height).toBeGreaterThan(0);

    await expect(page.getByRole('heading', { name: 'High Land: The Sweet Escape' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start High Land' })).toBeVisible();

    await page.getByRole('button', { name: 'Local Play' }).click();
    await expect(page.getByRole('heading', { name: 'Start local High Land' })).toBeVisible();

    await page.getByPlaceholder('Enter your player name').fill('Blaze Runner');
    await page.getByLabel('Players').selectOption('10');
    await page.getByRole('button', { name: 'Start Game' }).click();

    await expect(page.getByText('Blaze Runner').first()).toBeVisible();
    await expect(page.getByText('Player 10')).toBeVisible();
    await expect(page.getByText('Current Turn')).toBeVisible();
    await expect(page.getByLabel('Current board space')).toBeVisible();
    const currentBoardSpace = page.getByLabel('Current board space');
    await expect(currentBoardSpace).toContainText('#1');
    await expect(currentBoardSpace).toContainText('RED');
    await expect(page.locator('.phaser-board canvas')).toBeVisible();

    const boardControls = page.locator('.board-controls-card');
    await expect(boardControls.getByRole('button', { name: 'Roll Dice' })).toBeVisible();
    await expect(boardControls.getByRole('button', { name: 'Preview HIT Animation' })).toBeVisible();
    await expect(page.locator('.game-stage .board-controls-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Load' })).toHaveCount(0);

    await forceNextDiceRoll(page, 1);
    await boardControls.getByRole('button', { name: 'Roll Dice' }).click();

    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.getByText('Blaze Runner rolled 1. Move 1 space.')).toBeVisible();
    await expect(page.getByLabel('Current board space')).toBeVisible();
    await expect(boardControls.getByRole('button', { name: 'Restart' })).toBeVisible();
    await boardControls.getByRole('button', { name: 'Mute' }).click();
    await expect(boardControls.getByRole('button', { name: 'Unmute' })).toBeVisible();
    await boardControls.getByRole('button', { name: 'Unmute' }).click();
    await expect(boardControls.getByRole('button', { name: 'Mute' })).toBeVisible();
    expect(pageErrors).toEqual([]);
    await page.goto('about:blank');
  });

  test('shows an animated HIT card popup when landing on a real HIT space', async ({ page }) => {
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Local Play' }).click();
    await page.getByPlaceholder('Enter your player name').fill('Hit Tester');
    await page.getByLabel('Players').selectOption('2');
    await page.getByRole('button', { name: 'Start Game' }).click();

    await forceNextDiceRoll(page, 2);
    await page.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' }).click();

    await expect(page.getByText(/Hit Tester rolled 2\. Move 2 spaces\./)).toBeVisible();
    const hitDialog = page.getByRole('dialog', { name: 'HIT card drawn' });
    await expect(hitDialog).toBeVisible();
    await expect(hitDialog.getByText('HIT CARD')).toBeVisible();
    await expect(hitDialog.locator('.hit-card-art')).toBeVisible();
    await expect(hitDialog.getByRole('button', { name: 'Continue' })).toBeVisible();
    await hitDialog.getByRole('button', { name: 'Continue' }).click();
    await expect(hitDialog).toHaveCount(0);
  });

  test('can create a local fallback room lobby, add test player, start, and roll', async ({ page }) => {
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Create Room' }).click();
    await page.getByPlaceholder('Enter your player name').fill('Room Host');
    await page.getByRole('button', { name: 'Create Room' }).click();

    const roomLobby = page.getByLabel('High Land room lobby');
    await expect(roomLobby).toBeVisible();
    await expect(roomLobby.getByText('Room Host')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Invite' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();

    await page.getByRole('button', { name: 'Add Test Player' }).click();
    await expect(roomLobby.getByText('Player 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeEnabled();

    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.getByText(/Room [A-Z0-9]{4,8}/).first()).toBeVisible();
    await expect(page.getByText('Room Host, roll to begin.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Load' })).toHaveCount(0);

    await page.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.getByText(/Room Host rolled [1-6]\. Move [1-6] spaces?\./)).toBeVisible();
  });

  test('opens invite links into prefilled join room flow', async ({ page }) => {
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Create Room' }).click();
    await page.getByPlaceholder('Enter your player name').fill('Room Host');
    await page.getByRole('button', { name: 'Create Room' }).click();

    const inviteUrl = await page.getByLabel('Invite link').inputValue();
    const roomCode = new URL(inviteUrl).searchParams.get('room');
    expect(roomCode).toBeTruthy();

    await page.evaluate(() => window.sessionStorage.clear());
    await page.goto(inviteUrl);
    await expect(page.getByRole('heading', { name: 'Join a High Land room' })).toBeVisible();
    await expect(page.getByPlaceholder('Room code')).toHaveValue(roomCode ?? '');

    await page.getByPlaceholder('Enter your player name').fill('Invite Guest');
    await page.getByRole('button', { name: 'Join Room' }).click();

    await expect(page.getByLabel('High Land room lobby')).toBeVisible();
    await expect(page.getByText('Invite Guest').first()).toBeVisible();
  });

  test('mobile layout can start and restart a named game without overflow', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Local Play' }).click();
    await page.getByPlaceholder('Enter your player name').fill('Mobile Player');
    await page.getByLabel('Players').selectOption('4');
    await page.getByRole('button', { name: 'Start Game' }).click();
    await forceNextDiceRoll(page, 1);
    await page.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.getByText('Mobile Player rolled 1. Move 1 space.')).toBeVisible();
    await expect(page.getByLabel('Current board space')).toBeVisible();
    await page.locator('.board-controls-card').getByRole('button', { name: 'Restart' }).click();

    await expect(page.getByText('Mobile Player, roll to begin.')).toBeVisible();
    const layout = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const contentWidth = document.documentElement.scrollWidth;
      return { viewportWidth, contentWidth, overflowPixels: Math.max(0, contentWidth - viewportWidth) };
    });
    expect(layout.overflowPixels).toBeLessThanOrEqual(4);
    expect(pageErrors).toEqual([]);
  });
});
