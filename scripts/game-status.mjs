import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const idFlag = process.argv.indexOf('--id');
const requestedId = idFlag >= 0 ? (process.argv[idFlag + 1] || '').trim() : '';

if (idFlag >= 0 && !requestedId) {
  console.error('Usage: npm run games:status -- --id <game-id>');
  process.exit(1);
}

function loadJson(rel) {
  const full = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    console.error(`${rel}: ${error.message}`);
    process.exit(1);
  }
}

function text(value, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function escapeCell(value) {
  return text(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function printTable(headers, rows) {
  console.log(`| ${headers.join(' | ')} |`);
  console.log(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    console.log(`| ${row.map(escapeCell).join(' | ')} |`);
  }
}

const portfolio = loadJson('data/project-registry.json');
const deployment = loadJson('site/deployment/public-apps.json');

const projects = Array.isArray(portfolio.projects) ? portfolio.projects : [];
const apps = Array.isArray(deployment.apps) ? deployment.apps : [];

const games = projects
  .filter((project) => project?.type === 'game')
  .map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    repository: project.repo,
    sourceOfTruth: project.source_of_truth_doc,
    role: project.repo_role
  }))
  .sort((a, b) => text(a.name).localeCompare(text(b.name)));

const routes = apps
  .filter((app) => typeof app?.route === 'string' && app.route.startsWith('/games/'))
  .map((app) => ({
    id: app.id,
    title: app.title,
    route: app.route,
    status: app.status,
    runtime: app.runtime,
    repository: app.repository,
    sourcePath: app.sourcePath ?? null,
    build: app.build ?? null
  }))
  .sort((a, b) => text(a.route).localeCompare(text(b.route)));

const summary = {
  site: deployment.site,
  sourceOfTruth: deployment.sourceOfTruth,
  gameProjectCount: games.length,
  publicGameRouteCount: routes.length,
  locallyOwnedGameCount: games.filter((game) => game.repository === deployment.sourceOfTruth).length,
  projects: games,
  routes
};

if (requestedId) {
  const project = games.find((game) => game.id === requestedId) || null;
  const route = routes.find((item) => item.id === requestedId) || null;
  if (!project && !route) {
    console.error(`Unknown game id: ${requestedId}`);
    process.exit(1);
  }

  const detail = {
    id: requestedId,
    name: project?.name || route?.title || requestedId,
    canonicalRepository: project?.repository || route?.repository || null,
    sourceOfTruth: project?.sourceOfTruth || null,
    projectStatus: project?.status || null,
    publicRoute: route?.route || null,
    deploymentStatus: route?.status || null,
    runtime: route?.runtime || null,
    packagedSourcePath: route?.sourcePath || null,
    verificationCommand: route?.build || null,
    integrationRepository: deployment.sourceOfTruth,
    productionSite: deployment.site
  };

  if (asJson) {
    console.log(JSON.stringify(detail, null, 2));
    process.exit(0);
  }

  console.log(`# ${detail.name}`);
  console.log(`ID: ${detail.id}`);
  console.log(`Canonical repository: ${text(detail.canonicalRepository)}`);
  console.log(`Source-of-truth: ${text(detail.sourceOfTruth)}`);
  console.log(`Project status: ${text(detail.projectStatus)}`);
  console.log(`Public route: ${text(detail.publicRoute)}`);
  console.log(`Deployment status: ${text(detail.deploymentStatus)}`);
  console.log(`Runtime: ${text(detail.runtime)}`);
  console.log(`Packaged source path: ${text(detail.packagedSourcePath)}`);
  console.log(`Verification/build: ${text(detail.verificationCommand)}`);
  console.log('');
  if (detail.canonicalRepository === deployment.sourceOfTruth) {
    console.log('Edit the canonical local game/app source first; treat site/public-route-patch as the deployable runtime when applicable.');
  } else {
    console.log('Edit the standalone canonical repository first; update this integration repo only when the dtfseeds.com packaging contract changes.');
  }
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

console.log(`# DTFSeeds game workspace status`);
console.log(`Production: ${text(summary.site)}`);
console.log(`Integration repo: ${text(summary.sourceOfTruth)}`);
console.log(`Game projects: ${summary.gameProjectCount} (${summary.locallyOwnedGameCount} owned directly by the integration repo)`);
console.log(`dtfseeds.com game routes: ${summary.publicGameRouteCount}`);
console.log('');

console.log('Tip: use `npm run games:status -- --id <game-id>` before editing a specific game.');
console.log('');
console.log('## Canonical game ownership');
printTable(
  ['Game', 'ID', 'Status', 'Canonical repository', 'Source-of-truth'],
  games.map((game) => [game.name, game.id, game.status, game.repository, game.sourceOfTruth])
);
console.log('');

console.log('## dtfseeds.com game routes');
printTable(
  ['Route', 'Game', 'Status', 'Runtime', 'Repository', 'Source path'],
  routes.map((app) => [app.route, app.title, app.status, app.runtime, app.repository, app.sourcePath])
);
