import { expect, test } from '@playwright/test';

async function startLocalGame(page: import('@playwright/test').Page) {
  await page.goto('/games/high-land/');
  await page.getByRole('button', { name: 'Local Play' }).click();
  await page.getByPlaceholder('Enter your player name').fill('Production Tester');
  await page.getByLabel('Players').selectOption('2');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('.phaser-board canvas')).toBeVisible();
}

test.describe('High Land production controls', () => {
  test('does not expose developer HIT preview controls on the landing screen', async ({ page }) => {
    await page.goto('/games/high-land/');
    await expect(page.getByRole('button', { name: 'Preview HIT Animation' })).toBeHidden();
  });

  test('prevents accidental player-count reset controls during active local play', async ({ page }) => {
    await startLocalGame(page);
    await expect(page.locator('.player-select')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Preview HIT Animation' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Roll Dice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
  });
});
