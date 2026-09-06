import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIVE = process.argv.includes('--live');
const SITE = 'https://dtfseeds.com';
const LOCAL_REPO = 'dtfgenetics/Thc';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMarkup(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function duplicateValues(items, selector) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const value = selector(item);
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function fail(message) {
  failures.push(message);
}

function localPathExists(rel) {
  return typeof rel === 'string' && rel.length > 0 && fs.existsSync(path.join(ROOT, rel));
}

const nav = readJson('data/public-navigation.json');
const deployment = readJson('site/deployment/public-apps.json');
const portfolio = readJson('data/project-registry.json');
const sourceMap = readJson('data/game-source-map.json');
const gameHubHtml = readText('site/public-route-patch/games/index.html');
const projectsHtml = readText('site/public-route-patch/projects/index.html');
const projectsText = stripMarkup(projectsHtml);
const failures = [];
const warnings = [];

const publicGames = (nav.games || []).filter((game) => game?.public && game?.route);
const apps = Array.isArray(deployment.apps) ? deployment.apps : [];
const portfolioGames = (portfolio.projects || []).filter((project) => project?.type === 'game');
const sourceGames = Array.isArray(sourceMap.games) ? sourceMap.games : [];

for (const id of duplicateValues(publicGames, (game) => game.id)) fail(`duplicate public game id: ${id}`);
for (const route of duplicateValues(publicGames, (game) => game.route)) fail(`duplicate public game route: ${route}`);
for (const id of duplicateValues(sourceGames, (game) => game.id)) fail(`duplicate game source-map id: ${id}`);
for (const route of duplicateValues(sourceGames, (game) => game.route)) fail(`duplicate game source-map route: ${route}`);

if (sourceGames.length !== publicGames.length) {
  fail(`game-source-map contains ${sourceGames.length} games while public-navigation exposes ${publicGames.length}.`);
}

for (const mapped of sourceGames) {
  if (!publicGames.some((game) => game.id === mapped.id)) {
    fail(`game-source-map contains non-public or unknown game id: ${mapped.id || '<missing>'}.`);
  }
}

const countMarker = gameHubHtml.match(/deployment-verification-marker:\s*(\d+)\s+playable browser games/i);
if (!countMarker) {
  fail('Game Hub is missing its playable-game deployment verification marker.');
} else if (Number(countMarker[1]) !== publicGames.length) {
  fail(`Game Hub marker says ${countMarker[1]} playable games, registry exposes ${publicGames.length}.`);
}

const nonPublicReady = new Set([
  'not-deployable',
  'server-engine-alpha',
  'concept-placeholder',
  'preproduction',
  'in-development'
]);

for (const game of publicGames) {
  if (!gameHubHtml.includes(`href="${game.route}"`) && !gameHubHtml.includes(`href='${game.route}'`)) {
    fail(`Game Hub is missing public route ${game.id}: ${game.route}`);
  }

  const app = apps.find((candidate) => candidate.id === game.id);
  if (!app) {
    fail(`${game.id} is public but missing from site/deployment/public-apps.json.`);
    continue;
  }

  if (app.route !== game.route) {
    fail(`${game.id} route mismatch: navigation=${game.route} deployment=${app.route || '<none>'}`);
  }
  if (nonPublicReady.has(app.status)) {
    fail(`${game.id} is public while deployment status is ${app.status}.`);
  }

  const mapping = sourceGames.find((candidate) => candidate.id === game.id);
  if (!mapping) {
    fail(`${game.id} is public but has no canonical entry in data/game-source-map.json.`);
  } else {
    if (mapping.route !== game.route) {
      fail(`${game.id} source-map route mismatch: navigation=${game.route} source-map=${mapping.route || '<none>'}`);
    }

    const canonical = mapping.canonical || {};
    if (!canonical.repository) {
      fail(`${game.id} source-map entry is missing canonical.repository.`);
    }
    if (!canonical.projectId) {
      fail(`${game.id} source-map entry is missing canonical.projectId.`);
    }
    if (!Array.isArray(canonical.sourcePaths) || canonical.sourcePaths.length === 0) {
      fail(`${game.id} source-map entry must declare at least one canonical source path.`);
    }
    if (!canonical.sourceOfTruth) {
      fail(`${game.id} source-map entry is missing canonical.sourceOfTruth.`);
    }

    const project = portfolioGames.find((candidate) => candidate.id === canonical.projectId);
    if (!project) {
      fail(`${game.id} maps to missing project-registry id ${canonical.projectId || '<none>'}.`);
    } else if (canonical.repository && project.repo !== canonical.repository) {
      fail(`${game.id} canonical repository mismatch: source-map=${canonical.repository} project-registry=${project.repo || '<none>'}.`);
    }

    if (canonical.repository && app.repository && canonical.repository !== app.repository) {
      fail(`${game.id} canonical repository mismatch: source-map=${canonical.repository} deployment=${app.repository}.`);
    }

    if (canonical.repository === LOCAL_REPO) {
      for (const sourcePath of canonical.sourcePaths || []) {
        if (!localPathExists(sourcePath)) {
          fail(`${game.id} canonical local source path is missing: ${sourcePath}.`);
        }
      }
      if (!localPathExists(canonical.sourceOfTruth)) {
        fail(`${game.id} canonical local source-of-truth file is missing: ${canonical.sourceOfTruth}.`);
      }
    }

    const integration = mapping.integration || {};
    if (integration.repository !== LOCAL_REPO) {
      fail(`${game.id} must declare dtfgenetics/Thc as its DTFSeeds integration repository.`);
    }
    if (integration.path && !localPathExists(integration.path)) {
      fail(`${game.id} integration path is missing: ${integration.path}.`);
    }
  }

  if (typeof app.sourcePath === 'string' && app.sourcePath.startsWith('site/public-route-patch/')) {
    const indexPath = path.join(ROOT, app.sourcePath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fail(`${game.id} public source is missing ${app.sourcePath}/index.html.`);
    } else if (fs.statSync(indexPath).size < 180) {
      fail(`${game.id} public source index is implausibly small.`);
    }
  }

  const mapping = sourceGames.find((candidate) => candidate.id === game.id);
  const project = mapping
    ? portfolioGames.find((candidate) => candidate.id === mapping.canonical?.projectId)
    : portfolioGames.find((candidate) => candidate.id === game.id);
  const projectName = project?.name || game.title;
  if (projectName) {
    const developmentBlock = projectsText.match(/Development roadmap([\s\S]*?)(?:Release rule|$)/i)?.[1] || '';
    const namePattern = new RegExp(`\\b${escapeRegExp(projectName)}\\b`, 'i');
    if (namePattern.test(developmentBlock)) {
      fail(`${game.id} is public but still appears in the Projects development roadmap as “${projectName}”.`);
    }
  }
}

for (const app of apps) {
  if (!app?.route?.startsWith('/games/')) continue;
  if (nonPublicReady.has(app.status)) continue;
  if (!publicGames.some((game) => game.id === app.id)) {
    warnings.push(`${app.id} has a deployable game route (${app.route}) but is not promoted in public-navigation.json.`);
  }
}

function identityMarkers(game, app) {
  const markers = new Set();
  for (const value of [app?.title, game?.title]) {
    if (!value) continue;
    markers.add(value);
    const compact = value.split(/\s+[—|:/]\s+|\s+\/\s+/)[0]?.trim();
    if (compact && compact.length >= 4) markers.add(compact);
  }
  if (game.id === 'bud-or-bluff') markers.add('Create lobby');
  if (game.id === 'protect-the-plants') markers.add('Burn Buds');
  return [...markers].filter((marker) => marker.length >= 4);
}

async function fetchDirect(game, app) {
  const url = new URL(game.route, SITE);
  url.searchParams.set('dtf_release_integrity', `${Date.now()}-${game.id}`);
  let response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': 'DTFSeeds-Release-Integrity/1.0',
        'cache-control': 'no-cache, no-store, max-age=0',
        pragma: 'no-cache'
      },
      signal: AbortSignal.timeout(25_000)
    });
  } catch (error) {
    fail(`${game.id} live route request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const location = response.headers.get('location') || '';
  if (response.status !== 200) {
    fail(`${game.id} must return direct HTTP 200 at ${game.route}; received ${response.status}${location ? ` -> ${location}` : ''}.`);
    return;
  }
  if (location) {
    fail(`${game.id} unexpectedly returned a redirect Location header: ${location}`);
    return;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html/i.test(contentType)) {
    fail(`${game.id} returned unexpected content type: ${contentType || '<missing>'}.`);
    return;
  }

  const html = await response.text();
  if (html.length < 180) {
    fail(`${game.id} live HTML is implausibly small (${html.length} bytes).`);
    return;
  }

  if (/Pick what is playable\. See what is coming next\./i.test(html) && game.route !== '/games/') {
    fail(`${game.id} is serving the Game Hub fallback instead of its own route.`);
  }

  const markers = identityMarkers(game, app);
  if (markers.length && !markers.some((marker) => html.toLowerCase().includes(marker.toLowerCase()))) {
    fail(`${game.id} returned HTTP 200 but did not contain an identity marker (${markers.join(' | ')}).`);
  }
}

if (LIVE) {
  const liveGames = publicGames.filter((game) => {
    const app = apps.find((candidate) => candidate.id === game.id);
    return app?.status === 'ready-to-package';
  });
  for (const game of liveGames) {
    const app = apps.find((candidate) => candidate.id === game.id);
    await fetchDirect(game, app);
  }
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (failures.length) {
  console.error(`\nPublic game release integrity FAILED (${failures.length} problem${failures.length === 1 ? '' : 's'}):`);
  for (const problem of failures) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Public game release integrity passed: ${publicGames.length} public games with canonical ownership${LIVE ? ' + direct production route identity checks' : ''}.`);
