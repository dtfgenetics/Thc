import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const SITE = String(process.env.DTF_SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const nav = JSON.parse(fs.readFileSync('data/public-navigation.json', 'utf8'));
const games = (nav.games || []).filter((game) => game.public && game.route);
const TIMEOUT = Number(process.env.DTF_GAME_BROWSER_TIMEOUT_MS || 20000);

const actionHints = {
  'high-life': [/start/i, /begin/i, /new game/i],
  'grower-conversations': [/draw/i, /next/i, /random/i],
  'high-land': [/local play/i, /play local/i, /start/i],
  crossword: [/start/i, /new puzzle/i, /play/i],
  'protect-the-plants': [/create/i, /start/i, /play/i],
  'thc-u-know': [/play/i, /create/i, /start/i],
  'kush-kings': [/play/i, /new game/i, /start/i],
  terpocalypse: [/start/i, /play/i, /begin/i],
  phenoquest: [/start/i, /choose/i, /play/i],
  'strain-match': [/start/i, /play/i, /new game/i],
  'grow-room-bingo': [/new/i, /generate/i, /play/i],
  'mystery-strain': [/start/i, /play/i, /new/i],
  'spin-the-strain': [/spin/i, /start/i, /play/i],
  'harvest-hustle': [/start/i, /play/i, /begin/i],
  'pheno-draft': [/start/i, /draft/i, /play/i],
  'high-lines': [/start/i, /play/i, /new game/i]
};

function cacheBustedUrl(game) {
  const url = new URL(game.route, SITE);
  url.searchParams.set('dtf_browser_acceptance', `${Date.now()}-${game.id}-${Math.random().toString(16).slice(2)}`);
  return url.toString();
}

function collectRuntimeFailures(page) {
  const failures = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin === new URL(SITE).origin) failures.push(`requestfailed: ${url.pathname} (${request.failure()?.errorText || 'unknown'})`);
    } catch {
      failures.push(`requestfailed: ${request.url()}`);
    }
  });
  page.on('response', (response) => {
    try {
      const url = new URL(response.url());
      if (url.origin === new URL(SITE).origin && response.status() >= 400 && !/favicon\.ico$/i.test(url.pathname)) {
        failures.push(`http-${response.status()}: ${url.pathname}`);
      }
    } catch {}
  });
  return failures;
}

async function assertRouteIdentity(page, game) {
  const finalUrl = new URL(page.url());
  assert.equal(finalUrl.origin, new URL(SITE).origin, `${game.id}: escaped dtfseeds.com to ${finalUrl.origin}`);
  assert.equal(finalUrl.pathname.replace(/\/+$/, '/'), game.route.replace(/\/+$/, '/'), `${game.id}: redirected/fell back to ${finalUrl.pathname}`);

  const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  assert.ok(bodyText.length >= 40, `${game.id}: body is implausibly empty`);
  assert.ok(!/Pick what is playable\. See what is coming next\./i.test(bodyText), `${game.id}: served Game Hub fallback instead of game`);
  assert.ok(!/404|page not found|not found/i.test((await page.title()) + ' ' + bodyText.slice(0, 300)), `${game.id}: looks like an error page`);

  const titleTokens = String(game.title || '').split(/\s+[—:|/]\s+|\s+/).filter((token) => token.length >= 4).slice(0, 4);
  const haystack = `${await page.title()} ${bodyText}`.toLowerCase();
  assert.ok(titleTokens.some((token) => haystack.includes(token.toLowerCase())), `${game.id}: missing recognizable title identity for ${game.title}`);
}

async function exerciseHighIq(page) {
  await page.locator('#quiz-setup').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.locator('#start-quiz').click();
  await page.locator('#quiz-panel').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.locator('#answer-options button').first().click();
  await page.locator('#lock-answer').click();
  await page.locator('#answer-feedback').waitFor({ state: 'visible', timeout: TIMEOUT });
  return { action: 'start-answer-lock', clicked: true };
}

