import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4191;
const URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
let server;
let browser;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Seed Man UI v3 test server did not start.');
}

async function assertLevel(page, id, worldTitle, order) {
  await page.evaluate((levelId) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel(levelId), id);
  await page.waitForFunction((levelId) => document.querySelector('.game-shell')?.dataset.levelId === levelId, id);
  const state = await page.evaluate(() => ({
    ui: window.__SPROUT_UI_V3__?.version,
    htmlUi: document.documentElement.dataset.seedManUi,
    world: document.querySelector('.game-shell')?.dataset.worldLabel,
    order: document.querySelector('.game-shell')?.dataset.levelOrder,
    context: document.querySelector('.seed-run-context')?.innerText || '',
    stage: document.querySelector('#course-stage')?.innerText || '',
    aria: document.querySelector('.course-status')?.getAttribute('aria-label') || ''
  }));
  assert.equal(state.ui, 'seed-man-ui-v3');
  assert.equal(state.htmlUi, 'seed-man-ui-v3');
  assert.equal(state.world, worldTitle);
  assert.equal(state.order, String(order));
  assert.match(state.context, new RegExp(worldTitle, 'i'));
  assert.match(state.context, new RegExp(`LEVEL ${order} / 15`, 'i'));
  assert.ok(/Opening Route|Mid Route|Final Run/.test(state.stage));
  assert.match(state.aria, /route progress/i);
}

try {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktop.goto(URL, { waitUntil: 'networkidle' });
  await desktop.waitForFunction(() => window.__SPROUT_UI_V3__?.version === 'seed-man-ui-v3');
  await assertLevel(desktop, 'sprout-run', 'Greenhouse District', 1);
  await assertLevel(desktop, 'root-zone-rumble', 'Rootworks', 4);
  await assertLevel(desktop, 'frostline-canopy', 'Sky Garden', 10);
  await assertLevel(desktop, 'genome-spire', 'Genetic Frontier', 15);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(URL, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => window.__SPROUT_UI_V3__?.version === 'seed-man-ui-v3');
  await assertLevel(mobile, 'mutation-marsh', 'Genetic Frontier', 13);
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Seed Man UI v3 caused ${overflow}px horizontal mobile overflow`);
  const contextHeight = await mobile.locator('.seed-run-context').evaluate((node) => node.getBoundingClientRect().height);
  assert.ok(contextHeight >= 44, `campaign context should remain readable on touch screens, got ${contextHeight}px`);
  await mobile.close();

  console.log(JSON.stringify({ ok: true, uiVersion: 'seed-man-ui-v3', campaignAware: true, mobileVerified: true }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
