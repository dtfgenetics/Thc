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
  await page.waitForFunction(() => Boolean(
    window.__SPROUT_CAMPAIGN_EXPERIENCE__ &&
    window.__SPROUT_ANIMATION_V2__ &&
    window.__SPROUT_SIGNATURE_FEATURES__ &&
    window.__SPROUT_GENERATED_LEVEL_GUARD__ &&
    window.__SPROUT_CAMPAIGN__?.levelCount === 15 &&
    document.documentElement.dataset.sproutCampaignUi === 'seed-man-campaign-ui-v15'
  ));
  await page.locator('#seed-man-campaign-panel').waitFor({ state: 'visible' });
  await page.locator('#seed-signature-hud').waitFor({ state: 'visible' });
}

async function selectLevel(page, id) {
  await page.evaluate((levelId) => window.__SPROUT_CAMPAIGN_EXPERIENCE__.selectLevel(levelId), id);
  await page.waitForFunction((levelId) => {
    try { return level?.id === levelId && player && player.checkpoint?.id === 'start'; } catch { return false; }
  }, id);
  await page.waitForTimeout(40);
}

async function testAllLevels(page) {
  const contract = await page.evaluate(() => ({
    campaign: window.__SPROUT_CAMPAIGN_EXPERIENCE__,
    animation: window.__SPROUT_ANIMATION_V2__,
    signatures: window.__SPROUT_SIGNATURE_FEATURES__,
    guard: window.__SPROUT_GENERATED_LEVEL_GUARD__,
    levels: window.__SPROUT_CAMPAIGN__.listLevels().map((entry) => ({ id: entry.id, order: entry.order, world: entry.worldTitle, boss: entry.boss || null }))
  }));
  assert.equal(contract.campaign.version, 'seed-man-campaign-ui-v15');
  assert.equal(contract.campaign.baseVersion, 'seed-man-campaign-experience-v3');
  assert.equal(contract.campaign.levelCount, 15);
  assert.equal(contract.campaign.newLevelCount, 14);
  assert.equal(contract.campaign.bossCount, 6);
  assert.equal(contract.animation.version, 'seed-man-animation-v2');
  assert.equal(contract.animation.characterContract, 'seed-man-locked-v1');
  assert.equal(contract.animation.renderer, 'canvas2d-vector-animation');
  assert.equal(contract.animation.poses.length, 8);
  assert.equal(contract.signatures.version, 'seed-man-signature-features-v1');
  assert.equal(contract.signatures.levels.length, 10);
  assert.equal(Object.keys(contract.signatures.bossAbilities).length, 4);
  assert.equal(contract.guard.version, 'seed-man-generated-level-guard-v1');
  assert.equal(contract.levels.length, 15);

  const expected = [
    ['sprout-run', null, null, null],
    ['nursery-night-shift', 'nursery', 'bounce-pads', 'Mist Pulse'],
    ['reservoir-run', 'hydro', 'flow-zones', 'Current Reversal'],
    ['root-zone-rumble', 'root-zone', 'drag-zones', 'Root Snare'],
    ['mycelium-mile', 'mycelium', 'updraft-zones', 'Spore Bloom'],
    ['trichome-transit', 'trichome', 'boost-zones', 'Resin Combo'],
    ['kief-cavern-climb', 'cavern', 'bounce-pads', 'Crystal Chain'],
    ['rosin-refinery-rush', 'refinery', 'heat-vents', 'Press Cycle'],
    ['terpene-tunnel', 'terpene', 'gust-zones', 'Polarity Shift'],
    ['frostline-canopy', 'frost', 'slip-zones', 'Frost Momentum'],
    ['cloud-nine-citadel', 'citadel', 'wind-zones', 'Sky Wind Cycle'],
    ['chromosome-crossing', 'chromosome', 'boost-zones', null],
    ['mutation-marsh', 'mutation-marsh', 'updraft-zones', null],
    ['allele-array', 'allele-array', 'gust-zones', null],
    ['genome-spire', 'genome-spire', 'wind-zones', null]
  ];

  for (const [id, theme, mechanic, signatureName] of expected) {
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
      title: document.querySelector('#seed-campaign-title')?.textContent || '',
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
    return { zoneY: zone.y };
  });
  await page.waitForFunction(() => player.state === 'boost-bounce' && player.vy < 0);
  const after = await page.evaluate(() => ({ y: player.y, vy: player.vy, state: player.state }));
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

async function prepareBossSimulation(page) {
  await page.evaluate(() => {
    reset();
    togglePause(true);
    player.collected = level.pickups.map((pickup) => pickup.id);
    window.__SPROUT_BOSS_TEST_TIME__ = 0;
  });
}

