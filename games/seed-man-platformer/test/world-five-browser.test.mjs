import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4195;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_URL = `${ORIGIN}/games/seed-man-platformer/`;
let server;
let browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Seed Man World 5 browser server did not start.');
}

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));
  return errors;
}

async function waitForFrontier(page) {
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.locator('#game').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Boolean(
    window.__SPROUT_CAMPAIGN__?.levelCount === 15 &&
    document.documentElement.dataset.sproutWorldFive === 'seed-man-world-five-v1' &&
    window.__SPROUT_COMBAT_BROWSER__?.installed === true
  ));
  await page.locator('#seed-man-level-select').waitFor({ state: 'visible' });
}

async function selectLevel(page, id) {
  await page.locator('#seed-man-level-select').selectOption(id);
  await page.waitForFunction((levelId) => {
    try {
      return level?.id === levelId &&
        document.body.dataset.seedLevel === levelId &&
        window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.levelId === levelId;
    } catch { return false; }
  }, id);
  await page.waitForTimeout(80);
}

const EXPECTED = Object.freeze([
  {
    id: 'chromosome-crossing',
    order: 12,
    theme: 'chromosome',
    mechanic: 'boost-zones',
    boss: null,
    enemies: ['Ember Beetle', 'Voltage Wasp', 'Cryo Moth']
  },
  {
    id: 'mutation-marsh',
    order: 13,
    theme: 'mutation-marsh',
    mechanic: 'updraft-zones',
    boss: 'Voltage Wasp Alpha',
    enemies: ['Solar Ember Beetle', 'Voltage Wasp Alpha'],
    phenotypes: ['solar-flare', 'static-haze']
  },
  {
    id: 'allele-array',
    order: 14,
    theme: 'allele-array',
    mechanic: 'gust-zones',
    boss: null,
    enemies: ['Voltaic Wasp', 'Cryo Moth Prime'],
    phenotypes: ['static-haze', 'frost-resin']
  },
  {
    id: 'genome-spire',
    order: 15,
    theme: 'genome-spire',
    mechanic: 'wind-zones',
    boss: 'Genome Hydra',
    enemies: ['Solar Ember Guard', 'Static Wasp Guard', 'Frost Moth Guard'],
    phenotypes: ['solar-flare', 'static-haze', 'frost-resin']
  }
]);

async function verifyFrontierContract(page) {
  const contract = await page.evaluate(() => ({
    levelCount: window.__SPROUT_CAMPAIGN__.levelCount,
    newLevelCount: window.__SPROUT_CAMPAIGN__.newLevelCount,
    worlds: window.__SPROUT_CAMPAIGN__.worlds.map((world) => ({ id: world.id, title: world.title, order: world.order })),
    levels: window.__SPROUT_CAMPAIGN__.listLevels().map((entry) => entry.id),
    datasetLevels: document.documentElement.dataset.sproutCampaignLevels,
    worldFiveVersion: document.documentElement.dataset.sproutWorldFive
  }));
  assert.equal(contract.levelCount, 15);
  assert.equal(contract.newLevelCount, 14);
  assert.equal(contract.worlds.length, 5);
  assert.deepStrictEqual(contract.worlds.at(-1), { id: 'world-05', title: 'Genetic Frontier', order: 5 });
  assert.deepStrictEqual(contract.levels.slice(-4), EXPECTED.map((entry) => entry.id));
  assert.equal(contract.datasetLevels, '15');
  assert.equal(contract.worldFiveVersion, 'seed-man-world-five-v1');

  const options = await page.locator('#seed-man-level-select option').evaluateAll((nodes) => nodes.map((node) => node.value));
  assert.deepStrictEqual(options.slice(-4), EXPECTED.map((entry) => entry.id));
}

