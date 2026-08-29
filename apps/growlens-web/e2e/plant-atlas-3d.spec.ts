import { expect, test } from '@playwright/test';

const atlasPath = '/atlas/index.html';

test.describe('THC Living Plant Atlas 3D', () => {
  test('renders the WebGL specimen and supports cutaway, venation, isolation, and anatomy labels', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(atlasPath, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'The Living Plant Atlas' })).toBeVisible();
    await expect(page.getByText('3D anatomy explorer')).toBeVisible();

    const viewport = page.locator('[data-plant-3d]');
    const canvas = page.locator('[data-plant-canvas]');
    const anatomyLabel = page.locator('[data-plant-anatomy-label]');

    await expect(canvas).toBeVisible();
    await expect(viewport).toHaveAttribute('data-venation', 'modeled');
    await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height })), {
      timeout: 15_000,
    }).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });

    const size = await canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }));
    expect(size.width).toBeGreaterThan(400);
    expect(size.height).toBeGreaterThan(400);

    await page.getByRole('button', { name: 'Roots' }).click();
    await expect(page.locator('[data-inspector-title]')).toHaveText('Root system');
    await expect(page.locator('[data-inspector-link]')).toHaveAttribute('href', '/atlas/root-system/');
    await expect(viewport).toHaveAttribute('data-plant-inspection', 'root-system');
    await expect(viewport).toHaveAttribute('data-root-cutaway', 'active');
    await expect(viewport).toHaveAttribute('data-isolation', 'active');
    await expect(anatomyLabel).toBeVisible();
    await expect(anatomyLabel).toContainText('Primary, lateral & fine absorbing roots');

    await page.getByRole('button', { name: 'Leaves' }).click();
    await expect(page.locator('[data-inspector-title]')).toHaveText('Fan leaves');
    await expect(page.locator('[data-inspector-link]')).toHaveAttribute('href', '/atlas/leaf-module/');
    await expect(viewport).toHaveAttribute('data-plant-inspection', 'leaf-module');
    await expect(viewport).toHaveAttribute('data-root-cutaway', 'resting');
    await expect(anatomyLabel).toContainText('midribs & lateral veins');

    await page.getByRole('button', { name: 'Flowers' }).click();
    await expect(page.locator('[data-inspector-title]')).toHaveText('Flowers & inflorescences');
    await expect(page.locator('[data-inspector-link]')).toHaveAttribute('href', '/atlas/flower-anatomy/');
    await expect(viewport).toHaveAttribute('data-plant-inspection', 'flower-anatomy');
    await expect(anatomyLabel).toContainText('Bracts, sugar leaves & floral clusters');

    await page.getByRole('button', { name: 'Trichomes' }).click();
    await expect(page.locator('[data-inspector-title]')).toHaveText('Glandular trichomes');
    await expect(page.locator('[data-inspector-link]')).toHaveAttribute('href', '/atlas/trichomes-resin/');
    await expect(viewport).toHaveAttribute('data-plant-inspection', 'trichomes-resin');
    await expect(anatomyLabel).toContainText('Stalks and secretory gland heads');

    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(viewport).toHaveAttribute('data-plant-inspection', 'whole');
    await expect(viewport).toHaveAttribute('data-root-cutaway', 'resting');
    await expect(viewport).toHaveAttribute('data-isolation', 'off');
    await expect(anatomyLabel).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('keeps the complete educational system library available beside the 3D experience', async ({ page }) => {
    await page.goto(atlasPath);
    await expect(page.locator('[data-system-grid] .system-card')).toHaveCount(16);
    await page.locator('[data-atlas-search]').fill('pollen');
    const reproductiveCard = page.locator('[data-system-grid] .system-card[href="/atlas/reproductive-biology/"]');
    await expect(reproductiveCard).toBeVisible();
    await expect(reproductiveCard).toContainText('Sex, Pollen, Fertilization & Seed');
  });
});