async function stompBoss(page, expectedHits) {
  const result = await page.evaluate(({ expectedHits }) => {
    const dt = 1 / 60;
    const cooldownDt = 1 / 20;
    const neutral = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    const boss = level.boss;
    const left = boss.arenaStartX;
    const right = boss.arenaEndX - boss.width;
    const range = Math.max(1, right - left);

    function bossXAt(seconds) {
      let distance = Math.max(0, boss.speed * seconds);
      const initialToLeft = Math.max(0, boss.x - left);
      if (distance <= initialToLeft) return boss.x - distance;
      distance -= initialToLeft;
      const cycle = range * 2;
      const phase = distance % cycle;
      return phase <= range ? left + phase : right - (phase - range);
    }

    let simulatedTime = Number(window.__SPROUT_BOSS_TEST_TIME__ || 0);
    const collisionTime = simulatedTime + dt;
    const bossX = bossXAt(collisionTime);

    player.x = bossX + Math.max(10, boss.width * 0.3);
    player.y = boss.y - player.height - 2;
    player.vx = 0;
    player.vy = 340;
    player.grounded = false;
    player.power.invulnerableTimer = 0;
    player = stepPlayer(player, neutral, level, dt, DEFAULTS);
    simulatedTime = collisionTime;

    const afterHit = window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss;
    if (!afterHit || afterHit.hits < expectedHits) {
      return { ok: false, expectedHits, boss: afterHit, player: { x: player.x, y: player.y, vy: player.vy, state: player.state }, bossX };
    }

    if (!afterHit.defeated) {
      for (let i = 0; i < 11; i += 1) {
        player.x = level.spawn.x;
        player.y = level.spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.power.invulnerableTimer = 1;
        player = stepPlayer(player, neutral, level, cooldownDt, DEFAULTS);
        simulatedTime += cooldownDt;
      }
    }

    window.__SPROUT_BOSS_TEST_TIME__ = simulatedTime;
    return { ok: true, expectedHits, boss: window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss, simulatedTime };
  }, { expectedHits });

  assert.equal(result.ok, true, `boss stomp ${expectedHits} failed: ${JSON.stringify(result)}`);
  assert.ok(result.boss?.hits >= expectedHits, `boss should record hit ${expectedHits}: ${JSON.stringify(result)}`);
}

async function testBossGate(page) {
  await selectLevel(page, 'reservoir-run');
  let boss = await page.evaluate(() => window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss);
  assert.equal(boss.name, 'The Phantom Pump');
  assert.equal(boss.requiredHits, 3);
  assert.equal(boss.defeated, false);

  const gated = await page.evaluate(() => {
    const neutral = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    player.collected = level.pickups.map((pickup) => pickup.id);
    player.x = level.finish.x - player.width + 4;
    player.y = level.finish.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player = stepPlayer(player, neutral, level, 1 / 60, DEFAULTS);
    return { state: player.state, finished: player.finished, finishBlocked: player.finishBlocked };
  });
  assert.equal(gated.state, 'boss-gated');
  assert.equal(gated.finished, false);
  assert.equal(gated.finishBlocked, true);
  assert.equal(await page.locator('#finish-panel').isVisible(), false, 'boss gate must keep the finish panel hidden');

  await prepareBossSimulation(page);
  for (let hits = 1; hits <= 3; hits += 1) await stompBoss(page, hits);

  boss = await page.evaluate(() => window.__SPROUT_CAMPAIGN_EXPERIENCE__.snapshot().boss);
  assert.equal(boss.hits, 3);
  assert.equal(boss.defeated, true);

  const finished = await page.evaluate(() => {
    const neutral = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    togglePause(false);
    player.collected = level.pickups.map((pickup) => pickup.id);
    player.x = level.finish.x - player.width + 4;
    player.y = level.finish.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player = stepPlayer(player, neutral, level, 1 / 60, DEFAULTS);
    return { state: player.state, finished: player.finished, finishBlocked: player.finishBlocked };
  });
  assert.equal(finished.finished, true);
  assert.equal(finished.finishBlocked, false);
  await page.locator('#finish-panel').waitFor({ state: 'visible', timeout: 5000 });
  assert.match(await page.locator('#finish-summary').innerText(), /Phantom Pump defeated/i);
  await page.locator('#seed-man-next-level').waitFor({ state: 'visible', timeout: 5000 });
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
    await testCurrentReversal(page);
    await testBossGate(page);
  } else {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `campaign selector caused ${overflow}px mobile overflow`);
    const selectHeight = await page.locator('#seed-man-level-select').evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(selectHeight >= 44, `mobile level selector should be at least 44px tall, got ${selectHeight}`);
    const signatureHeight = await page.locator('#seed-signature-hud').evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(signatureHeight >= 44, `mobile signature HUD should remain readable, got ${signatureHeight}`);
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
    campaignLevels: 15,
    newLevels: 14,
    worlds: 5,
    bosses: 6,
    signatureFeatures: 10,
    baseBossAbilities: 4,
    animationVersion: 'seed-man-animation-v2',
    campaignUiVersion: 'seed-man-campaign-ui-v15',
    bossGateVerified: true,
    bounceMechanicVerified: true,
    currentReversalVerified: true,
    terminalGeometryGuardVerified: true,
    desktop: '1280x900',
    mobile: '390x844'
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