async function exerciseStrainShowdown(page) {
  const familyButton = page.locator('#familyGrid button').first();
  await familyButton.waitFor({ state: 'visible', timeout: TIMEOUT });
  await familyButton.click();
  await page.locator('#battleScreen').waitFor({ state: 'visible', timeout: TIMEOUT });
  assert.match(await page.locator('#roundLabel').innerText(), /Round\s+1/i);
  return { action: 'choose-family/start-battle', clicked: true };
}

async function exerciseWhoTookIt(page) {
  const clue = page.locator('.question-list button:not([disabled])').first();
  await clue.waitFor({ state: 'visible', timeout: TIMEOUT });
  const before = await page.locator('.hud-block').last().innerText();
  await clue.click();
  await page.locator('.clue-answer').waitFor({ state: 'visible', timeout: TIMEOUT });
  const after = await page.locator('.hud-block').last().innerText();
  assert.notEqual(after, before, 'Who Took It clue count did not advance');
  return { action: 'ask-clue', clicked: true };
}

async function exerciseBudOrBluff(page) {
  await page.locator('#createName').fill(`Browser ${Date.now().toString().slice(-5)}`);
  await page.locator('#createForm button[type="submit"]').click();
  await page.locator('#roomView').waitFor({ state: 'visible', timeout: TIMEOUT });
  const code = (await page.locator('#copyCode').innerText()).trim();
  assert.match(code, /^[A-Z0-9]{6}$/, `Bud or Bluff room code is invalid: ${code}`);
  assert.match(await page.locator('#stageTitle').innerText(), /player connected/i);
  return { action: 'create-online-lobby', clicked: true };
}

async function exerciseLostInTerps(page) {
  await page.locator('[data-r="1"][data-c="3"]').click();
  await page.locator('[data-r="8"][data-c="10"]').click();
  await page.waitForFunction(() => document.querySelector('#score')?.textContent?.trim() === '1 / 8');
  assert.match(await page.locator('#message').innerText(), /Found LIMONENE/i);
  return { action: 'find-limonene', clicked: true };
}

async function exerciseGrowRoomDefense(page) {
  const tool = page.locator('.tool-button:not([disabled])').first();
  await tool.waitFor({ state: 'visible', timeout: TIMEOUT });
  await tool.click();
  const threat = page.locator('.threat-target:not([disabled])').first();
  await threat.waitFor({ state: 'visible', timeout: TIMEOUT });
  const before = await page.locator('#round-stat').innerText();
  await threat.click();
  await page.waitForFunction((previous) => document.querySelector('#round-stat')?.textContent !== previous, before);
  assert.match(await page.locator('#history').innerText(), /R1/i);
  return { action: 'select-tool/resolve-threat', clicked: true };
}

async function exerciseTrichomeTrials(page) {
  await page.locator('#scorecard').waitFor({ state: 'visible', timeout: TIMEOUT });
  const categories = await page.locator('#scorecard [data-score-row]').count();
  assert.equal(categories, 7, 'Trichome Trials must render seven score categories');
  for (let index = 0; index < categories; index += 1) {
    await page.locator('#scorecard [data-score-row]').nth(index).locator('button[data-score-step="1"]').click();
  }
  await page.waitForFunction(() => !document.querySelector('#submit-card')?.disabled);
  assert.match(await page.locator('#scorecard-progress').innerText(), /7\s*\/\s*7 reviewed/i);
  await page.locator('#submit-card').click();
  await page.locator('#benchmark-review').waitFor({ state: 'visible', timeout: TIMEOUT });
  assert.match(await page.locator('#benchmark-review').innerText(), /Benchmark reveal/i);
  return { action: 'score-seven/submit/reveal', clicked: true };
}

