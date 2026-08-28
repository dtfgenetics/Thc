import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];
const localRepo = 'dtfgenetics/Thc';

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function loadJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch (error) {
    errors.push(`${rel}: cannot read/parse (${error.message})`);
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireString(obj, key, label) {
  if (!nonEmptyString(obj?.[key])) errors.push(`${label}: missing non-empty ${key}`);
}

function duplicateValues(items, key) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const value = item?.[key];
    if (!nonEmptyString(value)) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

const deployment = loadJson('site/deployment/public-apps.json');
const portfolio = loadJson('data/project-registry.json');
if (!deployment || !portfolio) {
  console.error(errors.join('\n'));
  process.exit(1);
}

if (deployment.site !== 'https://dtfseeds.com') {
  errors.push(`site/deployment/public-apps.json: expected site https://dtfseeds.com, got '${deployment.site}'`);
}
if (deployment.sourceOfTruth !== localRepo) {
  errors.push(`site/deployment/public-apps.json: expected sourceOfTruth ${localRepo}, got '${deployment.sourceOfTruth}'`);
}

const apps = Array.isArray(deployment.apps) ? deployment.apps : [];
const projects = Array.isArray(portfolio.projects) ? portfolio.projects : [];

for (const value of duplicateValues(apps, 'id')) errors.push(`public-apps: duplicate id '${value}'`);
for (const value of duplicateValues(apps.filter((app) => nonEmptyString(app.route)), 'route')) {
  errors.push(`public-apps: duplicate route '${value}'`);
}

for (const app of apps) {
  const label = `public-app ${app?.id ?? '<unknown>'}`;
  requireString(app, 'id', label);
  requireString(app, 'title', label);
  requireString(app, 'repository', label);
  requireString(app, 'runtime', label);
  requireString(app, 'status', label);

  if (nonEmptyString(app.route)) {
    if (!app.route.startsWith('/')) errors.push(`${label}: route must start with '/'`);
    if (!app.route.endsWith('/')) errors.push(`${label}: route must end with '/'`);
    if (app.route !== app.route.toLowerCase()) errors.push(`${label}: route must be lowercase`);
  }

  if (app.status === 'ready-to-package') {
    requireString(app, 'route', label);
    requireString(app, 'build', label);
  }

  if (app.repository === localRepo && nonEmptyString(app.sourcePath) && !exists(app.sourcePath)) {
    errors.push(`${label}: local sourcePath does not exist: ${app.sourcePath}`);
  }

  if (
    app.repository === localRepo &&
    app.status === 'ready-to-package' &&
    nonEmptyString(app.sourcePath) &&
    app.sourcePath.startsWith('site/public-route-patch/games/') &&
    !exists(path.join(app.sourcePath, 'index.html'))
  ) {
    errors.push(`${label}: packaged public game route is missing index.html at ${app.sourcePath}`);
  }

  if (nonEmptyString(app.route) && app.route.startsWith('/games/') && !nonEmptyString(app.title)) {
    errors.push(`${label}: game route must have a title`);
  }
}

const localGameProjects = projects.filter((project) => project?.type === 'game' && project?.repo === localRepo);
const appIds = new Set(apps.map((app) => app.id));

for (const project of localGameProjects) {
  const label = `game project ${project?.id ?? '<unknown>'}`;
  requireString(project, 'id', label);
  requireString(project, 'name', label);
  requireString(project, 'status', label);
  requireString(project, 'source_of_truth_doc', label);

  if (!appIds.has(project.id)) {
    warnings.push(`${label}: no same-id entry in site/deployment/public-apps.json; verify this is intentional`);
  }

  const sourceDoc = project.source_of_truth_doc;
  if (nonEmptyString(sourceDoc) && !sourceDoc.startsWith('repo:') && !exists(sourceDoc)) {
    errors.push(`${label}: source_of_truth_doc does not exist: ${sourceDoc}`);
  }
}

const gamesRoot = path.join(root, 'games');
if (fs.existsSync(gamesRoot)) {
  for (const entry of fs.readdirSync(gamesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const gameDir = path.join('games', entry.name);
    const readme = path.join(gameDir, 'README.md');
    const gameJson = path.join(gameDir, 'game.json');

    if (!exists(readme)) warnings.push(`${gameDir}: missing README.md`);
    if (!exists(gameJson)) {
      warnings.push(`${gameDir}: missing game.json; add one when the project becomes an active DTF game implementation`);
      continue;
    }

    const manifest = loadJson(gameJson);
    if (!manifest) continue;
    if (manifest.id !== entry.name) errors.push(`${gameJson}: id '${manifest.id}' must match folder '${entry.name}'`);
    requireString(manifest, 'title', gameJson);
    requireString(manifest, 'status', gameJson);
    if (nonEmptyString(manifest.route)) {
      if (!manifest.route.startsWith('/games/')) errors.push(`${gameJson}: game route must start with /games/`);
      if (!manifest.route.endsWith('/')) errors.push(`${gameJson}: game route must end with '/'`);
    }
  }
}

if (warnings.length) {
  console.warn(`Game workspace warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`Game workspace verification failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const gameRoutes = apps.filter((app) => nonEmptyString(app.route) && app.route.startsWith('/games/'));
console.log(`Game workspace OK: ${localGameProjects.length} locally owned game projects, ${gameRoutes.length} dtfseeds.com game routes, ${apps.length} deployment entries.`);
