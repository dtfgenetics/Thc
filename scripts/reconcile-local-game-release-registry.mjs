import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checkOnly = process.argv.includes('--check');
const today = process.env.RELEASE_REGISTRY_DATE || new Date().toISOString().slice(0, 10);

const registryPath = path.join(root, 'data/project-registry.json');
const publicAppsPath = path.join(root, 'site/deployment/public-apps.json');
const gamesRoot = path.join(root, 'games');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fileExists = (relative) => fs.existsSync(path.join(root, relative));
const normalizeRelative = (value) => String(value || '').replace(/^\.\//, '').replace(/\\/g, '/').replace(/\/$/, '');

function publicRouteFor(manifest) {
  const declared = normalizeRelative(manifest.implementation?.publicRoute);
  if (declared && fileExists(`${declared}/index.html`)) return declared;
  const fallback = `site/public-route-patch/games/${manifest.id}`;
  return fileExists(`${fallback}/index.html`) ? fallback : null;
}

function validationCommands(manifest, publicRoute) {
  const commands = [];
  const addNode = (relative) => {
    const normalized = normalizeRelative(relative);
    if (normalized && fileExists(normalized)) commands.push(`node ${normalized}`);
  };

  addNode(manifest.implementation?.validator);
  if (!commands.length) addNode(`games/${manifest.id}/scripts/validate-data.mjs`);

  for (const candidate of [
    `games/${manifest.id}/test/engine.test.mjs`,
    `games/${manifest.id}/test/physics.test.mjs`,
    `games/${manifest.id}/test/rules.test.mjs`
  ]) {
    if (fileExists(candidate)) commands.push(`node ${candidate}`);
  }

  for (const candidate of ['app.js', 'engine.mjs']) {
    if (fileExists(`${publicRoute}/${candidate}`)) commands.push(`node --check ${publicRoute}/${candidate}`);
  }

  return [...new Set(commands)];
}

function eligibleGame(manifest, publicRoute) {
  return manifest?.type === 'browser-game'
    && typeof manifest.route === 'string'
    && manifest.route.startsWith('/games/')
    && manifest.releaseGates?.rulesTested === true
    && manifest.releaseGates?.originalArtCleared === true
    && Boolean(publicRoute);
}

const gameRecords = fs.readdirSync(gamesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const manifestPath = path.join(gamesRoot, entry.name, 'game.json');
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = readJson(manifestPath);
    const publicRoute = publicRouteFor(manifest);
    return { manifest, manifestPath, publicRoute };
  })
  .filter(Boolean)
  .filter(({ manifest, publicRoute }) => eligibleGame(manifest, publicRoute))
  .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

const registry = readJson(registryPath);
const publicApps = readJson(publicAppsPath);
const originalRegistry = JSON.stringify(registry);
const originalPublicApps = JSON.stringify(publicApps);
const originalManifests = new Map(gameRecords.map(({ manifestPath }) => [manifestPath, fs.readFileSync(manifestPath, 'utf8')]));

const registryIds = new Set(registry.projects.map((project) => project.id));
const appIds = new Set(publicApps.apps.map((app) => app.id));
const routes = new Map(publicApps.apps.filter((app) => app.route).map((app) => [app.route, app.id]));

const addedProjects = [];
const addedApps = [];
const registeredManifests = [];

for (const record of gameRecords) {
  const { manifest, manifestPath, publicRoute } = record;
  const id = manifest.id;

  if (!registryIds.has(id)) {
    registry.projects.push({
      id,
      name: manifest.title,
      type: 'game',
      status: manifest.status,
      repo: 'dtfgenetics/Thc',
      repo_role: `canonical tested browser implementation and self-hosted DTFSeeds route under games/${id} and ${publicRoute}`,
      drive_path: null,
      library_path: null,
      release_path: null,
      source_of_truth_doc: `games/${id}/README.md`
    });
    registryIds.add(id);
    addedProjects.push(id);
  }

  if (!appIds.has(id)) {
    const existingRouteOwner = routes.get(manifest.route);
    if (existingRouteOwner && existingRouteOwner !== id) {
      throw new Error(`Refusing duplicate public route ${manifest.route}: ${existingRouteOwner} vs ${id}`);
    }
    const commands = validationCommands(manifest, publicRoute);
    if (!commands.length) throw new Error(`No deterministic build/validation command found for ${id}`);

    publicApps.apps.push({
      id,
      title: manifest.title,
      repository: 'dtfgenetics/Thc',
      sourcePath: publicRoute,
      canonicalDataPath: `games/${id}`,
      route: manifest.route,
      runtime: 'static',
      status: 'ready-to-package',
      build: commands.join(' && '),
      notes: `Self-hosted ${manifest.status} registered from its tested canonical game manifest. Browser, mobile, accessibility, and production-route verification remain separate release gates.`
    });
    appIds.add(id);
    routes.set(manifest.route, id);
    addedApps.push(id);
  }

  if (appIds.has(id) && manifest.releaseGates.deploymentRegistered !== true) {
    manifest.releaseGates.deploymentRegistered = true;
    registeredManifests.push(id);
    record.updatedManifest = manifest;
  }
}

registry.updated = today;
publicApps.updated = today;

const registryIdsAfter = registry.projects.map((project) => project.id);
const appIdsAfter = publicApps.apps.map((app) => app.id);
if (new Set(registryIdsAfter).size !== registryIdsAfter.length) throw new Error('Project registry contains duplicate ids after reconciliation.');
if (new Set(appIdsAfter).size !== appIdsAfter.length) throw new Error('Public app registry contains duplicate ids after reconciliation.');
const publicRoutes = publicApps.apps.filter((app) => app.route).map((app) => app.route);
if (new Set(publicRoutes).size !== publicRoutes.length) throw new Error('Public app registry contains duplicate routes after reconciliation.');

const nextRegistry = JSON.stringify(registry);
const nextPublicApps = `${JSON.stringify(publicApps, null, 2)}\n`;
const changed = nextRegistry !== originalRegistry
  || JSON.stringify(publicApps) !== originalPublicApps
  || registeredManifests.length > 0;

if (checkOnly) {
  if (changed) {
    console.error('Local game release registries are out of sync.');
    console.error({ addedProjects, addedApps, registeredManifests });
    process.exit(1);
  }
  console.log(`Local game release registry is synchronized for ${gameRecords.length} tested public games.`);
  process.exit(0);
}

fs.writeFileSync(registryPath, nextRegistry);
fs.writeFileSync(publicAppsPath, nextPublicApps);
for (const record of gameRecords) {
  if (!record.updatedManifest) continue;
  fs.writeFileSync(record.manifestPath, `${JSON.stringify(record.updatedManifest, null, 2)}\n`);
}

console.log('Local game release registry reconciled.');
console.log({ eligibleGames: gameRecords.map(({ manifest }) => manifest.id), addedProjects, addedApps, registeredManifests });
