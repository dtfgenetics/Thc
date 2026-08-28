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
const dtfRepo = 'dtfgenetics/Thc';

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

function errorDetail(error) {
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
  const { attempts = 3, timeoutMs = 15_000, headers = {}, ...fetchOptions } = options;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        ...fetchOptions,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'DTFSeeds-Game-Route-QA/1.4',
          'cache-control': 'no-cache, no-store, max-age=0',
          pragma: 'no-cache',
          ...headers
        }
      });
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts) return response;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
    await sleep(400 * attempt);
  }
  throw new Error(`fetch failed after ${attempts} attempts (${errorDetail(lastError)})`);
}

async function assetOk(url) {
  let response = await fetchWithTimeout(url, { method: 'HEAD', attempts: 2, timeoutMs: 10_000 });
  if (response.status === 405 || response.status === 403) {
    response = await fetchWithTimeout(url, {
      method: 'GET', attempts: 2, timeoutMs: 10_000, headers: { range: 'bytes=0-0' }
    });
  }
  return { ok: response.ok, status: response.status };
}

async function mapLimit(items, limit, task) {
  const output = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await task(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

const runtimeJsonProbes = {
  'high-iq': [
    { path: 'data/manifest.json', validate: (data) => data?.datasetVersion === '2.2' && data?.questionCount === 80 && data?.sourceCount === 50 }
  ],
  'high-life': [
    { path: 'data/events.json', validate: (data) => Array.isArray(data) && data.length === 18 }
  ],
  'grower-conversations': [
    { path: 'data/prompt-bank.json', validate: (data) => data?.cardCount === 96 && Object.keys(data?.categories || {}).length === 8 }
  ],
  'seed-man-platformer': [
    { path: 'data/level-01.json', validate: (data) => data?.id === 'sprout-run' && data?.pickups?.length === 8 }
  ],
  'strain-showdown': [
    { path: 'data/families.json', validate: (data) => Array.isArray(data) && data.length === 8 },
    ...['kush', 'haze', 'skunk', 'gas', 'cookies', 'fruit', 'purple', 'frost'].map((family) => ({
      path: `data/roster/${family}.json`,
      validate: (data) => Array.isArray(data) && data.length === 12
    }))
  ]
};

async function fetchJsonProbe(pageUrl, probe) {
  const url = new URL(probe.path, pageUrl);
  url.searchParams.set('dtf_game_data_audit', Date.now().toString());
  const response = await fetchWithTimeout(url.href, { attempts: 2, timeoutMs: 10_000 });
  if (!response.ok) return { path: probe.path, problem: `HTTP ${response.status}` };
  if (!/application\/json/i.test(response.headers.get('content-type') || '')) {
    return { path: probe.path, problem: `unexpected content-type ${response.headers.get('content-type') || '<missing>'}` };
  }
  try {
    const data = await response.json();
    return { path: probe.path, data, problem: probe.validate(data) ? null : 'unexpected JSON payload' };
  } catch (error) {
    return { path: probe.path, problem: `invalid JSON (${errorDetail(error)})` };
  }
}

async function auditRuntimeJson(game, pageUrl) {
  const configured = runtimeJsonProbes[game.id] || [];
  const results = await mapLimit(configured, 6, (probe) => fetchJsonProbe(pageUrl, probe));

  if (game.id === 'high-iq') {
    const manifest = results.find((result) => result.path === 'data/manifest.json');
    if (manifest?.data && !manifest.problem) {
      const chunks = [...(manifest.data.questionChunks || []), ...(manifest.data.sourceChunks || [])];
      const chunkResults = await mapLimit(chunks, 6, (filename) => fetchJsonProbe(pageUrl, {
        path: `data/${filename}`,
        validate: (data) => Array.isArray(data) && data.length > 0
      }));
      results.push(...chunkResults);
    }
  }

  const problems = results.filter((result) => result.problem).map((result) => `${result.path} (${result.problem})`);
  return { checked: results.length, problems };
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
  if (!fs.existsSync(root)) return [];
  const files = [];
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
  const run = ext === '.php'
    ? spawnSync('php', ['-l', file], { encoding: 'utf8' })
    : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (run.error) return `${file} syntax check could not run: ${run.error.message}`;
  if (run.status !== 0) return `${file} syntax error: ${(run.stderr || run.stdout || '').trim()}`;
  return null;
}

function routeRootFor(game) {
  const slug = game.route.replace(/^\/games\//, '').replace(/\/$/, '');
  return path.join('site/public-route-patch/games', slug);
}

function sourceInfo(game, app) {
  const routeRoot = routeRootFor(game);
  const isLocalRepo = app?.repository === dtfRepo;
  const sourceRoot = isLocalRepo && app?.sourcePath ? app.sourcePath : routeRoot;
  const candidates = [
    path.join(routeRoot, 'index.html'),
    path.join(sourceRoot, 'index.html'),
    path.join(sourceRoot, 'public', 'index.html')
  ];
  return {
    routeRoot,
    sourceRoot,
    indexPath: candidates.find((candidate) => fs.existsSync(candidate)) || null,
    isLocalRepo
  };
}

function checkRouteAssets(html, game, routeRoot) {
  if (!fs.existsSync(path.join(routeRoot, 'index.html'))) return { checked: 0, problems: [] };
  const assets = assetsFromHtml(html, new URL(game.route, BASE).href);
  const missing = [];
  for (const asset of assets) {
    const pathname = decodeURIComponent(asset.pathname);
    if (!pathname.startsWith(game.route)) continue;
    const relative = pathname.slice(game.route.length).replace(/^\/+/, '');
    if (!relative) continue;
    const candidate = path.join(routeRoot, relative);
    if (!fs.existsSync(candidate)) missing.push(asset.pathname);
  }
  return {
    checked: assets.length,
    problems: missing.length ? [`missing candidate same-route assets: ${missing.join(', ')}`] : []
  };
}

function auditCandidateGame(game) {
  const problems = [];
  const app = deployment.apps.find((item) => item.id === game.id);
  if (!app) problems.push('missing deployment registry entry');
  else {
    if (app.route !== game.route) problems.push(`deployment route mismatch: ${app.route || '<none>'}`);
    if (['not-deployable', 'in-development', 'preproduction'].includes(app.status)) {
      problems.push(`deployment status is not public-ready: ${app.status}`);
    }
  }

  const source = sourceInfo(game, app);
  if (!source.indexPath) {
    if (source.isLocalRepo || !app) {
      problems.push(`missing candidate index in registered source: ${source.sourceRoot}`);
    } else if (!app.repository) {
      problems.push('external runtime repository is not identified');
    }
    const status = source.isLocalRepo ? 'candidate-local-missing' : 'candidate-external';
    results.push({ id: game.id, route: game.route, status, assetsChecked: 0, problems });
    if (problems.length) failures.push({ id: game.id, route: game.route, problems });
    return;
  }

  const html = fs.readFileSync(source.indexPath, 'utf8');
  if (html.length < 180) problems.push(`candidate HTML payload too small (${html.length} bytes)`);
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) problems.push('candidate route missing document title');
  if (/email@email\.com|\+123456789|Needed from owner|Reserved strain card/i.test(html)) {
    problems.push('candidate route contains stale placeholder content');
  }
  if (game.status === 'multiplayer') {
    if (!/(create|join|room|match|session)/i.test(html)) problems.push('candidate multiplayer route lacks create/join/session UI markers');
  } else if (!/(<script\b|<button\b|<canvas\b|<form\b|id=["']root["'])/i.test(html)) {
    problems.push('candidate play-now route exposes no obvious interactive runtime marker');
  }

  const assetAudit = checkRouteAssets(html, game, source.routeRoot);
  problems.push(...assetAudit.problems);

  const syntaxRoot = fs.existsSync(source.sourceRoot) ? source.sourceRoot : source.routeRoot;
  for (const file of walkFiles(syntaxRoot)) {
    const syntaxProblem = checkSyntax(file);
    if (syntaxProblem) problems.push(syntaxProblem);
  }

  results.push({
    id: game.id,
    route: game.route,
    status: source.isLocalRepo ? 'candidate-source' : 'candidate-external-mirror',
    sourceRoot: syntaxRoot,
    assetsChecked: assetAudit.checked,
    problems
  });
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
    const assetProblems = await mapLimit(assets, 6, async (asset) => {
      try {
        const check = await assetOk(asset.href);
        return check.ok ? null : `${asset.pathname} (${check.status})`;
      } catch (error) {
        return `${asset.pathname} (${errorDetail(error)})`;
      }
    });
    const brokenAssets = assetProblems.filter(Boolean);
    if (brokenAssets.length) problems.push(`broken same-origin assets: ${brokenAssets.join(', ')}`);

    const readiness = await auditRuntimeJson(game, finalUrl.href);
    if (readiness.problems.length) problems.push(`broken runtime data: ${readiness.problems.join(', ')}`);

    if (game.status === 'multiplayer') {
      if (!/(create|join|room|match|session)/i.test(html)) problems.push('multiplayer route lacks create/join/session UI markers');
    } else if (!/(<script\b|<button\b|<canvas\b|<form\b)/i.test(html)) {
      problems.push('play-now route exposes no obvious interactive runtime marker');
    }

    results.push({ id: game.id, route: game.route, status: response.status, assetsChecked: assets.length, runtimeDataChecked: readiness.checked, problems });
  } catch (error) {
    problems.push(errorDetail(error));
    results.push({ id: game.id, route: game.route, status: null, assetsChecked: 0, runtimeDataChecked: 0, problems });
  }
  if (problems.length) failures.push({ id: game.id, route: game.route, problems });
}

if (isPullRequest) {
  for (const game of games) auditCandidateGame(game);
  const hubPath = 'site/public-route-patch/games/index.html';
  try {
    validateHubLinks(fs.readFileSync(hubPath, 'utf8'), hubPath);
  } catch (error) {
    failures.push({ id: 'game-hub', route: hubPath, problems: [`candidate hub source unavailable: ${errorDetail(error)}`] });
  }
} else {
  await mapLimit(games, 4, auditLiveGame);
  results.sort((a, b) => games.findIndex((game) => game.id === a.id) - games.findIndex((game) => game.id === b.id));
  const hubUrl = new URL('/games/', BASE);
  hubUrl.searchParams.set('dtf_game_hub_audit', Date.now().toString());
  try {
    const response = await fetchWithTimeout(hubUrl.href);
    const html = await response.text();
    if (!response.ok) failures.push({ id: 'game-hub', route: '/games/', problems: [`HTTP ${response.status}`] });
    validateHubLinks(html, '/games/');
  } catch (error) {
    failures.push({ id: 'game-hub', route: '/games/', problems: [errorDetail(error)] });
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
for (const result of results) {
  console.log(`${result.problems.length ? 'FAIL' : 'PASS'} ${result.route} — ${result.status} — source: ${result.sourceRoot || 'external'} — assets checked: ${result.assetsChecked} — runtime data checked: ${result.runtimeDataChecked || 0}${result.problems.length ? ` — ${result.problems.join('; ')}` : ''}`);
}
for (const failure of failures.filter((item) => item.id === 'game-hub')) console.error(`FAIL ${failure.route} — ${failure.problems.join('; ')}`);

if (failures.length) {
  console.error(`Game route integrity failed with ${failures.length} problem group(s).`);
  process.exit(1);
}

console.log('Game route integrity passed.');
