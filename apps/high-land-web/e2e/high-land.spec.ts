import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('High Land browser game', () => {
  test('loads, starts 10-player mode, and rolls', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.goto('/games/high-land/');

    await expect(page.getByRole('heading', { name: /High Land/i })).toBeVisible();
    await expect(page.getByText('Player 2')).toBeVisible();
    await page.getByRole('button', { name: '10 Players' }).click();

    await expect(page.getByText('Player 10')).toBeVisible();
    await expect(page.getByText('Current Turn')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Roll Dice' }).click();

    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.locator('.turn-box')).toContainText('Player 2');
    await expect(page.locator('[data-player-id="player-1"]')).not.toContainText('Space 0');
    await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test('mobile layout can start and restart a game', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: '4 Players' }).click();
    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await page.getByRole('button', { name: 'Restart' }).click();

    await expect(page.getByText('Game ready. Roll to begin.')).toBeVisible();
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

  test('saves and restores a two-player game', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.locator('[data-player-id="player-1"]')).not.toContainText('Space 0');
    const savedRollLabel = await page.locator('.dice-display').getAttribute('aria-label');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: '4 Players' }).click();
    await expect(page.getByText('Player 4')).toBeVisible();
    await page.getByRole('button', { name: 'Load' }).click();

    await expect(page.getByText('Player 4')).toHaveCount(0);
    await expect(page.locator('.dice-display')).toHaveAttribute('aria-label', savedRollLabel ?? '');
    await expect(page.locator('.turn-box')).toContainText('Player 2');
    expect(browserErrors).toEqual([]);
  });
});
