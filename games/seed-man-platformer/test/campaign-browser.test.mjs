import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../../site/public-route-patch', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startServer(port = 4183) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = decodeURIComponent(url.pathname);
      const relative = pathname === '/' ? 'games/seed-man-platformer/index.html' : pathname.replace(/^\/+/, '');
      const safe = normalize(relative).replace(/^\.\.(\/|\\|$)/, '');
      let path = join(root, safe);
      if (pathname.endsWith('/')) path = join(root, safe, 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function waitForRuntime(page) {
  await page.locator('#game').waitFor({ state: 'visible' });
  await page.waitForFunction(() => typeof window.__SPROUT_CAMPAIGN__?.snapshot === 'function');
}

async function selectLevel(page, id) {
  await page.evaluate((levelId) => window.__SPROUT_CAMPAIGN__.select(levelId), id);
  await page.waitForFunction((levelId) => window.__SPROUT_CAMPAIGN__.snapshot().selectedLevelId === levelId, id);
}

async function verifyCampaignContract(page) {
  const contract = await page.evaluate(() => window.__SPROUT_CAMPAIGN__.snapshot());
  assert.equal(contract.version, 'seed-man-campaign-experience-v3');
  assert.equal(contract.levelCount, 15);
  assert.equal(contract.worldCount, 5);
  assert.equal(contract.selectedLevelId, 'sprout-run');
  assert.equal(contract.levels.length, 15);
  assert.deepStrictEqual(contract.worlds.map((world) => world.id), [
    'greenhouse-gauntlet', 'hydroponic-depths', 'outdoor-frontier', 'extraction-labs', 'genetic-frontier'
  ]);
  assert.deepStrictEqual(contract.worlds.map((world) => world.levelCount), [3, 3, 3, 3, 3]);
  assert.equal(contract.worlds.at(-1).boss, 'Genome Hydra');
  assert.equal(contract.signatures.version, 'seed-man-world-signatures-v1');
}

async function verifyLevelSelection(page) {
  const expectations = [
    ['sprout-run'],
    ['nursery-night-shift', 'nursery-night', 'bounce-pads', 'Propagation mist'],
    ['greenhouse-gauntlet', 'greenhouse', 'hazard-sweep', 'Mite Queen'],
    ['reservoir-run', 'hydro', 'current-reversal', 'Current Reversal'],
    ['root-zone-rush', 'hydro', 'root-platforms', 'Root Raft'],
    ['nutrient-lockout-lab', 'hydro', 'lockout-gates', 'Lockout Gate'],
    ['ridge-line-run', 'outdoor', 'gust-zones', 'Gust Chain'],
    ['kief-cavern-climb', 'outdoor', 'bounce-pads', 'Crystal Chain'],
    ['pest-canyon', 'outdoor', 'wind-gaps', 'Pest Canyon'],
    ['pressure-vessel', 'lab', 'pressure-cycle', 'Pressure Pulse'],
    ['winterization-run', 'lab', 'freeze-zones', 'Winterization'],
    ['vacuum-chamber', 'lab', 'vacuum-pulses', 'Vacuum Pulse'],
    ['gene-bank', 'genetic', 'gene-gates', 'Gene Gate'],
    ['hybrid-lab', 'genetic', 'gene-gates', 'Recombination Gate'],
    ['genome-spire', 'genetic', 'gene-gates', 'Genome Hydra']
  ];

  const contract = await page.evaluate(() => window.__SPROUT_CAMPAIGN__.snapshot());
  for (const [id, theme, mechanic, signatureName] of expectations) {
    await selectLevel(page, id);
    const state = await page.evaluate(() => ({
      id: level.id,
      selected: window.__SPROUT_CAMPAIGN__.snapshot().selectedLevelId,
      title: document.querySelector('#seed-world-progress')?.textContent || '',
      requiredPickups: level.requiredPickups,
      theme: level.theme,
      bodyTheme: document.body.dataset.seedTheme,
      setting: level.setting || '',
      mechanicTypes: [...new Set((level.mechanicZones || []).map((zone) => zone.type))],
      signatureName: document.querySelector('#seed-signature-name')?.textContent || '',
      outOfBounds: [...level.platforms, ...level.hazards].filter((rect) => rect.x < 0 || rect.x + rect.width > level.worldWidth + 0.01).length
    }));
    assert.equal(state.id, id);
    assert.equal(state.selected, id);
    assert.match(state.title, /Level \d+ \/ 15/);
    assert.ok(state.requiredPickups >= 16);
    assert.equal(state.outOfBounds, 0, `${id} must not expose out-of-bounds runtime geometry`);
    if (theme) {
      assert.equal(state.theme, theme);
      assert.equal(state.bodyTheme, theme);
      assert.ok(state.setting.length >= 30);
      assert.deepStrictEqual(state.mechanicTypes, [mechanic]);
      if (signatureName) assert.equal(windowValue(contract.signatures.features, id), signatureName);
    }
  }
}

function windowValue(record, key) {
  return record?.[key];
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
    window.__SEED_BOUNCE_ASSERTION__ = null;
    return { zoneY: zone.y };
  });
  await page.waitForFunction(() => {
    if (player.state !== 'boost-bounce' || player.vy >= 0) return false;
    window.__SEED_BOUNCE_ASSERTION__ = { y: player.y, vy: player.vy, state: player.state };
    return true;
  });
  const after = await page.evaluate(() => window.__SEED_BOUNCE_ASSERTION__);
  assert.equal(after.state, 'boost-bounce');
  assert.ok(after.vy < -500, `Nursery bounce pad should launch Seed Man, got vy=${after.vy}`);
  assert.ok(after.y < result.zoneY);
  assert.match(await page.locator('#seed-signature-detail').innerText(), /Propagation mist/i);
}

