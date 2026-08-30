import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4181;
const LOCAL_ORIGIN = `http://127.0.0.1:${PORT}`;
const LOCAL_GAME_URL = `${LOCAL_ORIGIN}/games/seed-man-platformer/`;
const configuredUrl = process.env.SPROUT_GAME_URL?.trim();
const isLive = Boolean(configuredUrl);
const baseUrl = configuredUrl || LOCAL_GAME_URL;
const GAME_URL = isLive
  ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}sprout_browser=${Date.now()}`
  : baseUrl;

let server;
let browser;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  if (isLive) return;
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(LOCAL_GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error('Sprout Run static test server did not start.');
}

async function waitForGameReady(page) {
  await page.locator('#game').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const status = document.querySelector('#load-status');
    return status && status.dataset.state === 'progress' && /24/.test(status.textContent || '');
  });
  await page.waitForFunction(() => {
    try {
      return Boolean(player && level && player.grounded);
    } catch {
      return false;
    }
  });
}

async function snapshot(page) {
  return page.evaluate(() => ({
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    grounded: player.grounded,
    state: player.state,
    airJumpsRemaining: player.airJumpsRemaining,
    checkpointId: player.checkpoint?.id,
    deaths: player.deaths,
    sprouts: player.collected.length,
    powerups: player.collectedPowerups.length,
    shieldCharges: player.power?.shieldCharges || 0,
    finished: player.finished,
    paused
  }));
}

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function tapKey(page, key) {
  await page.keyboard.down(key);
  await sleep(35);
  await page.keyboard.up(key);
}

async function runDesktopAcceptance(page) {
  const errors = collectErrors(page);
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await waitForGameReady(page);

  assert.match(await page.title(), /Seed Man: Sprout Run/i);
  assert.equal((await page.locator('#sprout-count').innerText()).trim(), '0 / 24');
  assert.equal((await page.locator('#jump-count').innerText()).trim(), '2 jumps ready');
  assert.equal((await page.locator('#progress-count').innerText()).trim(), '1%');
  assert.equal(await page.locator('[data-control="jump"]').innerText(), 'JUMP ×2');

  await page.locator('#game').focus();
  const beforeMove = await snapshot(page);
  await page.keyboard.down('ArrowRight');
  await sleep(280);
  await page.keyboard.up('ArrowRight');
  const afterMove = await snapshot(page);
  assert.ok(afterMove.x > beforeMove.x + 25, `Keyboard movement did not advance Seed Man enough: ${beforeMove.x} -> ${afterMove.x}`);

  await tapKey(page, 'Space');
  await sleep(90);
  const firstJump = await snapshot(page);
  assert.equal(firstJump.grounded, false, 'First jump should leave the ground.');
  assert.ok(firstJump.vy < 0, `First jump should have upward velocity, got ${firstJump.vy}`);
  assert.equal(firstJump.airJumpsRemaining, 1, 'First jump should preserve the one air jump.');
  assert.match((await page.locator('#jump-count').innerText()).trim(), /Double jump ready/);

  await tapKey(page, 'Space');
  await sleep(70);
  const secondJump = await snapshot(page);
  assert.equal(secondJump.airJumpsRemaining, 0, 'Double jump should consume the air jump.');
  assert.equal(secondJump.state, 'double-jump', `Expected double-jump state, got ${secondJump.state}`);
  assert.ok(secondJump.vy < 0, `Double jump should renew upward velocity, got ${secondJump.vy}`);
  assert.equal((await page.locator('#jump-count').innerText()).trim(), 'Landing resets');

  await page.locator('#pause').click();
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
  const pausedBefore = await snapshot(page);
  await sleep(180);
  const pausedAfter = await snapshot(page);
  assert.equal(pausedAfter.paused, true);
  assert.ok(Math.abs(pausedAfter.x - pausedBefore.x) < 0.01, 'Paused game should not change horizontal position.');
  assert.ok(Math.abs(pausedAfter.y - pausedBefore.y) < 0.01, 'Paused game should not change vertical position.');
  await page.locator('#pause').click();
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'false');

  await page.evaluate(() => {
    const target = level.pickups[0];
    player.x = target.x;
    player.y = target.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.waitForFunction(() => document.querySelector('#sprout-count')?.textContent?.trim() === '1 / 24');
  assert.equal((await snapshot(page)).sprouts, 1);

  await page.evaluate(() => {
    const target = level.powerups[0];
    player.x = target.x;
    player.y = target.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.waitForFunction(() => /Speed/.test(document.querySelector('#power-count')?.textContent || ''));
  assert.ok((await snapshot(page)).powerups >= 1, 'Speed power-up should be collected by the live runtime.');

  await page.evaluate(() => {
    const target = level.checkpoints[0];
    player.x = target.x;
    player.y = target.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.waitForFunction(() => player.checkpoint?.id === level.checkpoints[0].id);
  const checkpointState = await snapshot(page);
  assert.equal(checkpointState.checkpointId, 'checkpoint-1');

  const deathsBefore = checkpointState.deaths;
  await page.evaluate(() => {
    const hazard = level.hazards[3];
    player.power.invulnerableTimer = 0;
    player.power.shieldCharges = 0;
    player.x = hazard.x;
    player.y = hazard.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.waitForFunction((expected) => Number(document.querySelector('#death-count')?.textContent || 0) > expected, deathsBefore);
  const afterHazard = await snapshot(page);
  assert.equal(afterHazard.deaths, deathsBefore + 1, 'Unshielded hazard should count one fall.');
  assert.equal(afterHazard.checkpointId, 'checkpoint-1', 'Hazard respawn should preserve the activated checkpoint.');

  await page.evaluate(() => {
    player.x = level.finish.x - player.width;
    player.y = level.finish.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.waitForFunction(() => document.querySelector('#load-status')?.dataset.state === 'blocked');
  assert.match(await page.locator('#load-status').innerText(), /Flag locked/i);

  await page.evaluate(() => {
    player.collected = level.pickups.map((pickup) => pickup.id);
    player.x = level.finish.x - player.width;
    player.y = level.finish.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
  });
  await page.locator('#finish-panel').waitFor({ state: 'visible' });
  assert.match(await page.locator('#finish-summary').innerText(), /24 of 24 sprouts/i);
  assert.equal((await snapshot(page)).finished, true);

  await page.locator('#play-again').click();
  await page.waitForFunction(() => document.querySelector('#sprout-count')?.textContent?.trim() === '0 / 24');
  assert.equal((await snapshot(page)).finished, false);

  assert.equal(errors.length, 0, `Desktop browser errors: ${errors.join(' | ')}`);
  return { errors: errors.length };
}

async function runMobileAcceptance(page) {
  const errors = collectErrors(page);
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await waitForGameReady(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Mobile layout overflows horizontally by ${overflow}px`);
  await page.locator('.touch-controls').waitFor({ state: 'visible' });
  const jumpButton = page.locator('[data-control="jump"]');
  const rightButton = page.locator('[data-control="right"]');
  assert.equal(await jumpButton.innerText(), 'JUMP ×2');
  assert.ok((await jumpButton.boundingBox())?.height >= 72, 'Mobile jump target should be at least 72px tall.');

  const beforeTouchMove = await snapshot(page);
  await rightButton.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  await sleep(280);
  await rightButton.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  const afterTouchMove = await snapshot(page);
  assert.ok(afterTouchMove.x > beforeTouchMove.x + 25, `Touch movement did not advance Seed Man enough: ${beforeTouchMove.x} -> ${afterTouchMove.x}`);

  await jumpButton.dispatchEvent('pointerdown', { pointerId: 8, pointerType: 'touch', isPrimary: true });
  await jumpButton.dispatchEvent('pointerup', { pointerId: 8, pointerType: 'touch', isPrimary: true });
  await sleep(90);
  const firstTouchJump = await snapshot(page);
  assert.equal(firstTouchJump.grounded, false, 'Touch jump should leave the ground.');
  assert.ok(firstTouchJump.vy < 0, `Touch jump should have upward velocity, got ${firstTouchJump.vy}`);

  await jumpButton.dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true });
  await jumpButton.dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true });
  await sleep(70);
  const secondTouchJump = await snapshot(page);
  assert.equal(secondTouchJump.airJumpsRemaining, 0, 'Touch double jump should consume the air jump.');
  assert.equal(secondTouchJump.state, 'double-jump');

  assert.equal(errors.length, 0, `Mobile browser errors: ${errors.join(' | ')}`);
  return { overflow, errors: errors.length };
}

try {
  if (!isLive) {
    server = spawn('python3', [
      '-m', 'http.server', String(PORT),
      '--bind', '127.0.0.1',
      '--directory', 'site/public-route-patch'
    ], { stdio: 'ignore' });
  }

  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const desktopResult = await runDesktopAcceptance(desktop);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobileResult = await runMobileAcceptance(mobile);

  console.log(JSON.stringify({
    ok: true,
    mode: isLive ? 'live-production' : 'local-public-route',
    url: GAME_URL,
    desktop: '1280x900',
    mobile: '390x844',
    keyboardMovement: true,
    keyboardDoubleJump: true,
    pauseResume: true,
    sproutCollection: true,
    powerupCollection: true,
    checkpointRespawn: true,
    finishGate: true,
    finishAndRestart: true,
    touchMovement: true,
    touchDoubleJump: true,
    desktopConsoleErrors: desktopResult.errors,
    mobileConsoleErrors: mobileResult.errors,
    mobileOverflowPx: mobileResult.overflow
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}