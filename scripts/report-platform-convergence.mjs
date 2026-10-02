#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const checkMode = args.has('--check');
const liveMode = args.has('--live');
const strictLive = args.has('--strict-live');
const baseArg = process.argv.find((arg) => arg.startsWith('--base-url='));
const baseUrl = (baseArg ? baseArg.slice('--base-url='.length) : process.env.DTF_PUBLIC_ORIGIN || 'https://dtfseeds.com').replace(/\/$/, '');
const timeoutMs = Number(process.env.DTF_CONVERGENCE_TIMEOUT_MS || 12000);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values)];
}

function textTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
}

function canonicalHref(html) {
  const match = html.match(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  return match?.[1] || null;
}

function h1Count(html) {
  return (html.match(/<h1\b/gi) || []).length;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'DTFSeeds-platform-convergence-audit/1.0',
        'cache-control': 'no-cache, no-store, max-age=0'
      }
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, finalUrl: response.url, body };
  } catch (error) {
    return { ok: false, status: null, finalUrl: url, body: '', error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

const repoRegistry = readJson('data/repository-registry.json');
const publicApps = readJson('site/deployment/public-apps.json');
const repositories = repoRegistry.repositories || [];
const apps = publicApps.apps || [];
const repoByName = new Map(repositories.map((repo) => [repo.repo, repo]));
const errors = [];
const warnings = [];

const canonicalOwners = repositories.filter((repo) => repo.status === 'canonical' || repo.status === 'standalone_canonical');
const migrationRepos = new Set(repositories.filter((repo) => repo.status === 'migration').map((repo) => repo.repo));
const archiveReady = repositories.filter((repo) => repo.status === 'archive_ready').map((repo) => repo.repo);

const routeCounts = new Map();
const idCounts = new Map();
const NON_PUBLIC_STATUSES = new Set([
  'do-not-develop',
  'private-operations-only',
  'implementation-alpha'
]);

function isPublicSurface(app) {
  if (app.publicSurface === false) return false;
  if (app.publicSurface === true) return true;
  if (NON_PUBLIC_STATUSES.has(app.status)) return false;
  return Boolean(app.route);
}

for (const app of apps) {
  const publicSurface = isPublicSurface(app);
  if (publicSurface && app.route) routeCounts.set(app.route, (routeCounts.get(app.route) || 0) + 1);
  idCounts.set(app.id, (idCounts.get(app.id) || 0) + 1);

  if (!app.id) errors.push('public app is missing id');
  if (!app.title) errors.push(`${app.id || '(unknown)'} is missing title`);
  if (publicSurface && (!app.route || !/^\/.+\/$/.test(app.route))) errors.push(`${app.id || '(unknown)'} has invalid route ${app.route || '(missing)'}`);
  if (!app.repository) errors.push(`${app.id || '(unknown)'} is missing repository`);
  if (!app.runtime) warnings.push(`${app.id || '(unknown)'} is missing runtime classification`);
  if (!app.status) errors.push(`${app.id || '(unknown)'} is missing release status`);
  if (publicSurface && !app.build) errors.push(`${app.id || '(unknown)'} is missing deterministic build/verification command`);

  const externalRepository = Boolean(app.repository && app.repository !== 'dtfgenetics/Thc');
  if (publicSurface && !externalRepository && !app.sourcePath) {
    errors.push(`${app.id || '(unknown)'} is missing sourcePath`);
  }
  if (publicSurface && externalRepository && !app.mirrorPath && !app.sourcePath) {
    errors.push(`${app.id || '(unknown)'} is missing integration mirror/sourcePath`);
  }

  if (app.repository && !repoByName.has(app.repository)) {
    warnings.push(`${app.id}: repository ${app.repository} is absent from repository-registry.json`);
  }
  if (publicSurface && app.repository && migrationRepos.has(app.repository)) {
    errors.push(`${app.id}: public route is owned by migration repository ${app.repository}`);
  }
  if (app.canonicalRepository && migrationRepos.has(app.canonicalRepository)) {
    errors.push(`${app.id}: canonicalRepository points to migration repository ${app.canonicalRepository}`);
  }
  if (app.canonicalRepository && !repoByName.has(app.canonicalRepository)) {
    warnings.push(`${app.id}: canonicalRepository ${app.canonicalRepository} is absent from repository-registry.json`);
  }
  if (app.integrationRepository && app.integrationRepository !== 'dtfgenetics/Thc') {
    warnings.push(`${app.id}: integrationRepository is ${app.integrationRepository}, expected dtfgenetics/Thc for DTFSeeds public-suite integration`);
  }
  if (app.sourcePath && !externalRepository && !fs.existsSync(path.join(ROOT, app.sourcePath))) {
    errors.push(`${app.id}: sourcePath does not exist: ${app.sourcePath}`);
  }
  if (app.mirrorPath && !fs.existsSync(path.join(ROOT, app.mirrorPath))) {
    errors.push(`${app.id}: mirrorPath does not exist: ${app.mirrorPath}`);
  }
}

for (const [route, count] of routeCounts) if (count > 1) errors.push(`duplicate public route ${route} appears ${count} times`);
for (const [id, count] of idCounts) if (count > 1) errors.push(`duplicate public app id ${id} appears ${count} times`);

const statusCounts = Object.fromEntries(
  [...apps.reduce((map, app) => map.set(app.status || 'missing', (map.get(app.status || 'missing') || 0) + 1), new Map())]
    .sort(([a], [b]) => a.localeCompare(b))
);

const sourceHead = gitHead();
let live = null;

if (liveMode) {
  const buildUrl = `${baseUrl}/dtf-build.json?audit=${Date.now()}`;
  const buildResponse = await fetchText(buildUrl);
  let buildManifest = null;
  if (buildResponse.ok) {
    try {
      buildManifest = JSON.parse(buildResponse.body);
    } catch {
      warnings.push('live dtf-build.json is not valid JSON');
    }
  } else {
    warnings.push(`live dtf-build.json unavailable: ${buildResponse.status || buildResponse.error || 'unknown error'}`);
  }

  const rows = [];
  const concurrency = Math.max(1, Number(process.env.DTF_CONVERGENCE_CONCURRENCY || 6));
  let cursor = 0;
  async function worker() {
    while (cursor < apps.length) {
      const index = cursor++;
      const app = apps[index];
      const result = await fetchText(`${baseUrl}${app.route}?audit=${Date.now()}-${index}`);
      const html = result.body || '';
      const row = {
        id: app.id,
        route: app.route,
        status: result.status,
        ok: result.ok,
        finalUrl: result.finalUrl,
        title: /<html\b/i.test(html) ? textTag(html, 'title') : null,
        h1Count: /<html\b/i.test(html) ? h1Count(html) : null,
        h1: /<html\b/i.test(html) ? textTag(html, 'h1') : null,
        canonical: /<html\b/i.test(html) ? canonicalHref(html) : null,
        error: result.error || null
      };
      rows[index] = row;

      if (!row.ok) warnings.push(`live ${app.route} returned ${row.status || row.error || 'unknown failure'}`);
      if (row.ok && row.h1Count === 0) warnings.push(`live ${app.route} has no H1`);
      if (row.ok && row.h1Count > 1) warnings.push(`live ${app.route} has ${row.h1Count} H1 elements`);
      if (row.ok && !row.title) warnings.push(`live ${app.route} has no document title`);
      if (row.ok && !row.canonical) warnings.push(`live ${app.route} has no canonical link`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, apps.length)) }, () => worker()));

  const deployedMaster = buildManifest?.master || null;
  const sourceMatchesDeployment = Boolean(sourceHead && deployedMaster && sourceHead === deployedMaster);
  if (strictLive && sourceHead && deployedMaster && !sourceMatchesDeployment) {
    errors.push(`live master revision ${deployedMaster} does not match source HEAD ${sourceHead}`);
  }

  live = {
    baseUrl,
    buildUrl,
    buildStatus: buildResponse.status,
    buildManifest,
    deployedMaster,
    sourceMatchesDeployment,
    routes: rows
  };
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    repository: 'dtfgenetics/Thc',
    head: sourceHead
  },
  registry: {
    authority: repoRegistry.authority || null,
    repositoryCount: repositories.length,
    canonicalOwnerCount: canonicalOwners.length,
    migrationRepositories: [...migrationRepos].sort(),
    archiveReadyRepositories: archiveReady.sort()
  },
  publicApps: {
    count: apps.length,
    statuses: statusCounts,
    repositories: unique(apps.map((app) => app.repository).filter(Boolean)).sort(),
    routes: apps.filter(isPublicSurface).map((app) => ({
      id: app.id,
      title: app.title,
      route: app.route,
      repository: app.repository,
      canonicalRepository: app.canonicalRepository || app.repository || null,
      status: app.status,
      runtime: app.runtime || null
    }))
  },
  live,
  errors: unique(errors),
  warnings: unique(warnings),
  ok: errors.length === 0 && (!strictLive || !live || live.routes.every((row) => row.ok))
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('# DTF platform convergence report');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Source HEAD: ${sourceHead || 'unavailable'}`);
  console.log(`Repository registry: ${repositories.length} repositories; ${canonicalOwners.length} canonical/standalone owners`);
  console.log(`Public apps: ${apps.length}`);
  console.log(`Statuses: ${Object.entries(statusCounts).map(([status, count]) => `${status}=${count}`).join(', ') || 'none'}`);
  console.log(`Migration repos: ${[...migrationRepos].join(', ') || 'none'}`);
  console.log(`Archive-ready repos: ${archiveReady.join(', ') || 'none'}`);
  if (live) {
    console.log(`Live origin: ${baseUrl}`);
    console.log(`Live build SHA: ${live.deployedMaster || 'unavailable'}`);
    console.log(`Source/live SHA match: ${live.sourceMatchesDeployment ? 'yes' : 'no/unknown'}`);
    const good = live.routes.filter((row) => row.ok).length;
    console.log(`Live routes responding: ${good}/${live.routes.length}`);
  }
  if (errors.length) {
    console.log('\nErrors:');
    for (const error of unique(errors)) console.log(`- ${error}`);
  }
  if (warnings.length) {
    console.log('\nWarnings:');
    for (const warning of unique(warnings)) console.log(`- ${warning}`);
  }
  if (!errors.length && !warnings.length) console.log('\nNo convergence defects detected by this report.');
}

if (checkMode && errors.length) process.exitCode = 1;
if (strictLive && live && live.routes.some((row) => !row.ok)) process.exitCode = 1;