async function verifyLevel(page, expected) {
  await selectLevel(page, expected.id);
  const state = await page.evaluate(() => ({
    id: level.id,
    levelNumber: level.levelNumber,
    theme: level.theme,
    setting: level.setting,
    requiredPickups: level.requiredPickups,
    worldWidth: level.worldWidth,
    platformCount: level.platforms.length,
    hazardCount: level.hazards.length,
    checkpointCount: level.checkpoints.length,
    mechanicTypes: [...new Set(level.mechanicZones.map((zone) => zone.type))],
    boss: level.boss?.name || null,
    bodyTheme: document.body.dataset.seedTheme,
    selected: document.querySelector('#seed-man-level-select')?.value,
    title: document.querySelector('#seed-campaign-title')?.textContent || '',
    settingText: document.querySelector('#seed-campaign-setting')?.textContent || '',
    outOfBounds: [...level.platforms, ...level.hazards, ...level.pickups, ...level.powerups, ...level.checkpoints, ...level.mechanicZones, level.finish]
      .filter((rect) => rect.x < 0 || rect.x + rect.width > level.worldWidth + 0.01).length,
    combat: window.__SPROUT_COMBAT_BROWSER__.snapshot()
  }));

  assert.equal(state.id, expected.id);
  assert.equal(state.levelNumber, expected.order);
  assert.equal(state.theme, expected.theme);
  assert.equal(state.bodyTheme, expected.theme);
  assert.equal(state.selected, expected.id);
  assert.match(state.title, new RegExp(`Level ${expected.order} / 15`));
  assert.ok(state.setting.length >= 40);
  assert.equal(state.settingText, state.setting);
  assert.ok(state.requiredPickups >= 28);
  assert.ok(state.worldWidth >= 6400 && state.worldWidth <= 6800);
  assert.ok(state.platformCount >= 15);
  assert.ok(state.hazardCount >= 10);
  assert.ok(state.checkpointCount >= 3);
  assert.deepStrictEqual(state.mechanicTypes, [expected.mechanic]);
  assert.equal(state.boss, expected.boss);
  assert.equal(state.outOfBounds, 0, `${expected.id} contains out-of-bounds runtime geometry`);
  assert.equal(state.combat.levelId, expected.id);
  assert.deepStrictEqual(state.combat.enemies.map((enemy) => enemy.name), expected.enemies);
  if (expected.phenotypes) {
    assert.deepStrictEqual(
      state.combat.enemies.filter((enemy) => enemy.phenotype).map((enemy) => enemy.phenotype),
      expected.phenotypes
    );
  }
}

async function verifyCloudNineHandoff(page) {
  await page.locator('#seed-man-level-select').selectOption('cloud-nine-citadel');
  await page.waitForFunction(() => level?.id === 'cloud-nine-citadel');
  await page.evaluate(() => {
    const finish = document.querySelector('#finish-panel');
    finish.hidden = false;
  });
  await page.waitForFunction(() => document.querySelector('#seed-man-next-level')?.textContent?.includes('Chromosome Crossing'));
  assert.match(await page.locator('#seed-man-next-level').innerText(), /Chromosome Crossing/);
}

async function runViewport(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = collectErrors(page);
  await waitForFrontier(page);
  await verifyFrontierContract(page);
  for (const expected of EXPECTED) await verifyLevel(page, expected);
  await verifyCloudNineHandoff(page);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    canvasWidth: document.querySelector('#game')?.getBoundingClientRect().width || 0
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 2, `World 5 page overflows viewport: ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
  assert.ok(dimensions.canvasWidth > 0 && dimensions.canvasWidth <= dimensions.clientWidth + 2);
  assert.equal(errors.length, 0, `Seed Man World 5 browser errors: ${errors.join(' | ')}`);
  await page.close();
}

try {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runViewport({ width: 1280, height: 900 });
  await runViewport({ width: 390, height: 844 });
  console.log(JSON.stringify({
    ok: true,
    campaignLevels: 15,
    worlds: 5,
    worldFiveLevels: EXPECTED.map((entry) => entry.id),
    campaignBosses: ['Voltage Wasp Alpha', 'Genome Hydra'],
    elementalPhenotypes: ['solar-flare', 'static-haze', 'frost-resin'],
    desktop: '1280x900',
    mobile: '390x844',
    cloudNineHandoff: true,
    combatFallbackRemoved: true
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
