import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];
const localRepo = 'dtfgenetics/Thc';
const productionSite = 'https://dtfseeds.com';
const modernArchitecture = 'dtf-browser-game-v1';

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

function requireExistingPath(obj, key, label) {
  requireString(obj, key, label);
  const value = obj?.[key];
  if (nonEmptyString(value) && !exists(value)) errors.push(`${label}: ${key} path does not exist: ${value}`);
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

if (deployment.site !== productionSite) {
  errors.push(`site/deployment/public-apps.json: expected site ${productionSite}, got '${deployment.site}'`);
}
if (deployment.sourceOfTruth !== localRepo) {
  errors.push(`site/deployment/public-apps.json: expected sourceOfTruth ${localRepo}, got '${deployment.sourceOfTruth}'`);
}

const apps = Array.isArray(deployment.apps) ? deployment.apps : [];
const projects = Array.isArray(portfolio.projects) ? portfolio.projects : [];
const appById = new Map(apps.filter((app) => nonEmptyString(app?.id)).map((app) => [app.id, app]));
const projectById = new Map(projects.filter((project) => nonEmptyString(project?.id)).map((project) => [project.id, project]));

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
const localGameIds = new Set(localGameProjects.map((project) => project.id).filter(nonEmptyString));
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

    // Shared test/support/integration directories may live under games/. Only registered
    // locally owned game directories are required to carry a game.json when one is absent.
    if (!exists(gameJson)) {
      if (!localGameIds.has(entry.name)) continue;
      if (!exists(readme)) warnings.push(`${gameDir}: missing README.md`);
      warnings.push(`${gameDir}: missing game.json; add one when the project becomes an active DTF game implementation`);
      continue;
    }

    if (!exists(readme)) warnings.push(`${gameDir}: missing README.md`);

    const manifest = loadJson(gameJson);
    if (!manifest) continue;
    const label = gameJson;
    const usesModernArchitecture = manifest.architecture === modernArchitecture;

    if (manifest.id !== entry.name) errors.push(`${gameJson}: id '${manifest.id}' must match folder '${entry.name}'`);
    requireString(manifest, 'title', label);
    requireString(manifest, 'status', label);

    if (nonEmptyString(manifest.route)) {
      if (!manifest.route.startsWith('/games/')) errors.push(`${gameJson}: game route must start with /games/`);
      if (!manifest.route.endsWith('/')) errors.push(`${gameJson}: game route must end with '/'`);
      const app = appById.get(manifest.id);
      if (app && nonEmptyString(app.route) && app.route !== manifest.route) {
        errors.push(`${gameJson}: route '${manifest.route}' does not match deployment route '${app.route}'`);
      } else if (!app) {
        const message = `${gameJson}: declares public route '${manifest.route}' but has no same-id deployment entry`;
        if (usesModernArchitecture) errors.push(message); else warnings.push(message);
      }
    }

    // Existing manifests predate the current architecture contract and remain supported.
    // The stricter checks are intentionally opt-in through the architecture marker emitted by games:new.
    if (!usesModernArchitecture) continue;

    if (Number(manifest.schemaVersion || 0) < 2) {
      errors.push(`${gameJson}: architecture '${modernArchitecture}' requires schemaVersion >= 2`);
    }
    if (manifest.productionTarget !== productionSite) {
      errors.push(`${gameJson}: productionTarget must be '${productionSite}'`);
    }

    const implementation = manifest.implementation;
    if (!implementation || typeof implementation !== 'object' || Array.isArray(implementation)) {
      errors.push(`${gameJson}: architecture '${modernArchitecture}' requires implementation object`);
    } else {
      for (const key of ['entry', 'simulation', 'renderer', 'ui', 'input', 'assets', 'data', 'tests']) {
        requireExistingPath(implementation, key, `${gameJson} implementation`);
      }
      if (manifest.route) {
        requireExistingPath(implementation, 'publicRoute', `${gameJson} implementation`);
      } else if (implementation.publicRoute !== null) {
        errors.push(`${gameJson}: non-public prototype must keep implementation.publicRoute null`);
      }
    }

    if (!manifest.verification || typeof manifest.verification !== 'object' || Array.isArray(manifest.verification)) {
      errors.push(`${gameJson}: architecture '${modernArchitecture}' requires verification object`);
    } else {
      requireString(manifest.verification, 'command', `${gameJson} verification`);
      requireString(manifest.verification, 'workspacePreflight', `${gameJson} verification`);
    }

    const gates = manifest.releaseGates;
    const requiredGates = ['rulesTested', 'browserTested', 'mobileTested', 'accessibilityReviewed', 'originalArtCleared', 'deploymentRegistered'];
    if (!gates || typeof gates !== 'object' || Array.isArray(gates)) {
      errors.push(`${gameJson}: architecture '${modernArchitecture}' requires releaseGates object`);
    } else {
      for (const key of requiredGates) {
        if (typeof gates[key] !== 'boolean') errors.push(`${gameJson}: releaseGates.${key} must be boolean`);
      }
    }

    const project = projectById.get(manifest.id);
    if (project && project.type === 'game' && project.repo !== localRepo) {
      errors.push(`${gameJson}: local modern source conflicts with canonical repository ownership '${project.repo}'`);
    }

    const app = appById.get(manifest.id);
    if (app?.status === 'ready-to-package' && gates?.deploymentRegistered !== true) {
      errors.push(`${gameJson}: ready-to-package modern game must set releaseGates.deploymentRegistered=true`);
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
