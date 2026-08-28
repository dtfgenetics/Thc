import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

const BASE = 'https://dtfseeds.com';
const nav = JSON.parse(fs.readFileSync('data/public-navigation.json', 'utf8'));
const deployment = JSON.parse(fs.readFileSync('site/deployment/public-apps.json', 'utf8'));
const games = nav.games.filter((game) => game.public && game.route);
const failures = [];
const results = [];
const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';

function absolute(base, value) {
  try { return new URL(value, base); } catch { return null; }
}

function assetsFromHtml(html, pageUrl) {
  const values = [];
  for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) values.push(match[1]);
  const seen = new Set();
  return values
    .map((value) => absolute(pageUrl, value))
    .filter((url) => url && url.origin === new URL(BASE).origin)
    .filter((url) => {
      if (seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    })
    .slice(0, 40);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function networkErrorDetail(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === 'object') {
    const code = 'code' in cause ? String(cause.code) : '';
    const message = 'message' in cause ? String(cause.message) : '';
    if (code || message) return [code, message].filter(Boolean).join(': ');
  }
  return error.message || error.name;
}

async function fetchWithTimeout(url, options = {}) {
  const {
    attempts = 3,
    timeoutMs = 15_000,
    headers = {},
    ...fetchOptions
  } = options;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        ...fetchOptions,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'DTFSeeds-Game-Route-QA/1.3',
          'cache-control': 'no-cache, no-store, max-age=0',
          pragma: 'no-cache',
          ...headers
        }
      });
      const retryableStatus = response.status === 429 || response.status >= 500;
      if (!retryableStatus || attempt === attempts) return response;
      await response.body?.cancel().catch(() => {});
      await sleep(400 * attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(400 * attempt);
    }
  }

  throw new Error(`fetch failed after ${attempts} attempts (${networkErrorDetail(lastError)})`);
}

async function assetOk(url) {
  let response = await fetchWithTimeout(url, { method: 'HEAD', attempts: 2, timeoutMs: 10_000 });
  if (response.status === 405 || response.status === 403) {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      attempts: 2,
      timeoutMs: 10_000,
      headers: { range: 'bytes=0-0' }
    });
  }
  return { ok: response.ok, status: response.status };
}

function validateHubLinks(html, sourceLabel) {
  const problems = [];
  for (const game of games) {
    if (!html.includes(`href="${game.route}"`) && !html.includes(`href='${game.route}'`)) {
      problems.push(`missing link for ${game.id}: ${game.route}`);
    }
  }
  for (const game of nav.games.filter((item) => !item.public)) {
    if (game.route && (html.includes(`href="${game.route}"`) || html.includes(`href='${game.route}'`))) {
      problems.push(`development-only game linked publicly: ${game.id}`);
    }
  }
  if (problems.length) failures.push({ id: 'game-hub', route: sourceLabel, problems });
}

function walkFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function checkSyntax(file) {
  const ext = path.extname(file).toLowerCase();
  if (!['.js', '.mjs', '.php'].includes(ext)) return null;
  const command = ext === '.php' ? 'php' : process.execPath;
  const args = ext === '.php' ? ['-l', file] : ['--check', file];
  const run = spawnSync(command, args, { encoding: 'utf8' });
  if (run.error) return `${path.relative('.', file)} syntax check could not run: ${run.error.message}`;
  if (run.status !== 0) return `${path.relative('.', file)} syntax error: ${(run.stderr || run.stdout || '').trim()}`;
  return null;
}

