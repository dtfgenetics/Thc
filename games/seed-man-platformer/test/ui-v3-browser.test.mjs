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
    subtitle: document.querySelector('.seed-game-subtitle')?.textContent?.trim() || '',
    eyebrow: document.querySelector('.hero .eyebrow')?.textContent?.trim() || '',
    lede: document.querySelector('.hero .lede')?.textContent?.trim() || '',
    marker: document.querySelector('#seed-ui-release-marker')?.textContent?.trim() || '',
    summary: document.querySelector('.seed-campaign-summary')?.innerText || '',
    identity: document.documentElement.dataset.seedManCampaignIdentity || '',
    heroIdentity: document.querySelector('.hero')?.dataset.gameIdentity || '',
    description: document.querySelector('meta[name="description"]')?.content || '',
    worldCards: [...document.querySelectorAll('.seed-world-card')].map((node) => ({ world: node.dataset.worldId, level: node.dataset.levelId, text: node.innerText, current: node.getAttribute('aria-current') }))
  }));
  assert.equal(identity.title, 'Seed Man: Greenhouse Gauntlet | DTF Genetics');
  assert.equal(identity.heading, 'Seed Man');
  assert.equal(identity.subtitle, 'GREENHOUSE GAUNTLET');
  assert.match(identity.eyebrow, /Greenhouse Gauntlet/i);
  assert.match(identity.eyebrow, /Grow\. Fight\. Restore\./i);
  assert.match(identity.lede, /Greenhouse District/i);
  assert.match(identity.lede, /Rootworks/i);
  assert.match(identity.lede, /Resin Works/i);
  assert.match(identity.lede, /Sky Garden/i);
  assert.match(identity.lede, /Genetic Frontier/i);
  assert.match(identity.marker, /GROW · FIGHT · RESTORE/i);
  assert.match(identity.summary, /5\s+WORLDS/i);
  assert.match(identity.summary, /15\s+LEVELS/i);
  assert.match(identity.summary, /6\s+BOSSES/i);
  assert.match(identity.summary, /10\s+PHENOTYPES/i);
  assert.equal(identity.identity, 'greenhouse-gauntlet');
  assert.equal(identity.heroIdentity, 'seed-man');
  assert.match(identity.description, /15 levels/i);
  assert.match(identity.description, /five worlds/i);
  assert.equal(identity.worldCards.length, 5);
  assert.deepEqual(identity.worldCards.map((card) => card.world), ['world-01', 'world-02', 'world-03', 'world-04', 'world-05']);
  assert.deepEqual(identity.worldCards.map((card) => card.level), ['sprout-run', 'root-zone-rumble', 'kief-cavern-climb', 'frostline-canopy', 'chromosome-crossing']);
  assert.match(identity.worldCards.map((card) => card.text).join(' '), /Greenhouse District.*Rootworks.*Resin Works.*Sky Garden.*Genetic Frontier/is);
}

async function assertWorldRailNavigation(page) {
  await page.locator('.seed-world-card[data-world-id="world-03"]').click();
  await page.waitForFunction(() => document.querySelector('.game-shell')?.dataset.levelId === 'kief-cavern-climb');
  const state = await page.evaluate(() => ({ selected: document.querySelector('#seed-man-level-select')?.value || '', activeWorld: document.querySelector('.seed-world-card[data-active="true"]')?.dataset.worldId || '', current: document.querySelector('.seed-world-card[data-world-id="world-03"]')?.getAttribute('aria-current') || '', focused: document.activeElement?.id || '' }));
  assert.equal(state.selected, 'kief-cavern-climb');
  assert.equal(state.activeWorld, 'world-03');
  assert.equal(state.current, 'step');
  assert.equal(state.focused, 'game');
}

async function assertEncounterHud(page) {
  const state = await page.evaluate(() => {
    const original = window.__SPROUT_COMBAT_BROWSER__;
    window.__SPROUT_COMBAT_BROWSER__ = Object.freeze({
      installed: true,
      snapshot: () => ({
        activePhenotype: 'solar-flare',
        phenotypeRemaining: 21.4,
        enemies: [{ id: 'visual-boss', name: 'Mite Queen', health: 18, maxHealth: 30, defeated: false, bossRank: 'major' }]
      })
    });
    window.__SPROUT_UI_V3__.sync();
    window.__SPROUT_VISUAL_V4__.sync();
    const shell = document.querySelector('.game-shell');
    const canvas = document.querySelector('#game');
    const result = {
      phenoHidden: document.querySelector('.seed-pheno-banner')?.hidden,
      phenoName: document.querySelector('.seed-pheno-name')?.textContent || '',
      phenoTime: document.querySelector('.seed-pheno-time')?.textContent || '',
      bossHidden: document.querySelector('.seed-boss-banner')?.hidden,
      bossRank: document.querySelector('.seed-boss-rank')?.textContent || '',
      bossName: document.querySelector('.seed-boss-name')?.textContent || '',
      bossValue: document.querySelector('.seed-boss-value')?.textContent || '',
      bossWidth: document.querySelector('.seed-boss-health i')?.style.width || '',
      shellBoss: shell?.dataset.combatBoss || '',
      shellPhenotype: shell?.dataset.combatPhenotype || '',
      kicker: document.querySelector('.course-kicker')?.textContent || '',
      canvasBorder: canvas ? getComputedStyle(canvas).borderTopColor : ''
    };
    window.__SPROUT_COMBAT_BROWSER__ = original;
    window.__SPROUT_UI_V3__.sync();
    window.__SPROUT_VISUAL_V4__.sync();
    return result;
  });
  assert.equal(state.phenoHidden, false);
  assert.equal(state.phenoName, 'Solar Flare');
  assert.match(state.phenoTime, /22s REMAINING/);
  assert.equal(state.bossHidden, false);
  assert.equal(state.bossRank, 'MAJOR BOSS ENCOUNTER');
  assert.equal(state.bossName, 'Mite Queen');
  assert.equal(state.bossValue, '18 / 30');
  assert.equal(state.bossWidth, '60%');
  assert.equal(state.shellBoss, 'active');
  assert.equal(state.shellPhenotype, 'solar-flare');
  assert.match(state.kicker, /BOSS · Mite Queen/);
  assert.equal(state.canvasBorder, 'rgb(255, 207, 102)');
}