async function testCurrentReversal(page) {
  await selectLevel(page, 'reservoir-run');
  const before = await page.evaluate(() => {
    const zone = level.mechanicZones[0];
    player.x = zone.x + zone.width / 2 - player.width / 2;
    player.y = zone.y + zone.height - player.height - 8;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    return { x: player.x, vx: player.vx };
  });
  await sleep(320);
  const after = await page.evaluate(() => ({ x: player.x, vx: player.vx, state: player.state }));
  assert.ok(
    Math.abs(after.x - before.x) > 0.5 || Math.abs(after.vx) > 1,
    `Reservoir signature current should carry Seed Man inside an unobstructed flow lane: x ${before.x} -> ${after.x}, vx=${after.vx}`
  );
  assert.match(await page.locator('#seed-signature-state').innerText(), /Current Reversal|Pressure Wave/i);
}

async function testBossAndSettings(page) {
  await selectLevel(page, 'genome-spire');
  const state = await page.evaluate(() => ({
    bossName: level.boss?.name || '',
    bossHp: level.boss?.hp || 0,
    world: level.worldTitle,
    hud: document.querySelector('#seed-run-context')?.textContent || '',
    settingsVersion: window.__SPROUT_SHARED_PLATFORM__?.version || ''
  }));
  assert.equal(state.bossName, 'Genome Hydra');
  assert.ok(state.bossHp > 0);
  assert.equal(state.world, 'Genetic Frontier');
  assert.match(state.hud, /Genome Spire|Genetic Frontier/i);
  assert.equal(state.settingsVersion, 'seed-man-shared-platform-v1');
}

async function runViewport(browser, viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:4183/games/seed-man-platformer/', { waitUntil: 'domcontentloaded' });
  await waitForRuntime(page);
  await verifyCampaignContract(page);
  await verifyLevelSelection(page);
  await testBounceMechanic(page);
  await testCurrentReversal(page);
  await testBossAndSettings(page);
  assert.equal(errors.length, 0, `${label}: browser errors: ${errors.join(' | ')}`);
  await page.close();
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, { width: 1280, height: 900 }, 'desktop');
  await runViewport(browser, { width: 390, height: 844 }, 'mobile');
  console.log(JSON.stringify({
    ok: true,
    campaign: 'seed-man-campaign-experience-v3',
    worlds: 5,
    levels: 15,
    deterministicBounceCapture: true,
    desktop: '1280x900',
    mobile: '390x844'
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