function localPathForPublicUrl(url) {
  if (url.origin !== new URL(BASE).origin) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/games/') && !pathname.startsWith('/assets/') && !pathname.startsWith('/puzzles/')) return null;
  const clean = pathname.replace(/^\/+/, '');
  const candidate = path.join('site/public-route-patch', clean);
  if (fs.existsSync(candidate)) return candidate;
  const rootCandidate = path.join('site/public-route-patch', clean.replace(/^puzzles\//, '../puzzles/'));
  return fs.existsSync(rootCandidate) ? rootCandidate : candidate;
}

function auditCandidateGame(game) {
  const problems = [];
  const app = deployment.apps.find((item) => item.id === game.id);
  if (!app) problems.push('missing deployment registry entry');
  else {
    if (app.route !== game.route) problems.push(`deployment route mismatch: ${app.route || '<none>'}`);
    if (['not-deployable', 'in-development', 'preproduction'].includes(app.status)) problems.push(`deployment status is not public-ready: ${app.status}`);
  }

  const routeSlug = game.route.replace(/^\/games\//, '').replace(/\/$/, '');
  const routeRoot = path.join('site/public-route-patch/games', routeSlug);
  const indexPath = path.join(routeRoot, 'index.html');

  if (!fs.existsSync(indexPath)) {
    if (!app || app.repository === 'dtfgenetics/Thc') problems.push(`missing candidate route source: ${indexPath}`);
    else if (!app.repository || app.repository === 'dtfgenetics/Thc') problems.push('external runtime repository is not identified');
    results.push({ id: game.id, route: game.route, status: 'candidate-external', assetsChecked: 0, problems });
    if (problems.length) failures.push({ id: game.id, route: game.route, problems });
    return;
  }

  const html = fs.readFileSync(indexPath, 'utf8');
  if (html.length < 180) problems.push(`candidate HTML payload too small (${html.length} bytes)`);
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) problems.push('candidate route missing document title');
  if (/email@email\.com|\+123456789|Needed from owner|Reserved strain card/i.test(html)) problems.push('candidate route contains stale placeholder content');
  if (game.status === 'multiplayer') {
    if (!/(create|join|room|match|session)/i.test(html)) problems.push('candidate multiplayer route lacks create/join/session UI markers');
  } else if (!/(<script\b|<button\b|<canvas\b|<form\b)/i.test(html)) {
    problems.push('candidate play-now route exposes no obvious interactive runtime marker');
  }

  const assets = assetsFromHtml(html, new URL(game.route, BASE).href);
  const missingAssets = [];
  for (const asset of assets) {
    const local = localPathForPublicUrl(asset);
    if (local && !fs.existsSync(local)) missingAssets.push(asset.pathname);
  }
  if (missingAssets.length) problems.push(`missing candidate same-origin assets: ${missingAssets.join(', ')}`);

  for (const file of walkFiles(routeRoot)) {
    const syntaxProblem = checkSyntax(file);
    if (syntaxProblem) problems.push(syntaxProblem);
  }

  results.push({ id: game.id, route: game.route, status: 'candidate-source', assetsChecked: assets.length, problems });
  if (problems.length) failures.push({ id: game.id, route: game.route, problems });
}

async function auditLiveGame(game) {
  const requested = new URL(game.route, BASE);
  requested.searchParams.set('dtf_game_audit', `${Date.now()}-${game.id}`);
  const problems = [];
  try {
    const response = await fetchWithTimeout(requested.href);
    const html = await response.text();
    const finalUrl = new URL(response.url);
    if (!response.ok) problems.push(`HTTP ${response.status}`);
    if (finalUrl.origin !== new URL(BASE).origin) problems.push(`unexpected cross-origin redirect to ${finalUrl.origin}`);
    if (!/text\/html/i.test(response.headers.get('content-type') || '')) problems.push(`unexpected content-type ${response.headers.get('content-type') || '<missing>'}`);
    if (html.length < 180) problems.push(`HTML payload too small (${html.length} bytes)`);
    if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) problems.push('missing document title');
    if (/email@email\.com|\+123456789|Needed from owner|Reserved strain card/i.test(html)) problems.push('stale placeholder content detected');

    const assets = assetsFromHtml(html, finalUrl.href);
    const brokenAssets = [];
    for (const asset of assets) {
      try {
        const check = await assetOk(asset.href);
        if (!check.ok) brokenAssets.push(`${asset.pathname} (${check.status})`);
      } catch (error) {
        brokenAssets.push(`${asset.pathname} (${networkErrorDetail(error)})`);
      }
    }
    if (brokenAssets.length) problems.push(`broken same-origin assets: ${brokenAssets.join(', ')}`);

    if (game.status === 'multiplayer') {
      if (!/(create|join|room|match|session)/i.test(html)) problems.push('multiplayer route lacks create/join/session UI markers');
    } else if (!/(<script\b|<button\b|<canvas\b|<form\b)/i.test(html)) {
      problems.push('play-now route exposes no obvious interactive runtime marker');
    }

    results.push({ id: game.id, route: game.route, status: response.status, assetsChecked: assets.length, problems });
  } catch (error) {
    problems.push(networkErrorDetail(error));
    results.push({ id: game.id, route: game.route, status: null, assetsChecked: 0, problems });
  }
  if (problems.length) failures.push({ id: game.id, route: game.route, problems });
}

if (isPullRequest) {
  for (const game of games) auditCandidateGame(game);
  const hubPath = 'site/public-route-patch/games/index.html';
  try {
    validateHubLinks(fs.readFileSync(hubPath, 'utf8'), hubPath);
  } catch (error) {
    failures.push({ id: 'game-hub', route: hubPath, problems: [`candidate hub source unavailable: ${networkErrorDetail(error)}`] });
  }
} else {
  for (const game of games) await auditLiveGame(game);
  const hubUrl = new URL('/games/', BASE);
  hubUrl.searchParams.set('dtf_game_hub_audit', Date.now().toString());
  try {
    const response = await fetchWithTimeout(hubUrl.href);
    const html = await response.text();
    if (!response.ok) failures.push({ id: 'game-hub', route: '/games/', problems: [`HTTP ${response.status}`] });
    validateHubLinks(html, '/games/');
  } catch (error) {
    failures.push({ id: 'game-hub', route: '/games/', problems: [networkErrorDetail(error)] });
  }
}

fs.writeFileSync('game-route-audit.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  gamesChecked: games.length,
  mode: isPullRequest ? 'candidate-source' : 'production-live',
  results,
  failures
}, null, 2));

console.log(`Checked ${games.length} public game routes in ${isPullRequest ? 'candidate-source' : 'production-live'} mode.`);
for (const result of results) console.log(`${result.problems.length ? 'FAIL' : 'PASS'} ${result.route} — ${result.status} — assets checked: ${result.assetsChecked}${result.problems.length ? ` — ${result.problems.join('; ')}` : ''}`);
for (const failure of failures.filter((item) => item.id === 'game-hub')) console.error(`FAIL ${failure.route} — ${failure.problems.join('; ')}`);

if (failures.length) {
  console.error(`Game route integrity failed with ${failures.length} problem group(s).`);
  process.exit(1);
}

console.log('Game route integrity passed.');
