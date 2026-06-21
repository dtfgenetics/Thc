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
    await page.goto('/games/high-land/?hlTestRolls=1');

    await expect(page.getByRole('heading', { name: /High Land/i })).toBeVisible();
    await expect(page.locator('[data-player-id="player-2"]')).toContainText('Blue Dreamer');
    await page.getByRole('button', { name: '10 Players' }).click();

    await expect(page.getByText('Sky High')).toBeVisible();
    await expect(page.getByText('Current Turn')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Roll Dice' }).click();

    await expect(page.getByLabel(/Last roll/i)).toBeVisible();
    await expect(page.locator('.turn-box')).toContainText('Blue Dreamer');
    await expect(page.locator('[data-player-id="player-1"]')).not.toContainText('Space 0');
    await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test('mobile layout can start and restart a game', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/high-land/?hlTestRolls=1');

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
    await page.goto('/games/high-land/?hlTestRolls=1');

    await page.getByRole('button', { name: 'Roll Dice' }).click();
    await expect(page.locator('[data-player-id="player-1"]')).not.toContainText('Space 0');
    const savedRollLabel = await page.locator('.dice-display').getAttribute('aria-label');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: '4 Players' }).click();
    await expect(page.getByText('Golden Glow')).toBeVisible();
    await page.getByRole('button', { name: 'Load' }).click();

    await expect(page.getByText('Golden Glow')).toHaveCount(0);
    await expect(page.locator('.dice-display')).toHaveAttribute('aria-label', savedRollLabel ?? '');
    await expect(page.locator('.turn-box')).toContainText('Blue Dreamer');
    expect(browserErrors).toEqual([]);
  });

  test('renders the supplied board and resolves a HIT card', async ({ page }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.goto('/games/high-land/?hlTestRolls=4');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const canvasColors = await canvas.evaluate((element) => {
      const context = (element as HTMLCanvasElement).getContext('2d');
      if (!context) return 0;
      const pixels = context.getImageData(0, 0, element.width, element.height).data;
      const colors = new Set<string>();
      for (let index = 0; index < pixels.length; index += 16000) {
        colors.add(`${pixels[index]}-${pixels[index + 1]}-${pixels[index + 2]}`);
      }
      return colors.size;
    });
    expect(canvasColors).toBeGreaterThan(20);

    await page.getByRole('button', { name: 'Roll Dice' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Perfect Roll' })).toBeVisible();
    await expect(dialog.locator('[data-card-art="perfect-roll"]')).toBeVisible();
    await expect(page.locator('[data-player-id="player-1"]')).toContainText('Space 7');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.turn-box')).toContainText('Blue Dreamer');
    expect(browserErrors).toEqual([]);
  });
});
