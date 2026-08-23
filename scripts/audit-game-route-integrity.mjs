import fs from 'node:fs';
import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

const BASE = 'https://dtfseeds.com';
const nav = JSON.parse(fs.readFileSync('data/public-navigation.json', 'utf8'));
const games = nav.games.filter((game) => game.public && game.route);
const failures = [];
const results = [];

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
    .slice(0, 30);
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'user-agent': 'DTFSeeds-Game-Route-QA/1.0',
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      ...(options.headers || {})
    },
    ...options
  });
}

async function assetOk(url) {
  let response = await fetchWithTimeout(url, { method: 'HEAD' });
  if (response.status === 405 || response.status === 403) response = await fetchWithTimeout(url, { method: 'GET', headers: { range: 'bytes=0-0' } });
  return { ok: response.ok, status: response.status };
}

for (const game of games) {
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
        brokenAssets.push(`${asset.pathname} (${error instanceof Error ? error.message : String(error)})`);
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
    problems.push(error instanceof Error ? error.message : String(error));
    results.push({ id: game.id, route: game.route, status: null, assetsChecked: 0, problems });
  }

  if (problems.length) failures.push({ id: game.id, route: game.route, problems });
}

const hubUrl = new URL('/games/', BASE);
hubUrl.searchParams.set('dtf_game_hub_audit', Date.now().toString());
try {
  const response = await fetchWithTimeout(hubUrl.href);
  const html = await response.text();
  if (!response.ok) failures.push({ id: 'game-hub', route: '/games/', problems: [`HTTP ${response.status}`] });
  for (const game of games) {
    if (!html.includes(`href="${game.route}"`) && !html.includes(`href='${game.route}'`)) failures.push({ id: 'game-hub', route: '/games/', problems: [`missing link for ${game.id}: ${game.route}`] });
  }
  for (const game of nav.games.filter((item) => !item.public)) {
    if (game.route && (html.includes(`href="${game.route}"`) || html.includes(`href='${game.route}'`))) failures.push({ id: 'game-hub', route: '/games/', problems: [`development-only game linked publicly: ${game.id}`] });
  }
} catch (error) {
  failures.push({ id: 'game-hub', route: '/games/', problems: [error instanceof Error ? error.message : String(error)] });
}

fs.writeFileSync('game-route-audit.json', JSON.stringify({ generatedAt: new Date().toISOString(), gamesChecked: games.length, results, failures }, null, 2));

console.log(`Checked ${games.length} public game routes.`);
for (const result of results) console.log(`${result.problems.length ? 'FAIL' : 'PASS'} ${result.route} — assets checked: ${result.assetsChecked}${result.problems.length ? ` — ${result.problems.join('; ')}` : ''}`);

if (failures.length) {
  console.error(`Game route integrity failed with ${failures.length} problem group(s).`);
  process.exit(1);
}

console.log('Game route integrity passed.');
