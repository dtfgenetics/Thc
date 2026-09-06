import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4182;
const LOCAL_ORIGIN = `http://127.0.0.1:${PORT}`;
const LOCAL_GAME_URL = `${LOCAL_ORIGIN}/games/seed-man-platformer/`;
const configuredUrl = process.env.SPROUT_GAME_URL?.trim();
const isLive = Boolean(configuredUrl);
const GAME_URL = configuredUrl || LOCAL_GAME_URL;

let server;
let browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  if (isLive) return;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(LOCAL_GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Seed Man campaign test server did not start.');
}

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function waitForCampaign(page) {
  await page.locator('#game').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Boolean(window.__SPROUT_CAMPAIGN_EXPERIENCE__ && window.__SPROUT_ANIMATION_V2__));
  await page.locator('#seed-man-campaign-panel').waitFor({ state: 'visible' });
}

async function selectLevel(page, id) {
  await page.evaluate((levelId) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel(levelId), id);
  await page.waitForFunction((levelId) => {
    try { return level?.id === levelId && player && player.checkpoint?.id === 'start'; } catch { return false; }
  }, id);
}

async function testAllLevels(page) {
  const contract = await page.evaluate(() => ({
    campaign: window.__SPROUT_CAMPAIGN_EXPERIENCE__,
    animation: window.__SPROUT_ANIMATION_V2__,
    levels: window.__SPROUT_CAMPAIGN__.listLevels().map((entry) => ({ id: entry.id, order: entry.order, world: entry.worldTitle, boss: entry.boss || null }))
  }));
  assert.equal(contract.campaign.version, 'seed-man-campaign-experience-v3');
  assert.equal(contract.campaign.levelCount, 11);
  assert.equal(contract.campaign.newLevelCount, 10);
  assert.equal(contract.campaign.bossCount, 4);
  assert.equal(contract.animation.version, 'seed-man-animation-v2');
  assert.equal(contract.animation.characterContract, 'seed-man-locked-v1');
  assert.equal(contract.animation.renderer, 'canvas2d-vector-animation');
  assert.equal(contract.animation.poses.length, 8);
  assert.equal(contract.levels.length, 11);

  const expected = [
    ['sprout-run', null, null],
    ['nursery-night-shift', 'nursery', 'bounce-pads'],
    ['reservoir-run', 'hydro', 'flow-zones'],
    ['root-zone-rumble', 'root-zone', 'drag-zones'],
    ['mycelium-mile', 'mycelium', 'updraft-zones'],
    ['trichome-transit', 'trichome', 'boost-zones'],
    ['kief-cavern-climb', 'cavern', 'bounce-pads'],
    ['rosin-refinery-rush', 'refinery', 'heat-vents'],
    ['terpene-tunnel', 'terpene', 'gust-zones'],
    ['frostline-canopy', 'frost', 'slip-zones'],
    ['cloud-nine-citadel', 'citadel', 'wind-zones']
  ];

  for (const [id, theme, mechanic] of expected) {
    await selectLevel(page, id);
    const state = await page.evaluate(() => ({
      id: level.id,
      theme: level.theme || null,
      setting: level.setting || '',
      requiredPickups: level.requiredPickups,
      mechanicTypes: [...new Set((level.mechanicZones || []).map((zone) => zone.type))],
      boss: level.boss?.name || null,
      bodyTheme: document.body.dataset.seedTheme,
      selected: document.querySelector('#seed-man-level-select')?.value,
      title: document.querySelector('#seed-campaign-title')?.textContent || ''
    }));
    assert.equal(state.id, id);
    assert.equal(state.selected, id);
    assert.match(state.title, /Level \d+ \/ 11/);
    assert.ok(state.requiredPickups >= 16);
    if (theme) {
      assert.equal(state.theme, theme);
      assert.equal(state.bodyTheme, theme);
      assert.ok(state.setting.length >= 30);
      assert.deepStrictEqual(state.mechanicTypes, [mechanic]);
    }
  }
}

