import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameQaCatalog, readJson, normalizeRoute } from './lib/game-qa-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC_ROOT = path.join(ROOT, 'site/public-route-patch');
const MAX_ROUTE_ASSETS = 40;

function parseArgs(argv) {
  const args = {
    mode: 'local',
    strict: false,
    catalogOnly: false,
    allDeployed: false,
    gameIds: [],
    outputDir: process.env.GAME_QA_OUTPUT_DIR || path.join(ROOT, 'artifacts/game-qa'),
    baseUrl: process.env.GAME_QA_BASE_URL || null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--live') args.mode = 'live';
    else if (arg === '--local') args.mode = 'local';
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--catalog') args.catalogOnly = true;
    else if (arg === '--all-deployed') args.allDeployed = true;
    else if (arg === '--game') args.gameIds.push(...String(argv[++i] ?? '').split(',').filter(Boolean));
    else if (arg === '--output') args.outputDir = path.resolve(ROOT, argv[++i]);
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--no-screenshots') {
      // Backward-compatible no-op. This verifier is deterministic and does not use Playwright.
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/game-portfolio-browser-qa.mjs [--local|--live] [--all-deployed] [--game id[,id]] [--strict] [--output path] [--base-url URL] [--catalog]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function loadContracts() {
  const configPath = path.join(ROOT, 'configuration/game-qa/browser-contracts.json');
  const config = readJson(configPath);
  if (config.schemaVersion !== 1) throw new Error(`Unsupported browser-contracts schemaVersion ${config.schemaVersion}`);
  return config;
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHtml(html) {
  return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

function simpleSelectorPresent(html, selector) {
  const value = String(selector || '').trim();
  if (/^#[A-Za-z][\w:-]*$/.test(value)) {
    const id = value.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\bid\\s*=\\s*['"]${id}['"]`, 'i').test(html);
  }
  if (/^\.[A-Za-z][\w:-]*$/.test(value)) {
    const className = value.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\bclass\\s*=\\s*['"][^'"]*\\b${className}\\b[^'"]*['"]`, 'i').test(html);
  }
  if (/^[A-Za-z][\w-]*$/.test(value)) return new RegExp(`<${value}(?:\\s|>)`, 'i').test(html);
  return null;
}

function countToken(html, token) {
  return html.split(token).length - 1;
}

function collectRouteAssetRefs(html) {
  const refs = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    refs.add(match[1]);
  }
  for (const match of html.matchAll(/<link\b([^>]*?)\bhref\s*=\s*["']([^"']+)["']([^>]*)>/gi)) {
    const attrs = `${match[1]} ${match[3]}`;
    if (/\brel\s*=\s*["'][^"']*(?:stylesheet|modulepreload|preload)[^"']*["']/i.test(attrs)) refs.add(match[2]);
  }
  return [...refs];
}

function resolveRouteAsset(rawRef, route, baseUrl) {
  if (!rawRef || /^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(rawRef)) return null;
  let resolved;
  try {
    resolved = new URL(rawRef, baseUrl);
  } catch {
    return null;
  }
  const base = new URL(baseUrl);
  if (resolved.origin !== base.origin) return null;
  const routePath = normalizeRoute(route);
  if (!resolved.pathname.startsWith(routePath)) return null;
  return resolved;
}

function localAssetAudit(game, html) {
  const failures = [];
  const warnings = [];
  const refs = collectRouteAssetRefs(html);
  const baseUrl = `https://dtf.local${normalizeRoute(game.route)}`;
  const owned = refs
    .map((ref) => ({ ref, url: resolveRouteAsset(ref, game.route, baseUrl) }))
    .filter((item) => item.url);

  for (const item of owned.slice(0, MAX_ROUTE_ASSETS)) {
    const localPath = path.join(STATIC_ROOT, item.url.pathname.replace(/^\/+/, ''));
    if (!fs.existsSync(localPath)) failures.push(`route-owned asset missing: ${item.ref}`);
  }
  if (owned.length > MAX_ROUTE_ASSETS) warnings.push(`route asset audit capped at ${MAX_ROUTE_ASSETS} of ${owned.length} assets`);
  return { failures, warnings, checked: Math.min(owned.length, MAX_ROUTE_ASSETS) };
}

async function liveAssetAudit(game, html, finalUrl, timeoutMs) {
  const failures = [];
  const warnings = [];
  const refs = collectRouteAssetRefs(html);
  const owned = refs
    .map((ref) => ({ ref, url: resolveRouteAsset(ref, game.route, finalUrl) }))
    .filter((item) => item.url);

  for (const item of owned.slice(0, MAX_ROUTE_ASSETS)) {
    try {
      const response = await fetch(item.url, {
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 400) failures.push(`route-owned asset HTTP ${response.status}: ${item.ref}`);
      try { await response.body?.cancel(); } catch {}
    } catch (error) {
      failures.push(`route-owned asset request failed: ${item.ref} (${error.message})`);
    }
  }
  if (owned.length > MAX_ROUTE_ASSETS) warnings.push(`route asset audit capped at ${MAX_ROUTE_ASSETS} of ${owned.length} assets`);
  return { failures, warnings, checked: Math.min(owned.length, MAX_ROUTE_ASSETS) };
}

async function readLocalGame(game) {
  const route = normalizeRoute(game.route);
  const relative = route.replace(/^\/+/, '').replace(/\/$/, '');
  const indexPath = path.join(STATIC_ROOT, relative, 'index.html');
  if (!fs.existsSync(indexPath)) return { skipped: true, reason: `no checked-in local index for ${route}` };
  const html = fs.readFileSync(indexPath, 'utf8');
  const assets = localAssetAudit(game, html);
  return { html, url: `file://${indexPath}`, status: 200, assetFailures: assets.failures, assetWarnings: assets.warnings, assetsChecked: assets.checked };
}

async function readLiveGame(game, baseUrl, timeoutMs) {
  const target = `${baseUrl.replace(/\/$/, '')}${normalizeRoute(game.route)}`;
  const response = await fetch(`${target}${target.includes('?') ? '&' : '?'}qa=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = await response.text();
  const assets = await liveAssetAudit(game, html, response.url, timeoutMs);
  return {
    html,
    url: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    assetFailures: assets.failures,
    assetWarnings: assets.warnings,
    assetsChecked: assets.checked,
  };
}

function evaluateHtml({ game, html, status, finalUrl, contract, mode, assetFailures = [], assetWarnings = [], assetsChecked = 0 }) {
  const failures = [...assetFailures];
  const warnings = [...assetWarnings];
  if (status >= 400) failures.push(`HTTP ${status}`);
  if (!/<html\b|<!doctype html/i.test(html)) failures.push('response is not an HTML document');
  const title = titleFromHtml(html);
  if (!title) failures.push('document title is empty');
  const bodyText = stripHtml(html);
  if (bodyText.length < (contract.minimumBodyTextLength ?? 20)) failures.push(`body text is too small (${bodyText.length} chars)`);
  for (const text of contract.requiredText ?? []) {
    if (!bodyText.toLowerCase().includes(String(text).toLowerCase())) failures.push(`required text missing: ${JSON.stringify(text)}`);
  }
  for (const selector of contract.requiredSelectors ?? []) {
    const present = simpleSelectorPresent(html, selector);
    if (present === false) failures.push(`required selector missing: ${selector}`);
    else if (present === null) warnings.push(`selector requires rendered-DOM review: ${selector}`);
  }

  if (mode === 'live') {
    try {
      const pagePath = normalizeRoute(new URL(finalUrl).pathname);
      if (pagePath !== normalizeRoute(game.route)) failures.push(`unexpected final route ${pagePath}; expected ${normalizeRoute(game.route)}`);
    } catch (error) {
      failures.push(`invalid final URL: ${error.message}`);
    }

    if (contract.requireCanonicalShellLive !== false) {
      for (const marker of [
        'data-dtf-shell="header-v6"',
        'data-dtf-sitewide-header="canonical-eight-v1"',
      ]) {
        const count = countToken(html, marker);
        if (count !== 1) failures.push(`expected exactly one live shell marker ${marker}; found ${count}`);
      }
    }
  }

  return {
    id: game.id,
    title: game.title,
    route: game.route,
    status: failures.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS',
    failures,
    warnings,
    documentTitle: title,
    bodyTextLength: bodyText.length,
    routeAssetsChecked: assetsChecked,
  };
}

function writeReports({ outputDir, mode, catalogWarnings, results, skipped, baseUrl, allDeployed }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    mode,
    verifier: 'deterministic-static-http-and-route-assets',
    baseUrl,
    allDeployed,
    catalogWarnings,
    skipped,
    totals: {
      pass: results.filter((item) => item.status === 'PASS').length,
      warn: results.filter((item) => item.status === 'WARN').length,
      fail: results.filter((item) => item.status === 'FAIL').length,
      skipped: skipped.length,
    },
    results,
  };
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);
  const lines = [
    '# DTF Game Portfolio Deterministic QA',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Mode: ${mode}`,
    `- Base URL: ${baseUrl}`,
    `- All deployed routes: ${allDeployed ? 'yes' : 'no'}`,
    `- PASS: ${summary.totals.pass}`,
    `- WARN: ${summary.totals.warn}`,
    `- FAIL: ${summary.totals.fail}`,
    `- SKIPPED: ${summary.totals.skipped}`,
    '',
    '| Game | Status | Route assets | Findings |',
    '| --- | --- | ---: | --- |',
  ];
  for (const result of results) {
    const findings = [...result.failures, ...result.warnings].join(' / ').replace(/\|/g, '\\|') || 'none';
    lines.push(`| ${result.title} (${result.id}) | ${result.status} | ${result.routeAssetsChecked ?? 0} | ${findings} |`);
  }
  if (skipped.length) {
    lines.push('', '## Skipped');
    for (const item of skipped) lines.push(`- ${item.id}: ${item.reason}`);
  }
  if (catalogWarnings.length) {
    lines.push('', '## Catalog warnings');
    for (const warning of catalogWarnings) lines.push(`- ${warning}`);
  }
  fs.writeFileSync(path.join(outputDir, 'summary.md'), `${lines.join('\n')}\n`);
}

function deployedOnlyAsGame(app) {
  return {
    id: app.id,
    title: app.title || app.id,
    route: normalizeRoute(app.route),
    canonicalRepository: app.repository ?? null,
    canonicalSourcePaths: [],
    canonicalSourceOfTruth: null,
    integrationMode: 'deployment-only',
    integrationPath: app.sourcePath ?? null,
    localIndex: null,
    localStaticAvailable: false,
    deployment: app,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogState = loadGameQaCatalog(ROOT);
  let games = [...catalogState.catalog];
  if (args.allDeployed) games.push(...catalogState.deploymentOnly.map(deployedOnlyAsGame));

  if (args.gameIds.length) {
    const requested = new Set(args.gameIds);
    games = games.filter((game) => requested.has(game.id));
    const found = new Set(games.map((game) => game.id));
    const missing = [...requested].filter((id) => !found.has(id));
    if (missing.length) throw new Error(`Unknown game ID(s): ${missing.join(', ')}`);
  }

  if (args.catalogOnly) {
    console.log(JSON.stringify({
      site: catalogState.site,
      warnings: catalogState.warnings,
      games,
      deploymentOnly: catalogState.deploymentOnly,
    }, null, 2));
    return;
  }

  const config = loadContracts();
  const outputDir = path.join(args.outputDir, timestampId());
  const baseUrl = args.baseUrl || catalogState.site || 'https://dtfseeds.com';
  const results = [];
  const skipped = [];

  for (const game of games) {
    const contract = { ...config.defaults, ...(config.games?.[game.id] ?? {}) };
    try {
      const source = args.mode === 'live'
        ? await readLiveGame(game, baseUrl, contract.navigationTimeoutMs ?? 30_000)
        : await readLocalGame(game);
      if (source.skipped) {
        skipped.push({ id: game.id, reason: source.reason });
        continue;
      }
      results.push(evaluateHtml({
        game,
        html: source.html,
        status: source.status,
        finalUrl: source.url,
        contract,
        mode: args.mode,
        assetFailures: source.assetFailures,
        assetWarnings: source.assetWarnings,
        assetsChecked: source.assetsChecked,
      }));
    } catch (error) {
      results.push({ id: game.id, title: game.title, route: game.route, status: 'FAIL', failures: [error.message], warnings: [], routeAssetsChecked: 0 });
    }
  }

  writeReports({
    outputDir,
    mode: args.mode,
    catalogWarnings: catalogState.warnings,
    results,
    skipped,
    baseUrl,
    allDeployed: args.allDeployed,
  });
  const failed = results.filter((item) => item.status === 'FAIL');
  const warned = results.filter((item) => item.status === 'WARN');
  console.log(`[game-qa] mode=${args.mode} ALL_DEPLOYED=${args.allDeployed ? 'yes' : 'no'} PASS=${results.length - failed.length - warned.length} WARN=${warned.length} FAIL=${failed.length} SKIP=${skipped.length}`);
  for (const result of failed) {
    console.error(`[game-qa:FAIL] ${result.id} ${result.route} :: ${result.failures.join(' | ')}`);
  }
  for (const result of warned) {
    console.warn(`[game-qa:WARN] ${result.id} ${result.route} :: ${result.warnings.join(' | ')}`);
  }
  if (failed.length || (args.strict && warned.length)) process.exitCode = 1;
}

await main();