async function assertLevel(page, id, worldTitle, canonicalWorldTitle, order, theme) {
  await page.evaluate((levelId) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel(levelId), id);
  await page.waitForFunction((levelId) => document.querySelector('.game-shell')?.dataset.levelId === levelId, id);
  await page.waitForFunction((expectedTheme) => document.querySelector('.game-shell')?.dataset.worldTheme === expectedTheme, theme);
  const state = await page.evaluate(() => {
    const shell = document.querySelector('.game-shell');
    return {
      ui: window.__SPROUT_UI_V3__?.version,
      visual: window.__SPROUT_VISUAL_V4__?.version,
      htmlUi: document.documentElement.dataset.seedManUi,
      htmlVisual: document.documentElement.dataset.seedManVisual,
      htmlWorld: document.documentElement.dataset.seedManWorld,
      world: shell?.dataset.worldLabel,
      canonicalWorld: shell?.dataset.canonicalWorldLabel,
      theme: shell?.dataset.worldTheme,
      visualReady: shell?.dataset.visualV4,
      order: shell?.dataset.levelOrder,
      context: document.querySelector('.seed-run-context')?.innerText || '',
      stage: document.querySelector('#course-stage')?.innerText || '',
      aria: document.querySelector('.course-status')?.getAttribute('aria-label') || '',
      worldAccent: shell ? getComputedStyle(shell).getPropertyValue('--world-accent').trim() : '',
      worldScene: shell ? getComputedStyle(shell).getPropertyValue('--world-scene').trim() : '',
      activeWorld: document.querySelector('.seed-world-card[data-active="true"]')?.dataset.worldId || ''
    };
  });
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
  assert.notEqual(state.worldScene, 'none', `world ${theme} should expose a scene treatment`);
  assert.match(state.worldScene, /gradient/i, `world ${theme} should use layered atmosphere gradients`);
  assert.match(state.context, new RegExp(worldTitle, 'i'));
  assert.match(state.context, new RegExp(`LEVEL ${order} / 15`, 'i'));
  assert.ok(/Opening Route|Mid Route|Final Run/.test(state.stage));
  assert.match(state.aria, /route progress/i);
  const expectedWorld = order <= 3 ? 'world-01' : order <= 6 ? 'world-02' : order <= 9 ? 'world-03' : order <= 11 ? 'world-04' : 'world-05';
  assert.equal(state.activeWorld, expectedWorld);
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
  await assertWorldRailNavigation(desktop);
  await assertEncounterHud(desktop);
  await assertLevel(desktop, 'sprout-run', 'Greenhouse District', 'Greenhouse District', 1, 'greenhouse');
  await assertLevel(desktop, 'root-zone-rumble', 'Rootworks', 'Rootworks', 4, 'rootworks');
  await assertLevel(desktop, 'frostline-canopy', 'Sky Garden', 'Sky Garden', 10, 'sky');
  await assertLevel(desktop, 'genome-spire', 'Genetic Frontier', 'Genetic Frontier', 15, 'genetic');
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(URL, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => window.__SPROUT_VISUAL_V4__?.version === 'seed-man-visual-v4');
  await assertCampaignIdentity(mobile);
  await assertLevel(mobile, 'mutation-marsh', 'Genetic Frontier', 'Genetic Frontier', 13, 'genetic');
  const mobileMetrics = await mobile.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    contextHeight: document.querySelector('.seed-run-context')?.getBoundingClientRect().height || 0,
    touchMinHeight: Math.min(...[...document.querySelectorAll('.touch-controls button')].map((node) => node.getBoundingClientRect().height)),
    summaryHeight: document.querySelector('.seed-campaign-summary')?.getBoundingClientRect().height || 0,
    worldRailHeight: document.querySelector('.seed-world-rail')?.getBoundingClientRect().height || 0
  }));
  assert.ok(mobileMetrics.overflow <= 1, `Seed Man visual v4 caused ${mobileMetrics.overflow}px horizontal mobile overflow`);
  assert.ok(mobileMetrics.contextHeight >= 44, `campaign context should remain readable on touch screens, got ${mobileMetrics.contextHeight}px`);
  assert.ok(mobileMetrics.touchMinHeight >= 72, `touch controls should remain game-sized, got ${mobileMetrics.touchMinHeight}px`);
  assert.ok(mobileMetrics.summaryHeight >= 80, `campaign summary should remain readable on touch screens, got ${mobileMetrics.summaryHeight}px`);
  assert.ok(mobileMetrics.worldRailHeight >= 48, `world rail should remain visible on touch screens, got ${mobileMetrics.worldRailHeight}px`);
  await mobile.close();

  console.log(JSON.stringify({ ok: true, uiVersion: 'seed-man-ui-v3', visualVersion: 'seed-man-visual-v4', campaignAware: true, campaignIdentity: 'greenhouse-gauntlet', worldRail: true, encounterHud: true, bossVisualState: true, approvedWorldNames: true, themedWorlds: true, worldAtmosphere: true, mobileVerified: true }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