async function testBounceMechanic(page) {
  await selectLevel(page, 'nursery-night-shift');
  const result = await page.evaluate(() => {
    const zone = level.mechanicZones[0];
    player.x = zone.x + 8;
    player.y = zone.y - player.height - 8;
    player.vx = 0;
    player.vy = 260;
    player.grounded = false;
    return { zoneY: zone.y };
  });
  await page.waitForFunction(() => player.state === 'boost-bounce' && player.vy < 0);
  const after = await page.evaluate(() => ({ y: player.y, vy: player.vy, state: player.state }));
  assert.equal(after.state, 'boost-bounce');
  assert.ok(after.vy < -500, `Nursery bounce pad should launch Seed Man, got vy=${after.vy}`);
  assert.ok(after.y < result.zoneY);
}

async function stompBoss(page, expectedHits) {
  await page.evaluate(() => {
    const boss = level.boss;
    player.x = boss.x + Math.max(8, boss.width * 0.3);
    player.y = boss.y - player.height - 3;
    player.vx = 0;
    player.vy = 310;
    player.grounded = false;
    player.power.invulnerableTimer = 0;
  });
  await page.waitForFunction((hits) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss?.hits >= hits, expectedHits);
}

async function testBossGate(page) {
  await selectLevel(page, 'reservoir-run');
  let boss = await page.evaluate(() => window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss);
  assert.equal(boss.name, 'The Phantom Pump');
  assert.equal(boss.requiredHits, 3);
  assert.equal(boss.defeated, false);

  await page.evaluate(() => {
    player.collected = level.pickups.map((pickup) => pickup.id);
    player.x = level.finish.x - player.width;
    player.y = level.finish.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.waitForFunction(() => player.state === 'boss-gated' && player.finished === false);
  assert.equal(await page.locator('#finish-panel').isVisible(), false, 'boss gate must keep the finish panel hidden');

  for (let hits = 1; hits <= 3; hits += 1) {
    await stompBoss(page, hits);
    if (hits < 3) await sleep(560);
  }
  boss = await page.evaluate(() => window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss);
  assert.equal(boss.hits, 3);
  assert.equal(boss.defeated, true);

  await page.evaluate(() => {
    player.collected = level.pickups.map((pickup) => pickup.id);
    player.x = level.finish.x - player.width;
    player.y = level.finish.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.locator('#finish-panel').waitFor({ state: 'visible' });
  assert.match(await page.locator('#finish-summary').innerText(), /Phantom Pump defeated/i);
  await page.locator('#seed-man-next-level').waitFor({ state: 'visible' });
  assert.match(await page.locator('#seed-man-next-level').innerText(), /Root Zone Rumble/i);
}

async function runViewport(viewport, mobile = false) {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  const errors = collectErrors(page);
  await page.goto(GAME_URL, { waitUntil: isLive ? 'domcontentloaded' : 'networkidle' });
  await waitForCampaign(page);
  await testAllLevels(page);
  if (!mobile) {
    await testBounceMechanic(page);
    await testBossGate(page);
  } else {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `campaign selector caused ${overflow}px mobile overflow`);
    const selectHeight = await page.locator('#seed-man-level-select').evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(selectHeight >= 44, `mobile level selector should be at least 44px tall, got ${selectHeight}`);
  }
  assert.equal(errors.length, 0, `Seed Man campaign browser errors: ${errors.join(' | ')}`);
  await page.close();
}

try {
  if (!isLive) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  }
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runViewport({ width: 1280, height: 900 });
  await runViewport({ width: 390, height: 844 }, true);
  console.log(JSON.stringify({
    ok: true,
    mode: isLive ? 'live-production' : 'local-public-route',
    campaignLevels: 11,
    newLevels: 10,
    worlds: 4,
    bosses: 4,
    uniqueSettings: 10,
    animationVersion: 'seed-man-animation-v2',
    bossGateVerified: true,
    bounceMechanicVerified: true,
    desktop: '1280x900',
    mobile: '390x844'
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
