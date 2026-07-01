import { expect, test, type Page } from '@playwright/test';

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('High Land browser game', () => {
  test('loads the approved board, starts 10-player local play, and rolls', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto('/games/high-land/');

    const boardResponse = await page.request.get('/games/high-land/assets/images/board/high-land-board.png');
    expect(boardResponse.ok()).toBe(true);
    expect(boardResponse.headers()['content-type']).toContain('image/png');

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
    await expect(page.locator('.phaser-board canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Roll Dice' }).click();

    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
    await page.getByRole('button', { name: 'Mute' }).click();
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
    await page.getByRole('button', { name: 'Unmute' }).click();
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
    expect(pageErrors).toEqual([]);
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

    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
  });

  test('opens invite links into prefilled join room flow', async ({ page }) => {
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Create Room' }).click();
    await page.getByPlaceholder('Enter your player name').fill('Room Host');
    await page.getByRole('button', { name: 'Create Room' }).click();

    const inviteUrl = await page.getByLabel('Invite link').inputValue();
    const roomCode = new URL(inviteUrl).searchParams.get('room');
    expect(roomCode).toBeTruthy();

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
    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await page.getByRole('button', { name: 'Restart' }).click();

    await expect(page.getByText('Mobile Player, roll to begin.')).toBeVisible();
    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth
    }));
    expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(pageErrors).toEqual([]);
  });
});
