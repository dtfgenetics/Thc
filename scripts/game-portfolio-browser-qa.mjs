import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameQaCatalog, readJson, normalizeRoute } from './lib/game-qa-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    mode: 'local',
    strict: false,
    catalogOnly: false,
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
    else if (arg === '--game') args.gameIds.push(...String(argv[++i] ?? '').split(',').filter(Boolean));
    else if (arg === '--output') args.outputDir = path.resolve(ROOT, argv[++i]);
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--no-screenshots') {
      // Accepted for backward-compatible CLI calls; deterministic QA does not capture screenshots.
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/game-portfolio-browser-qa.mjs [--local|--live] [--game id[,id]] [--strict] [--output path] [--base-url URL] [--catalog]');
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
    return new RegExp(`\\bid\\s*=\\s*['\"]${id}['\"]`, 'i').test(html);
  }
  if (/^\.[A-Za-z][\w:-]*$/.test(value)) {
    const className = value.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\bclass\\s*=\\s*['\"][^'\"]*\\b${className}\\b[^'\"]*['\"]`, 'i').test(html);
  }
  if (/^[A-Za-z][\w-]*$/.test(value)) return new RegExp(`<${value}(?:\\s|>)`, 'i').test(html);
  return null;
}

async function readLocalGame(game) {
  const staticRoot = path.join(ROOT, 'site/public-route-patch');
  const route = normalizeRoute(game.route);
  const relative = route.replace(/^\/+/, '').replace(/\/$/, '');
  const indexPath = path.join(staticRoot, relative, 'index.html');
  if (!fs.existsSync(indexPath)) return { skipped: true, reason: `no checked-in local index for ${route}` };
  return { html: fs.readFileSync(indexPath, 'utf8'), url: `file://${indexPath}`, status: 200 };
}

async function readLiveGame(game, baseUrl, timeoutMs) {
  const target = `${baseUrl.replace(/\/$/, '')}${normalizeRoute(game.route)}`;
  const response = await fetch(`${target}${target.includes('?') ? '&' : '?'}qa=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = await response.text();
  return { html, url: response.url, status: response.status, contentType: response.headers.get('content-type') || '' };
}

function evaluateHtml({ game, html, status, finalUrl, contract, mode }) {
  const failures = [];
  const warnings = [];
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
  };
}

function writeReports({ outputDir, mode, catalogWarnings, results, skipped, baseUrl }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    mode,
    verifier: 'deterministic-static-and-http',
    baseUrl,
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
    `- PASS: ${summary.totals.pass}`,
    `- WARN: ${summary.totals.warn}`,
    `- FAIL: ${summary.totals.fail}`,
    `- SKIPPED: ${summary.totals.skipped}`,
    '',
    '| Game | Status | Findings |',
    '| --- | --- | --- |',
  ];
  for (const result of results) {
    const findings = [...result.failures, ...result.warnings].join(' / ').replace(/\|/g, '\\|') || 'none';
    lines.push(`| ${result.title} (${result.id}) | ${result.status} | ${findings} |`);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogState = loadGameQaCatalog(ROOT);
  let games = catalogState.catalog;
  if (args.gameIds.length) {
    const requested = new Set(args.gameIds);
    games = games.filter((game) => requested.has(game.id));
    const found = new Set(games.map((game) => game.id));
    const missing = [...requested].filter((id) => !found.has(id));
    if (missing.length) throw new Error(`Unknown game ID(s): ${missing.join(', ')}`);
  }

  if (args.catalogOnly) {
    console.log(JSON.stringify({ site: catalogState.site, warnings: catalogState.warnings, games }, null, 2));
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
      }));
    } catch (error) {
      results.push({ id: game.id, title: game.title, route: game.route, status: 'FAIL', failures: [error.message], warnings: [] });
    }
  }

  writeReports({ outputDir, mode: args.mode, catalogWarnings: catalogState.warnings, results, skipped, baseUrl });
  const failed = results.filter((item) => item.status === 'FAIL');
  const warned = results.filter((item) => item.status === 'WARN');
  console.log(`[game-qa] mode=${args.mode} PASS=${results.length - failed.length - warned.length} WARN=${warned.length} FAIL=${failed.length} SKIP=${skipped.length}`);
  if (failed.length || (args.strict && warned.length)) process.exitCode = 1;
}

await main();
