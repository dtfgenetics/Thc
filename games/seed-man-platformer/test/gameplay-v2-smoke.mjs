import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4182;
const LOCAL_URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
const configured = process.env.SPROUT_GAME_URL?.trim();
const isLive = Boolean(configured);
const GAME_URL = configured || LOCAL_URL;
let server;
let browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  if (isLive) return;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(LOCAL_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Sprout Run gameplay-v2 static server did not start.');
}

try {
  if (!isLive) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  }
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  const url = isLive ? `${GAME_URL}${GAME_URL.includes('?') ? '&' : '?'}gameplay_v2=${Date.now()}` : GAME_URL;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#load-status')?.dataset.state === 'progress' && /24/.test(document.querySelector('#load-status')?.textContent || ''));
  await page.waitForFunction(() => Boolean(window.__SPROUT_GAMEPLAY_V2__?.snapshot));

  const contract = await page.evaluate(() => ({
    version: window.__SPROUT_GAMEPLAY_V2__.version,
    mechanics: [...window.__SPROUT_GAMEPLAY_V2__.mechanics],
    snapshot: window.__SPROUT_GAMEPLAY_V2__.snapshot()
  }));
  assert.equal(contract.version, 'sprout-run-gameplay-v2');
  for (const mechanic of ['moving-platforms','stompable-pests','bounce-pads','particles','screen-shake','squash-stretch']) {
    assert.ok(contract.mechanics.includes(mechanic), `Missing gameplay mechanic ${mechanic}`);
  }
  assert.ok(contract.snapshot.movingPlatforms.length >= 6, 'Expected at least six moving greenhouse platforms.');
  assert.ok(contract.snapshot.pests.length >= 8, 'Expected at least eight stompable pests.');
  assert.ok(contract.snapshot.bouncePads.length >= 4, 'Expected at least four boost pads.');

  const movingBefore = contract.snapshot.movingPlatforms[0].x;
  await page.waitForTimeout(420);
  const movingAfter = await page.evaluate(() => window.__SPROUT_GAMEPLAY_V2__.snapshot().movingPlatforms[0].x);
  assert.ok(Math.abs(movingAfter - movingBefore) > 1, `Moving platform did not move enough: ${movingBefore} -> ${movingAfter}`);

  // Pause the asynchronous live loop and drive the gameplay wrapper one frame at a
  // time. The old assertion sampled player.vy after Playwright observed the stomp,
  // which could be many gravity frames later and intermittently saw the descending
  // phase even though the stomp correctly applied its upward impulse.
  const stompState = await page.evaluate(() => {
    paused = true;
    const pest = window.__SPROUT_GAMEPLAY_V2__.snapshot().pests.find((item) => !item.dead);
    let probe = {
      ...player,
      x: pest.x + pest.width / 2 - player.width / 2,
      y: pest.y - player.height - 12,
      vx: 0,
      vy: 260,
      grounded: false,
      power: { ...player.power, invulnerableTimer: 0 },
      collected: [...player.collected],
      collectedPowerups: [...player.collectedPowerups]
    };
    const stompsBefore = window.__SPROUT_GAMEPLAY_V2__.snapshot().stats.stomps;
    let bounceVy = null;
    let frames = 0;
    for (; frames < 20; frames += 1) {
      probe = stepPlayer(probe, { left: false, right: false, jumpPressed: false, jumpHeld: false }, level, 1 / 60);
      const stats = window.__SPROUT_GAMEPLAY_V2__.snapshot().stats;
      if (stats.stomps > stompsBefore) {
        bounceVy = probe.vy;
        break;
      }
    }
    player = probe;
    paused = false;
    const snapshot = window.__SPROUT_GAMEPLAY_V2__.snapshot();
    return {
      vy: bounceVy,
      frames,
      stomps: snapshot.stats.stomps,
      deadPests: snapshot.pests.filter((item) => item.dead).length
    };
  });
  assert.ok(stompState.stomps >= 1 && stompState.deadPests >= 1, 'Pest stomp did not register.');
  assert.ok(stompState.frames < 20, `Pest stomp did not resolve within the deterministic collision window (${stompState.frames} frames).`);
  assert.ok(stompState.vy <= -490, `Stomp should apply the upward bounce impulse immediately, got vy=${stompState.vy}`);

  await page.evaluate(() => reset());
  await page.waitForTimeout(50);
  const padState = await page.evaluate(() => {
    paused = true;
    const pad = window.__SPROUT_GAMEPLAY_V2__.snapshot().bouncePads[0];
    let probe = {
      ...player,
      x: pad.x + pad.width / 2 - player.width / 2,
      y: pad.y - player.height - 16,
      vx: 0,
      vy: 300,
      grounded: false,
      power: { ...player.power },
      collected: [...player.collected],
      collectedPowerups: [...player.collectedPowerups]
    };
    const bouncesBefore = window.__SPROUT_GAMEPLAY_V2__.snapshot().stats.padBounces;
    let bounceVy = null;
    let frames = 0;
    for (; frames < 20; frames += 1) {
      probe = stepPlayer(probe, { left: false, right: false, jumpPressed: false, jumpHeld: false }, level, 1 / 60);
      const stats = window.__SPROUT_GAMEPLAY_V2__.snapshot().stats;
      if (stats.padBounces > bouncesBefore) {
        bounceVy = probe.vy;
        break;
      }
    }
    player = probe;
    paused = false;
    const snapshot = window.__SPROUT_GAMEPLAY_V2__.snapshot();
    return {
      vy: bounceVy,
      frames,
      padBounces: snapshot.stats.padBounces,
      particles: snapshot.particles
    };
  });
  assert.ok(padState.padBounces >= 1, 'Boost pad did not trigger.');
  assert.ok(padState.frames < 20, `Boost pad did not resolve within the deterministic collision window (${padState.frames} frames).`);
  assert.ok(padState.vy <= -780, `Boost pad should apply its upward launch impulse immediately, got vy=${padState.vy}`);
  assert.ok(padState.particles > 0, 'Boost pad should emit visual feedback particles.');

  assert.equal(errors.length, 0, `Gameplay-v2 browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, mode: isLive ? 'live-production' : 'local-public-route', version: contract.version, movingPlatforms: contract.snapshot.movingPlatforms.length, pests: contract.snapshot.pests.length, bouncePads: contract.snapshot.bouncePads.length, stomp: true, stompBounceVy: stompState.vy, boostPad: true, boostPadVy: padState.vy, particles: true }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}