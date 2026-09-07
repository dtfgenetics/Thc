import fs from 'node:fs';
import path from 'node:path';

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertUnique(items, key, label) {
  const seen = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) throw new Error(`${label} entry is missing ${key}`);
    if (seen.has(value)) {
      throw new Error(`${label} has duplicate ${key} ${JSON.stringify(value)} for ${seen.get(value)} and ${item.id ?? item.title ?? 'unknown'}`);
    }
    seen.set(value, item.id ?? item.title ?? 'unknown');
  }
}

export function normalizeRoute(route) {
  if (!route || typeof route !== 'string') throw new Error(`Invalid game route: ${JSON.stringify(route)}`);
  const withLeadingSlash = route.startsWith('/') ? route : `/${route}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function loadGameQaCatalog(rootDir = process.cwd()) {
  const sourceMapPath = path.join(rootDir, 'data/game-source-map.json');
  const deploymentPath = path.join(rootDir, 'site/deployment/public-apps.json');
  const sourceMap = readJson(sourceMapPath);
  const deployment = readJson(deploymentPath);

  if (!Array.isArray(sourceMap.games)) throw new Error('data/game-source-map.json must contain games[]');
  if (!Array.isArray(deployment.apps)) throw new Error('site/deployment/public-apps.json must contain apps[]');

  const games = sourceMap.games.map((game) => ({
    ...game,
    route: normalizeRoute(game.route),
  }));
  const deployedGames = deployment.apps
    .filter((app) => typeof app.route === 'string' && normalizeRoute(app.route).startsWith('/games/'))
    .map((app) => ({ ...app, route: normalizeRoute(app.route) }));

  assertUnique(games, 'id', 'game source map');
  assertUnique(games, 'route', 'game source map');
  assertUnique(deployedGames, 'id', 'game deployment registry');
  assertUnique(deployedGames, 'route', 'game deployment registry');

  const deployById = new Map(deployedGames.map((app) => [app.id, app]));
  const deployByRoute = new Map(deployedGames.map((app) => [app.route, app]));
  const publicIds = new Set(games.map((game) => game.id));
  const publicRoutes = new Set(games.map((game) => game.route));

  const warnings = [];
  const catalog = games.map((game) => {
    const deploymentApp = deployById.get(game.id) ?? deployByRoute.get(game.route) ?? null;
    if (!deploymentApp) warnings.push(`No deployment registry entry for ${game.id} ${game.route}`);
    if (deploymentApp && deploymentApp.route !== game.route) {
      throw new Error(`Route drift for ${game.id}: source map=${game.route} deployment=${deploymentApp.route}`);
    }
    if (deploymentApp?.repository && game.canonical?.repository && deploymentApp.repository !== game.canonical.repository) {
      warnings.push(`Repository drift for ${game.id}: canonical=${game.canonical.repository} deployment=${deploymentApp.repository}`);
    }

    const integration = game.integration ?? {};
    const integrationPath = integration.path ? path.join(rootDir, integration.path) : null;
    const localIndex = integrationPath && integration.mode === 'local-static'
      ? path.join(integrationPath, 'index.html')
      : null;

    return {
      id: game.id,
      title: game.title,
      route: game.route,
      canonicalRepository: game.canonical?.repository ?? null,
      canonicalSourcePaths: game.canonical?.sourcePaths ?? [],
      canonicalSourceOfTruth: game.canonical?.sourceOfTruth ?? null,
      integrationMode: integration.mode ?? null,
      integrationPath: integration.path ?? null,
      localIndex,
      localStaticAvailable: Boolean(localIndex && fs.existsSync(localIndex)),
      deployment: deploymentApp,
    };
  });

  // The deployment registry is intentionally broader than the public source map: it may
  // contain release candidates or reserved routes such as Ganjumanji, THC RPG, and Root Cause
  // before they are promoted into the public playable catalog. Keep those visible as metadata,
  // but do not classify them as source-map drift or make strict public QA fail.
  const deploymentOnly = deployedGames.filter((app) => !publicIds.has(app.id) && !publicRoutes.has(app.route));

  return {
    site: sourceMap.site ?? deployment.site ?? 'https://dtfseeds.com',
    updated: sourceMap.updated ?? deployment.updated ?? null,
    catalog,
    deploymentOnly,
    warnings,
    sourceMapPath,
    deploymentPath,
  };
}
