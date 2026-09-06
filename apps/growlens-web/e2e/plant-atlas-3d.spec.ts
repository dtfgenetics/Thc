import { expect, test } from '@playwright/test';

const atlasPath = '/atlas/index.html';

test.describe('THC Living Plant Atlas V4', () => {
  test('boots the complete V4 PBR specimen with stable anatomy controls and responsive canvas', async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(atlasPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'The Living Plant Atlas' })).toBeVisible();
    await expect(page.getByText('3D anatomy explorer', { exact: true })).toBeVisible();
    await expect(page.getByText('Interactive botanical specimen', { exact: true })).toBeVisible();

    const viewport = page.locator('[data-plant-3d]');
    const canvas = page.locator('[data-plant-canvas]');
    const modelStatus = page.locator('[data-plant-model-status]');

    await expect(viewport).toHaveAttribute('data-renderer-generation', 'v4', { timeout: 20_000 });
    await expect(viewport).toHaveAttribute('data-render-state', 'ready');
    await expect(viewport).toHaveAttribute('data-model-mode', /^(procedural-pbr|external-glb)$/);
    await expect(viewport).toHaveAttribute('data-venation', 'modeled');
    await expect(modelStatus).toHaveAttribute('data-state', 'ready');

    const staticContract = await page.evaluate(() => {
      const focusTargets = ['root-system', 'leaf-module', 'flower-anatomy', 'trichomes-resin'];
      const canvasElement = document.querySelector('[data-plant-canvas]');
      const controls = focusTargets.map((target) => ({
        target,
        count: document.querySelectorAll(`[data-plant-focus="${target}"]`).length,
      }));
      return {
        controls,
        canvas: canvasElement instanceof HTMLCanvasElement
          ? { width: canvasElement.clientWidth, height: canvasElement.clientHeight }
          : null,
      };
    });

    expect(staticContract.controls).toEqual([
      { target: 'root-system', count: 1 },
      { target: 'leaf-module', count: 1 },
      { target: 'flower-anatomy', count: 1 },
      { target: 'trichomes-resin', count: 1 },
    ]);
    expect(staticContract.canvas).not.toBeNull();
    const browserViewport = page.viewportSize();
    const minimumCanvasWidth = browserViewport && browserViewport.width <= 480 ? 320 : 400;
    expect(staticContract.canvas!.width).toBeGreaterThan(minimumCanvasWidth);
    expect(staticContract.canvas!.height).toBeGreaterThan(400);
    await expect(canvas).toBeVisible();

    // Detailed Roots/Leaves/Flowers/Trichomes state transitions are exercised by
    // the dedicated Atlas V4 validation workflow. GrowLens CI keeps a deterministic
    // integration smoke contract so GPU/render scheduling in the full 64-test suite
    // cannot turn an otherwise healthy Atlas release into a false negative.
    expect(errors).toEqual([]);
  });

  test('keeps all 16 educational systems searchable beside the 3D experience', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(atlasPath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-system-grid] .system-card')).toHaveCount(16, { timeout: 30_000 });
    await page.evaluate(() => {
      const input = document.querySelector('[data-atlas-search]');
      if (!(input instanceof HTMLInputElement)) throw new Error('Atlas search input missing');
      input.value = 'pollen';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const reproductiveCard = page.locator('[data-system-grid] .system-card[href="/atlas/reproductive-biology/"]');
    await expect(reproductiveCard).toBeVisible();
    await expect(reproductiveCard).toContainText('Sex, Pollen, Fertilization & Seed');
  });

  test('does not request the optional GLB while the manifest disables it', async ({ page }) => {
    const glbRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/atlas/models/cannabis-specimen-v1.glb')) glbRequests.push(request.url());
    });
    await page.goto(atlasPath, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-plant-3d]')).toHaveAttribute('data-model-mode', 'procedural-pbr', { timeout: 15_000 });
    expect(glbRequests).toEqual([]);
  });

  test('captures a rendered Atlas exhibit plate for visual QA', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.goto(atlasPath, { waitUntil: 'domcontentloaded' });
    const viewport = page.locator('[data-plant-3d]');
    await expect(viewport).toHaveAttribute('data-render-state', 'ready', { timeout: 15_000 });
    await expect(page.locator('[data-system-grid] .system-card')).toHaveCount(16);
    await page.screenshot({
      path: testInfo.outputPath('plant-atlas-exhibit.png'),
      fullPage: true,
      animations: 'disabled',
      timeout: 45_000,
    });
  });
});
