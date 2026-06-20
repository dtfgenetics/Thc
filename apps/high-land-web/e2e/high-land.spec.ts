import { expect, test } from '@playwright/test';

test.describe('High Land browser game', () => {
  test('loads, starts 10-player mode, and rolls', async ({ page }) => {
    await page.goto('/games/high-land/');

    await expect(page.getByRole('heading', { name: /High Land/i })).toBeVisible();
    await page.getByRole('button', { name: '10 Players' }).click();

    await expect(page.getByText('Player 10')).toBeVisible();
    await expect(page.getByText('Current Turn')).toBeVisible();

    await page.getByRole('button', { name: 'Roll Dice' }).click();

    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.getByText(/Space 1|Space 2|Space 3|Space 4|Space 5|Space 6/)).toBeVisible();
  });

  test('mobile layout can start and restart a game', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/high-land/');

    await page.getByRole('button', { name: '4 Players' }).click();
    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await page.getByRole('button', { name: 'Restart' }).click();

    await expect(page.getByText('Game ready. Roll to begin.')).toBeVisible();
  });
});
