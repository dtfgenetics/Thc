import { expect, test } from '@playwright/test';

async function startLocalGame(page: import('@playwright/test').Page) {
  await page.goto('/games/high-land/');
  await page.getByRole('button', { name: 'Local Play' }).click();
  await page.getByPlaceholder('Enter your player name').fill('UI Tester');
  await page.getByLabel('Players').selectOption('10');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('.phaser-board canvas')).toBeVisible();
}

test.describe('High Land UI V2', () => {
  test('loads the polished V2 design layer without changing the landing workflow', async ({ page }) => {
    await page.goto('/games/high-land/');

    await expect(page.getByRole('heading', { name: 'High Land: The Sweet Escape' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start High Land' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Local Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible();

    const ui = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const panel = document.querySelector('.game-panel');
      const title = document.querySelector('.title-card');
      const primary = document.querySelector('button.primary');
      return {
        accent: root.getPropertyValue('--hl-lime').trim(),
        panelDisplay: panel ? getComputedStyle(panel).display : '',
        titleRadius: title ? getComputedStyle(title).borderRadius : '',
        primaryRadius: primary ? getComputedStyle(primary).borderRadius : '',
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    expect(ui.accent).toBe('#c8ff62');
    expect(ui.panelDisplay).toBe('grid');
    expect(parseFloat(ui.titleRadius)).toBeGreaterThanOrEqual(20);
    expect(parseFloat(ui.primaryRadius)).toBeLessThan(20);
    expect(ui.horizontalOverflow).toBeLessThanOrEqual(2);
  });

  test('keeps the board dominant and the active-player HUD compact on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop composition is checked in the desktop project.');
    await startLocalGame(page);

    const layout = await page.evaluate(() => {
      const board = document.querySelector('.board-wrap')?.getBoundingClientRect();
      const controls = document.querySelector('.board-controls-card')?.getBoundingClientRect();
      const players = document.querySelector('.players-card')?.getBoundingClientRect();
      const rules = document.querySelector('[aria-label="Game rules"]');
      const active = document.querySelector('.player-chip.active');
      return {
        boardWidth: board?.width ?? 0,
        controlsWidth: controls?.width ?? 0,
        playersHeight: players?.height ?? 0,
        rulesDisplay: rules ? getComputedStyle(rules).display : '',
        activeBackground: active ? getComputedStyle(active).backgroundColor : '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    expect(layout.boardWidth).toBeGreaterThan(layout.controlsWidth * 1.5);
    expect(layout.controlsWidth).toBeLessThanOrEqual(350);
    expect(layout.playersHeight).toBeLessThan(110);
    expect(layout.rulesDisplay).toBe('none');
    expect(layout.activeBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(layout.overflow).toBeLessThanOrEqual(2);
  });

  test('uses touch-safe controls and avoids document overflow on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile composition is checked in the mobile project.');
    await startLocalGame(page);

    const mobile = await page.evaluate(() => {
      const roll = document.querySelector('.roll-button')?.getBoundingClientRect();
      const board = document.querySelector('.board-wrap')?.getBoundingClientRect();
      const actionDock = document.querySelector('.board-button-row');
      const players = document.querySelector('.players-card');
      return {
        rollHeight: roll?.height ?? 0,
        boardWidth: board?.width ?? 0,
        viewportWidth: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        dockPosition: actionDock ? getComputedStyle(actionDock).position : '',
        playersOverflowX: players ? getComputedStyle(players).overflowX : ''
      };
    });

    expect(mobile.rollHeight).toBeGreaterThanOrEqual(56);
    expect(mobile.boardWidth).toBeLessThanOrEqual(mobile.viewportWidth);
    expect(mobile.overflow).toBeLessThanOrEqual(2);
    expect(mobile.dockPosition).toBe('sticky');
    expect(mobile.playersOverflowX).toBe('auto');
  });
});
