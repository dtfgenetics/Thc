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
  throw new Error('Seed Man UI/visual test server did not start.');
}

async function assertCampaignIdentity(page) {
  const identity = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('.hero h1')?.textContent?.trim() || '',
    eyebrow: document.querySelector('.hero .eyebrow')?.textContent?.trim() || '',
    lede: document.querySelector('.hero .lede')?.textContent?.trim() || '',
    marker: document.querySelector('#seed-ui-release-marker')?.textContent?.trim() || '',
    summary: document.querySelector('.seed-campaign-summary')?.innerText || '',
    identity: document.documentElement.dataset.seedManCampaignIdentity || '',
    heroIdentity: document.querySelector('.hero')?.dataset.gameIdentity || '',
    description: document.querySelector('meta[name="description"]')?.content || ''
  }));
  assert.equal(identity.title, 'Seed Man: Sprout Run | DTF Genetics');
  assert.equal(identity.heading, 'Seed Man');
  assert.match(identity.eyebrow, /Sprout Run/i);
  assert.match(identity.eyebrow, /Grow\. Fight\. Restore\./i);
  assert.match(identity.lede, /Greenhouse Valley/i);
  assert.match(identity.lede, /Forest Ruins/i);
  assert.match(identity.lede, /Desert Canyon/i);
  assert.match(identity.lede, /Frozen Peak/i);
  assert.match(identity.lede, /Eco City/i);
  assert.match(identity.marker, /GROW · FIGHT · RESTORE/i);
  assert.match(identity.summary, /5\s+WORLDS/i);
  assert.match(identity.summary, /15\s+LEVELS/i);
  assert.match(identity.summary, /6\s+BOSSES/i);
  assert.match(identity.summary, /10\s+PHENOTYPES/i);
  assert.equal(identity.identity, 'sprout-run');
  assert.equal(identity.heroIdentity, 'sprout-run');
  assert.match(identity.description, /15 levels/i);
  assert.match(identity.description, /Greenhouse Valley/i);
  assert.match(identity.description, /Eco City/i);
}

async function assertLevel(page, id, worldTitle, canonicalWorldTitle, order, theme) {
  await page.evaluate((levelId) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel(levelId), id);
  await page.waitForFunction((levelId) => document.querySelector('.game-shell')?.dataset.levelId === levelId, id);
  await page.waitForFunction((expectedTheme) => document.querySelector('.game-shell')?.dataset.worldTheme === expectedTheme, theme);
  const state = await page.evaluate(() => ({
    ui: window.__SPROUT_UI_V3__?.version,
    visual: window.__SPROUT_VISUAL_V4__?.version,
    htmlUi: document.documentElement.dataset.seedManUi,
    htmlVisual: document.documentElement.dataset.seedManVisual,
    htmlWorld: document.documentElement.dataset.seedManWorld,
    world: document.querySelector('.game-shell')?.dataset.worldLabel,
    canonicalWorld: document.querySelector('.game-shell')?.dataset.canonicalWorldLabel,
    theme: document.querySelector('.game-shell')?.dataset.worldTheme,
    visualReady: document.querySelector('.game-shell')?.dataset.visualV4,
    order: document.querySelector('.game-shell')?.dataset.levelOrder,
    context: document.querySelector('.seed-run-context')?.innerText || '',
    stage: document.querySelector('#course-stage')?.innerText || '',
    aria: document.querySelector('.course-status')?.getAttribute('aria-label') || '',
    worldAccent: getComputedStyle(document.querySelector('.game-shell')).getPropertyValue('--world-accent').trim()
  }));
  assert.equal(state.ui, 'seed-man-ui-v3');
  assert.equal(state.visual, 'seed-man-visual-v4');
  assert.equal(state.htmlUi, 'seed-man-ui-v3');
  assert.equal(state.htmlVisual, 'seed-man-visual-v4');
  assert.equal(state.htmlWorld, theme);
  assert.equal(state.visualReady, 'ready');
  assert.equal(state.world, worldTitle);
  assert.equal(state.canonicalWorld, canonicalWorldTitle);
  assert.equal(state.theme, theme);
  assert.equal(state.order, String(order));
  assert.ok(state.worldAccent, 'world accent should be populated');
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
  await desktop.waitForFunction(() => window.__SPROUT_VISUAL_V4__?.version === 'seed-man-visual-v4');
  await assertCampaignIdentity(desktop);
  await assertLevel(desktop, 'sprout-run', 'Greenhouse Valley', 'Greenhouse District', 1, 'greenhouse');
  await assertLevel(desktop, 'root-zone-rumble', 'Forest Ruins', 'Rootworks', 4, 'rootworks');
  await assertLevel(desktop, 'frostline-canopy', 'Frozen Peak', 'Sky Garden', 10, 'sky');
  await assertLevel(desktop, 'genome-spire', 'Eco City', 'Genetic Frontier', 15, 'genetic');
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(URL, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => window.__SPROUT_VISUAL_V4__?.version === 'seed-man-visual-v4');
  await assertCampaignIdentity(mobile);
  await assertLevel(mobile, 'mutation-marsh', 'Eco City', 'Genetic Frontier', 13, 'genetic');
  const mobileMetrics = await mobile.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    contextHeight: document.querySelector('.seed-run-context')?.getBoundingClientRect().height || 0,
    touchMinHeight: Math.min(...[...document.querySelectorAll('.touch-controls button')].map((node) => node.getBoundingClientRect().height)),
    summaryHeight: document.querySelector('.seed-campaign-summary')?.getBoundingClientRect().height || 0
  }));
  assert.ok(mobileMetrics.overflow <= 1, `Seed Man visual v4 caused ${mobileMetrics.overflow}px horizontal mobile overflow`);
  assert.ok(mobileMetrics.contextHeight >= 44, `campaign context should remain readable on touch screens, got ${mobileMetrics.contextHeight}px`);
  assert.ok(mobileMetrics.touchMinHeight >= 72, `touch controls should remain game-sized, got ${mobileMetrics.touchMinHeight}px`);
  assert.ok(mobileMetrics.summaryHeight >= 80, `campaign summary should remain readable on touch screens, got ${mobileMetrics.summaryHeight}px`);
  await mobile.close();

  console.log(JSON.stringify({ ok: true, uiVersion: 'seed-man-ui-v3', visualVersion: 'seed-man-visual-v4', campaignAware: true, campaignIdentity: 'sprout-run', approvedWorldNames: true, themedWorlds: true, mobileVerified: true }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