async function clickFirstAction(page, game) {
  if (game.id === 'high-iq') return exerciseHighIq(page);
  if (game.id === 'strain-showdown') return exerciseStrainShowdown(page);
  if (game.id === 'who-took-it') return exerciseWhoTookIt(page);
  if (game.id === 'bud-or-bluff') return exerciseBudOrBluff(page);
  if (game.id === 'lost-in-the-terps') return exerciseLostInTerps(page);
  if (game.id === 'grow-room-defense') return exerciseGrowRoomDefense(page);
  if (game.id === 'trichome-trials') return exerciseTrichomeTrials(page);

  if (game.id === 'seed-man-platformer') {
    const canvas = page.locator('#game, canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: TIMEOUT });
    await canvas.focus().catch(() => {});
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(220);
    await page.keyboard.up('ArrowRight');
    return { action: 'keyboard-right', clicked: true };
  }

  if (game.id === 'weedopolis') {
    const start = page.locator('#startGameBtn');
    if (await start.count()) {
      await start.click();
      await page.waitForTimeout(250);
      const roll = page.getByRole('button', { name: /roll dice/i }).first();
      if (await roll.count()) await roll.click();
      return { action: 'start-session/roll', clicked: true };
    }
  }

  const patterns = actionHints[game.id] || [/start/i, /play/i, /begin/i];
  for (const pattern of patterns) {
    const candidate = page.getByRole('button', { name: pattern }).first();
    if (await candidate.count() && await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
      await candidate.click({ timeout: 5000 });
      return { action: String(pattern), clicked: true };
    }
  }

  const fallback = page.locator('button:visible:not([disabled])').first();
  if (await fallback.count()) {
    const label = (await fallback.innerText().catch(() => '')).trim();
    await fallback.click({ timeout: 5000 });
    return { action: label || 'first-enabled-button', clicked: true };
  }

  const interactive = page.locator('input:visible, canvas:visible, [role="button"]:visible:not([aria-disabled="true"])').first();
  if (await interactive.count()) {
    await interactive.focus().catch(() => {});
    return { action: 'interactive-surface-present', clicked: false };
  }

  throw new Error(`${game.id}: no usable game control or interactive surface found`);
}

async function auditGame(browser, game, viewport) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width <= 430, isMobile: viewport.width <= 430 });
  page.setDefaultTimeout(TIMEOUT);
  const runtimeFailures = collectRuntimeFailures(page);
  const started = Date.now();
  try {
    const response = await page.goto(cacheBustedUrl(game), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    assert.ok(response, `${game.id}: navigation produced no response`);
    assert.equal(response.status(), 200, `${game.id}: HTTP ${response.status()}`);
    await page.waitForTimeout(650);
    await assertRouteIdentity(page, game);

    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    if (viewport.width <= 430) assert.ok(overflow <= 4, `${game.id}: mobile horizontal overflow ${overflow}px`);

    const before = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    const action = await clickFirstAction(page, game);
    await page.waitForTimeout(700);
    const after = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

    assert.equal(new URL(page.url()).pathname.replace(/\/+$/, '/'), game.route.replace(/\/+$/, '/'), `${game.id}: primary action navigated away from game route`);
    if (action.clicked && game.id !== 'seed-man-platformer') {
      const changed = before !== after || await page.locator('canvas:visible').count() > 0;
      assert.ok(changed, `${game.id}: primary action produced no visible game-state change`);
    }

    const filteredFailures = runtimeFailures.filter((failure) => !/favicon\.ico/i.test(failure));
    assert.equal(filteredFailures.length, 0, `${game.id}: browser/runtime failures: ${filteredFailures.join(' | ')}`);

    return { id: game.id, route: game.route, ok: true, viewport: `${viewport.width}x${viewport.height}`, action: action.action, ms: Date.now() - started };
  } catch (error) {
    return { id: game.id, route: game.route, ok: false, viewport: `${viewport.width}x${viewport.height}`, error: error instanceof Error ? error.message : String(error), runtimeFailures, ms: Date.now() - started };
  } finally {
    if (game.id === 'bud-or-bluff') {
      await page.locator('#leaveButton').click({ timeout: 2500 }).catch(() => {});
    }
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const game of games) {
    const desktop = await auditGame(browser, game, { width: 1280, height: 900 });
    results.push(desktop);
    if (desktop.ok) {
      const mobile = await auditGame(browser, game, { width: 390, height: 844 });
      results.push(mobile);
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({
  ok: failed.length === 0,
  site: SITE,
  publicGames: games.length,
  browserRuns: results.length,
  failedRuns: failed.length,
  results
}, null, 2));

if (failed.length) process.exit(1);
