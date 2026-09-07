import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadGameQaCatalog, readJson, normalizeRoute } from './lib/game-qa-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {
    mode: 'local',
    strict: false,
    screenshots: true,
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
    else if (arg === '--no-screenshots') args.screenshots = false;
    else if (arg === '--catalog') args.catalogOnly = true;
    else if (arg === '--game') args.gameIds.push(...String(argv[++i] ?? '').split(',').filter(Boolean));
    else if (arg === '--output') args.outputDir = path.resolve(ROOT, argv[++i]);
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/game-portfolio-browser-qa.mjs [options]\n\nOptions:\n  --local                Test locally packaged static game routes (default)\n  --live                 Test visitor-facing routes on dtfseeds.com\n  --game id[,id]         Limit to one or more game IDs\n  --strict               Treat warnings as failures\n  --no-screenshots       Skip screenshot capture\n  --output path          Override artifact output directory\n  --base-url URL         Override live base URL\n  --catalog              Print resolved catalog and exit\n`);
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

function getPlaywright() {
  let resolved;
  try {
    resolved = require.resolve('@playwright/test', { paths: [path.join(ROOT, 'apps/high-land-web')] });
  } catch (error) {
    throw new Error(`Playwright is not installed. Run npm ci first. Resolver error: ${error.message}`);
  }
  return require(resolved);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
  }[ext] ?? 'application/octet-stream';
}

async function startStaticServer() {
  const staticRoot = path.join(ROOT, 'site/public-route-patch');
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const decoded = decodeURIComponent(url.pathname);
      const relative = decoded.replace(/^\/+/, '');
      let filePath = path.resolve(staticRoot, relative);
      if (!filePath.startsWith(path.resolve(staticRoot))) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'content-type': mimeType(filePath),
        'cache-control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function cleanFileName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function normalizePagePath(urlValue) {
  const url = new URL(urlValue);
  return normalizeRoute(url.pathname);
}

function shouldIgnore(message, patterns = []) {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(message);
    } catch {
      return message.includes(pattern);
    }
  });
}

async function evaluatePage({ browser, game, viewportName, viewport, baseUrl, config, outputDir, screenshots }) {
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const warnings = [];
  const failures = [];
  const contract = { ...config.defaults, ...(config.games?.[game.id] ?? {}) };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.hasTouch),
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const expectedOrigin = new URL(baseUrl).origin;

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    try {
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === expectedOrigin) {
        requestFailures.push(`${request.method()} ${requestUrl.pathname}: ${request.failure()?.errorText ?? 'failed'}`);
      }
    } catch {
      requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
    }
  });

  const target = `${baseUrl.replace(/\/$/, '')}${game.route}`;
  let response = null;
  let navigationError = null;
  try {
    response = await page.goto(target, {
      waitUntil: 'domcontentloaded',
      timeout: contract.navigationTimeoutMs,
    });
    await page.waitForTimeout(contract.settleMs);
  } catch (error) {
    navigationError = error.message;
  }

  if (navigationError) failures.push(`navigation failed: ${navigationError}`);
  if (response && response.status() >= 400) failures.push(`HTTP ${response.status()} at ${target}`);
  if (!response) failures.push(`no navigation response for ${target}`);

  if (!navigationError) {
    const pagePath = normalizePagePath(page.url());
    if (pagePath !== game.route) failures.push(`unexpected final route ${pagePath}; expected ${game.route}`);

    const metrics = await page.evaluate(() => ({
      title: document.title.trim(),
      bodyTextLength: document.body?.innerText?.trim().length ?? 0,
      bodyText: document.body?.innerText ?? '',
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      innerWidth: window.innerWidth,
      interactiveCount: document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], canvas, svg').length,
    }));

    if (!metrics.title) failures.push('document title is empty');
    if (metrics.bodyTextLength < contract.minimumBodyTextLength) failures.push(`body text is too small (${metrics.bodyTextLength} chars)`);
    const overflow = metrics.scrollWidth - metrics.innerWidth;
    if (overflow > contract.maxHorizontalOverflowPx) failures.push(`horizontal overflow ${overflow}px exceeds ${contract.maxHorizontalOverflowPx}px`);
    if (metrics.interactiveCount === 0) warnings.push('no obvious interactive elements detected');

    for (const selector of contract.requiredSelectors ?? []) {
      const count = await page.locator(selector).count();
      if (count === 0) failures.push(`required selector missing: ${selector}`);
    }
    for (const text of contract.requiredText ?? []) {
      if (!metrics.bodyText.toLowerCase().includes(String(text).toLowerCase())) failures.push(`required text missing: ${JSON.stringify(text)}`);
    }

    if (screenshots) {
      const file = path.join(outputDir, 'screenshots', `${cleanFileName(game.id)}-${viewportName}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage: false });
    }
  }

  const ignoredConsolePatterns = contract.ignoreConsolePatterns ?? [];
  const effectiveConsoleErrors = consoleErrors.filter((message) => !shouldIgnore(message, ignoredConsolePatterns));
  if (contract.failOnConsoleError && effectiveConsoleErrors.length) failures.push(`console errors: ${effectiveConsoleErrors.join(' | ')}`);
  else if (effectiveConsoleErrors.length) warnings.push(`console errors: ${effectiveConsoleErrors.join(' | ')}`);

  if (contract.failOnPageError && pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);
  else if (pageErrors.length) warnings.push(`page errors: ${pageErrors.join(' | ')}`);

  if (contract.failOnSameOriginRequestFailure && requestFailures.length) failures.push(`same-origin request failures: ${requestFailures.join(' | ')}`);
  else if (requestFailures.length) warnings.push(`same-origin request failures: ${requestFailures.join(' | ')}`);

  await context.close();

  return {
    id: game.id,
    title: game.title,
    route: game.route,
    viewport: viewportName,
    status: failures.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS',
    failures,
    warnings,
    pageErrors,
    consoleErrors: effectiveConsoleErrors,
    requestFailures,
  };
}

