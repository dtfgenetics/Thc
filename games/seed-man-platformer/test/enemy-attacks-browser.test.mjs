import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4191;
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
  throw new Error('Seed Man enemy attack browser server did not start.');
}

async function attackSnapshot(page) {
  return page.evaluate(() => window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.snapshot?.() || null);
}

try {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.installed === true);
  await page.waitForFunction(() => window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.snapshot?.()?.installed === true, null, { timeout: 5000 });

  assert.equal(window === undefined, false);
  assert.ok(await page.locator('script[data-seed-enemy-attacks-browser="v1"]').count(), 'Seed Man should auto-load the enemy attack browser adapter.');
  assert.equal(await page.evaluate(() => window.__SPROUT_CANVAS_COMPAT__?.enemyAttackBrowserAutoLoad), true);
  assert.equal(await page.evaluate(() => window.__SPROUT_CANVAS_COMPAT__?.enemyAttacksLoaded), true);

  let attacks = await attackSnapshot(page);
  assert.equal(attacks.version, 'seed-man-enemy-attacks-browser-v1');
  assert.equal(attacks.levelId, 'sprout-run');
  assert.ok(attacks.attackers.some((enemy) => enemy.attackPattern === 'burst-shot'));
  assert.ok(attacks.attackers.some((enemy) => enemy.attackPattern === 'ground-wave'));

  await page.evaluate(() => {
    player.x = 1680;
    player.y = 420;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.power = player.power || {};
    player.power.shieldCharges = 1;
    player.power.invulnerableTimer = 0;
  });

  await page.waitForFunction(() => {
    const snap = window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.snapshot?.();
    return Boolean(snap && (snap.telegraphCount > 0 || snap.projectileCount > 0 || snap.hitboxCount > 0));
  }, null, { timeout: 5000 });

  await page.waitForFunction(() => player.power.shieldCharges === 0 || window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.snapshot?.()?.hitsTaken > 0, null, { timeout: 6500 });
  const playerAfter = await page.evaluate(() => ({ shieldCharges: player.power.shieldCharges, invulnerableTimer: player.power.invulnerableTimer, state: player.state }));
  assert.ok(playerAfter.invulnerableTimer > 0, 'Enemy attack hit should grant a post-hit invulnerability window.');
  assert.ok(['shield-bounce', 'hurt'].includes(playerAfter.state), 'Enemy attack hit should apply shield-bounce or hurt feedback.');

  await page.evaluate(() => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel('mycelium-mile'));
  await page.waitForFunction(() => window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.snapshot?.()?.levelId === 'mycelium-mile');
  attacks = await attackSnapshot(page);
  assert.ok(attacks.attackers.some((enemy) => enemy.name === 'Spore Seraph' && enemy.attackPattern === 'radial-burst' && enemy.rank === 'major-boss'), 'Mycelium Mile should expose the major-boss radial pattern.');

  await page.evaluate(() => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel('cloud-nine-citadel'));
  await page.waitForFunction(() => window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.snapshot?.()?.levelId === 'cloud-nine-citadel');
  attacks = await attackSnapshot(page);
  assert.ok(attacks.attackers.some((enemy) => enemy.name === 'Warp Weaver' && enemy.attackPattern === 'blink-strike' && enemy.rank === 'major-boss'), 'Cloud Nine Citadel should expose the major-boss blink strike.');

  assert.equal(errors.length, 0, `Enemy attack browser errors: ${errors.join(' | ')}`);
  console.log('Seed Man enemy attack browser telegraphs, projectiles/hitboxes, shield/hurt feedback, and boss patterns passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
