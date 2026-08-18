import { readFile } from 'node:fs/promises';
import process from 'node:process';

const registryPath = new URL('../site/deployment/public-apps.json', import.meta.url);
const registry = JSON.parse(await readFile(registryPath, 'utf8'));

const requiredRepositories = new Set([
  'dtfgenetics/Thc',
  'dtfgenetics/thc-u-know-card-game-',
  'dtfgenetics/Weedopolis-strain-Edition',
  'dtfgenetics/Thc-crossword-',
  'dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple',
  'dtfgenetics/Thc-chess-git',
  'dtfgenetics/Terpocalapse',
  'dtfgenetics/Thc-guess-who',
  'dtfgenetics/Thc-rpg',
  'dtfgenetics/Catching-phenos',
  'dtfgenetics/Video-photo-editing-and-communications-posting-',
  'dtfgenetics/Happy-seed-story-s-',
  'dtfgenetics/all-in-one-thc-grow-',
  'dtfgenetics/thc-grow-hub',
  'dtfgenetics/Thc-dataset',
  'dtfgenetics/thc-discord-bot-for-music-',
  'dtfgenetics/thc-music-bot-for-discod',
]);

const allowedStatuses = new Set([
  'ready-to-package',
  'public-landing',
  'runtime-integration',
  'preview-artifact-integration',
  'in-development',
  'not-deployable',
  'release-gated-content',
  'private-operations-only',
]);

const errors = [];

if (registry.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
if (registry.site !== 'https://dtfseeds.com') errors.push('site must equal https://dtfseeds.com');
if (registry.sourceOfTruth !== 'dtfgenetics/Thc') errors.push('sourceOfTruth must equal dtfgenetics/Thc');
if (!Array.isArray(registry.apps) || registry.apps.length === 0) errors.push('apps must be a non-empty array');

const ids = new Set();
const routes = new Map();
const representedRepositories = new Set();

for (const [index, app] of (registry.apps || []).entries()) {
  const where = `apps[${index}]`;
  if (!app || typeof app !== 'object') {
    errors.push(`${where} must be an object`);
    continue;
  }

  if (typeof app.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(app.id)) errors.push(`${where}.id must be lowercase kebab-case`);
  else if (ids.has(app.id)) errors.push(`duplicate app id: ${app.id}`);
  else ids.add(app.id);

  if (typeof app.title !== 'string' || app.title.trim().length < 2) errors.push(`${where}.title is required`);
  if (typeof app.repository !== 'string' || !/^dtfgenetics\/[A-Za-z0-9._-]+$/.test(app.repository)) errors.push(`${where}.repository must be a dtfgenetics GitHub repository`);
  else representedRepositories.add(app.repository);

  if (!allowedStatuses.has(app.status)) errors.push(`${where}.status is not allowed: ${String(app.status)}`);
  if (typeof app.runtime !== 'string' || app.runtime.trim() === '') errors.push(`${where}.runtime is required`);

  if (app.route !== undefined) {
    if (typeof app.route !== 'string' || !app.route.startsWith('/') || !app.route.endsWith('/') || app.route.includes('..')) {
      errors.push(`${where}.route must be a safe root-relative directory route`);
    } else if (routes.has(app.route)) {
      errors.push(`duplicate route ${app.route}: ${routes.get(app.route)} and ${app.id}`);
    } else {
      routes.set(app.route, app.id);
    }
  }

  for (const field of ['appTarget', 'apiTarget']) {
    if (app[field] !== undefined && (typeof app[field] !== 'string' || !app[field].startsWith('https://'))) {
      errors.push(`${where}.${field} must use https://`);
    }
  }

  if (app.status === 'ready-to-package') {
    if (!app.route) errors.push(`${where} is ready-to-package but has no route`);
    if (typeof app.build !== 'string' || app.build.trim() === '') errors.push(`${where} is ready-to-package but has no build command`);
  }

  if (app.status === 'runtime-integration' && typeof app.build !== 'string') {
    errors.push(`${where} is runtime-integration but has no build command`);
  }

  if (app.status === 'not-deployable' && app.route) {
    errors.push(`${where} is not-deployable but claims public route ${app.route}`);
  }
}

for (const repository of requiredRepositories) {
  if (!representedRepositories.has(repository)) errors.push(`repository missing from app registry: ${repository}`);
}

const unexpected = [...representedRepositories].filter((repository) => !requiredRepositories.has(repository));
for (const repository of unexpected) errors.push(`unreviewed repository in app registry: ${repository}`);

if (errors.length) {
  console.error(`Public app registry validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Public app registry valid: ${registry.apps.length} app/project records, ${representedRepositories.size} repositories, ${routes.size} public routes.`);
