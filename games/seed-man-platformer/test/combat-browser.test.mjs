import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4187;
const GAME_URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
let server;
let browser;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Seed Man combat browser server did not start.');
}

async function snapshot(page) {
  return page.evaluate(() => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null);
}

async function selectLevel(page, levelId) {
  await page.evaluate((id) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel(id), levelId);
  await page.waitForFunction((id) => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.levelId === id, levelId, { timeout: 3000 });
  return snapshot(page);
}

async function fireAt(page, enemyId, hits) {
  for (let index = 0; index < hits; index += 1) {
    const before = await snapshot(page);
    const target = before.enemies.find((enemy) => enemy.id === enemyId);
    assert.ok(target, `Missing combat enemy ${enemyId}`);
    if (target.defeated) return;

    await page.evaluate((id) => {
      player.x = id === 'combat-static-mite' ? 2680 : 760;
      player.y = 434;
      player.vx = 30;
      player.vy = 0;
      player.grounded = true;
      player.power = player.power || {};
      player.power.invulnerableTimer = Math.max(Number(player.power.invulnerableTimer) || 0, 3);
    }, enemyId);

    await page.keyboard.press('j');
    await page.waitForFunction(({ enemyId, previousHealth }) => {
      const enemy = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.().enemies.find((entry) => entry.id === enemyId);
      return Boolean(enemy && (enemy.defeated || enemy.health < previousHealth));
    }, { enemyId, previousHealth: target.health }, { timeout: 1800 });
    await sleep(220);
  }
}

try {
  server = spawn('python3', [
    '-m', 'http.server', String(PORT),
    '--bind', '127.0.0.1',
    '--directory', 'site/public-route-patch'
  ], { stdio: 'ignore' });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof player !== 'undefined' && Boolean(player));
  await page.waitForFunction(() => window.__SPROUT_CANVAS_COMPAT__?.combatBrowserAutoLoad === true);
  await page.waitForFunction(() => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.installed === true);

  assert.ok(await page.locator('script[data-seed-combat-browser="v1"]').count(), 'Public route should auto-load the combat browser adapter.');
  assert.equal((await page.locator('#combat-weapon-count').innerText()).trim(), 'Seed Slinger');
  assert.equal((await page.locator('#combat-phenotype-count').innerText()).trim(), 'None');
  await page.locator('#combat-threat-count').waitFor({ state: 'visible' });
  await page.locator('[data-combat="attack"]').waitFor({ state: 'visible' });
  await page.locator('[data-combat="ability"]').waitFor({ state: 'visible' });

  let combat = await snapshot(page);
  assert.equal(combat.phenotypeAbsorbVersion, 'seed-man-phenotype-absorb-v1');
  assert.equal(combat.phenotypeExpansionVersion, 'seed-man-phenotype-expansion-v1');
  assert.equal(combat.levelId, 'sprout-run');
  assert.equal(combat.enemies.length, 6);
  assert.ok(combat.enemies.some((enemy) => enemy.flying), 'Greenhouse Gauntlet should contain a flying enemy.');
  assert.equal(combat.defeated, 0);

  await fireAt(page, 'combat-aphid-01', 2);
  combat = await snapshot(page);
  assert.equal(combat.enemies.find((enemy) => enemy.id === 'combat-aphid-01').defeated, true, 'Seed Slinger should defeat the first authored enemy.');
  assert.ok(combat.resources.resin >= 2, 'Defeated enemies should award resources.');

  await fireAt(page, 'combat-static-mite', 4);
  combat = await snapshot(page);
  assert.equal(combat.enemies.find((enemy) => enemy.id === 'combat-static-mite').defeated, true, 'Elite phenotype carrier should be defeatable with weapon fire.');
  assert.equal(combat.activePhenotype, 'static-haze');
  assert.ok(combat.phenotypeRemaining > 29 && combat.phenotypeRemaining <= 30, 'Elite power should start a 30-second temporary form.');
  assert.ok(combat.discoveredPhenotypes.includes('static-haze'));
  assert.match((await page.locator('#combat-phenotype-count').innerText()).trim(), /Static Haze/i);
  assert.match((await page.locator('#combat-phenotype-time').innerText()).trim(), /30s|29s/i);
  assert.match((await page.locator('[data-combat="ability"]').innerText()).trim(), /PHENO\s+(30|29)/i);
  assert.equal(await page.locator('html').getAttribute('data-seed-pheno-active'), 'true');

  await page.keyboard.press('k');
  await sleep(50);
  combat = await snapshot(page);
  assert.ok(combat.projectiles.some((projectile) => projectile.ability && projectile.effect === 'chain'), 'Absorbed Static Haze should fire a chain-lightning phenotype projectile.');

  await page.evaluate(() => { player.vx = 180; });
  await sleep(1100);
  combat = await snapshot(page);
  assert.ok(combat.phenotypeRemaining < 29.5, 'Phenotype timer should count down during active play.');

  const resinBeforeReset = combat.resources.resin;
  await page.evaluate(() => reset());
  combat = await snapshot(page);
  assert.equal(combat.activePhenotype, null, 'Reset should clear the temporary absorbed form.');
  assert.equal(combat.phenotypeRemaining, 0, 'Reset should clear the temporary form timer.');
  assert.ok(combat.discoveredPhenotypes.includes('static-haze'), 'Discovered phenotypes should persist across game resets.');
  assert.equal(combat.resources.resin, resinBeforeReset, 'Collected progression resources should persist across game resets.');
  assert.equal((await page.locator('#combat-phenotype-count').innerText()).trim(), 'None');
  assert.equal(await page.locator('html').getAttribute('data-seed-pheno-active'), 'false');

  combat = await selectLevel(page, 'reservoir-run');
  assert.ok(combat.enemies.some((enemy) => enemy.flying && enemy.phenotype === 'terpene-tempest'), 'Reservoir Run should include the flying Tempest phenotype carrier.');
  assert.ok(combat.enemies.some((enemy) => enemy.bossRank === 'minor' && enemy.flying), 'Reservoir Run should include a flying minor boss.');

  combat = await selectLevel(page, 'mycelium-mile');
  assert.ok(combat.enemies.some((enemy) => enemy.bossRank === 'major' && enemy.flying), 'Mycelium Mile should include a flying major boss.');
  assert.match((await page.locator('#combat-threat-count').innerText()).trim(), /Spore Seraph/i);
  assert.equal(await page.locator('#combat-threat-count').getAttribute('data-rank'), 'major');

  combat = await selectLevel(page, 'cloud-nine-citadel');
  assert.ok(combat.enemies.some((enemy) => enemy.blink && enemy.phenotype === 'gravity-haze'), 'Cloud Nine Citadel should include a warp phenotype carrier.');
  assert.ok(combat.enemies.some((enemy) => enemy.bossRank === 'major' && enemy.blink), 'Cloud Nine Citadel should include a blinking major boss.');

  assert.equal(errors.length, 0, `Browser combat errors: ${errors.join(' | ')}`);
  console.log('Seed Man public-route combat, full encounter roster, flying/blink enemies, boss HUD, timed absorption, persistence, and level-aware combat passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}