function writeReports({ outputDir, mode, catalogWarnings, results, skipped, baseUrl }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
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
    '# DTF Game Portfolio Browser QA',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Mode: ${mode}`,
    `- Base URL: ${baseUrl}`,
    `- PASS: ${summary.totals.pass}`,
    `- WARN: ${summary.totals.warn}`,
    `- FAIL: ${summary.totals.fail}`,
    `- SKIPPED: ${summary.totals.skipped}`,
    '',
    '| Game | Viewport | Status | Findings |',
    '| --- | --- | --- | --- |',
  ];
  for (const result of results) {
    const findings = [...result.failures, ...result.warnings].join(' / ').replace(/\|/g, '\\|') || 'none';
    lines.push(`| ${result.title} (${result.id}) | ${result.viewport} | ${result.status} | ${findings} |`);
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
  let server = null;
  let baseUrl;
  let testGames = games;
  const skipped = [];

  if (args.mode === 'local') {
    server = await startStaticServer();
    baseUrl = server.baseUrl;
    testGames = games.filter((game) => {
      if (game.localStaticAvailable) return true;
      skipped.push({ id: game.id, reason: `integration mode ${game.integrationMode ?? 'unknown'} has no checked-in local-static index` });
      return false;
    });
  } else {
    baseUrl = args.baseUrl || catalogState.site || 'https://dtfseeds.com';
  }

  const { chromium } = getPlaywright();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const game of testGames) {
      for (const [viewportName, viewport] of Object.entries(config.defaults.viewports)) {
        console.log(`[game-qa] ${args.mode} ${game.id} ${viewportName}`);
        results.push(await evaluatePage({
          browser,
          game,
          viewportName,
          viewport,
          baseUrl,
          config,
          outputDir,
          screenshots: args.screenshots,
        }));
      }
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  writeReports({
    outputDir,
    mode: args.mode,
    catalogWarnings: catalogState.warnings,
    results,
    skipped,
    baseUrl,
  });

  const failed = results.filter((item) => item.status === 'FAIL');
  const warned = results.filter((item) => item.status === 'WARN');
  console.log(`[game-qa] PASS=${results.length - failed.length - warned.length} WARN=${warned.length} FAIL=${failed.length} SKIP=${skipped.length}`);
  console.log(`[game-qa] artifacts: ${path.relative(ROOT, outputDir)}`);
  if (failed.length || (args.strict && (warned.length || catalogState.warnings.length))) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[game-qa] ${error.stack || error.message}`);
  process.exitCode = 1;
});
