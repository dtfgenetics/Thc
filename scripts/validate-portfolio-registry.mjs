import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];

function loadJson(rel) {
  const full = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    errors.push(`${rel}: cannot parse/read (${error.message})`);
    return null;
  }
}

function requiredString(obj, key, label) {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    errors.push(`${label}: missing non-empty ${key}`);
  }
}

function optionalStringOrNull(obj, key, label) {
  const value = obj?.[key];
  if (value !== null && value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    errors.push(`${label}: ${key} must be a non-empty string or null`);
  }
}

function unique(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    const value = item?.[key];
    if (seen.has(value)) errors.push(`${label}: duplicate ${key} '${value}'`);
    seen.add(value);
  }
}

const projectsDoc = loadJson('data/project-registry.json');
const sitesDoc = loadJson('data/site-registry.json');
const assetsDoc = loadJson('data/asset-manifest.json');
const navigationDoc = loadJson('data/public-navigation.json');
const shellDoc = loadJson('data/site-navigation-v6.json');
const deploymentDoc = loadJson('site/deployment/public-apps.json');
const fleetArchiveDoc = loadJson('games/cannabis-fleet-battle/game.json');
loadJson('data/asset-manifest.schema.json');

if (!projectsDoc || !sitesDoc || !assetsDoc || !navigationDoc || !shellDoc || !deploymentDoc || !fleetArchiveDoc) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const projects = Array.isArray(projectsDoc.projects) ? projectsDoc.projects : [];
const sites = Array.isArray(sitesDoc.sites) ? sitesDoc.sites : [];
const assets = Array.isArray(assetsDoc.assets) ? assetsDoc.assets : [];
const allowedProjectStatuses = new Set(projectsDoc.allowed_statuses || []);
const allowedAssetStatuses = new Set([
  'draft', 'review', 'approved', 'release-candidate', 'released', 'superseded', 'quarantined'
]);

if (!projectsDoc.schema_version) errors.push('project-registry: missing schema_version');
if (!sitesDoc.schema_version) errors.push('site-registry: missing schema_version');
if (!assetsDoc.schema_version) errors.push('asset-manifest: missing schema_version');
if (!navigationDoc.schemaVersion) errors.push('public-navigation: missing schemaVersion');
if (!shellDoc.schemaVersion) errors.push('site-navigation-v6: missing schemaVersion');
if (!projects.length) errors.push('project-registry: projects is empty');

unique(projects, 'id', 'project-registry');
unique(sites, 'id', 'site-registry');
unique(assets, 'asset_id', 'asset-manifest');

const projectIds = new Set();
for (const project of projects) {
  const label = `project ${project?.id ?? '<unknown>'}`;
  for (const key of ['id', 'name', 'type', 'status', 'source_of_truth_doc']) {
    requiredString(project, key, label);
  }
  optionalStringOrNull(project, 'drive_path', label);
  optionalStringOrNull(project, 'library_path', label);
  optionalStringOrNull(project, 'release_path', label);
  optionalStringOrNull(project, 'repo', label);

  if (project?.id) projectIds.add(project.id);
  if (!allowedProjectStatuses.has(project?.status)) {
    errors.push(`${label}: invalid status '${project?.status}'`);
  }

  if (['canonical', 'canonical-preproduction', 'supporting', 'prototype'].includes(project?.status)) {
    requiredString(project, 'repo', label);
  }

  if (project?.status === 'drive-only') {
    requiredString(project, 'drive_path', label);
  }

  if (project?.status === 'placeholder' && project?.repo === null && project?.drive_path === null) {
    errors.push(`${label}: placeholder must have at least a repository or Drive control location`);
  }

  const doc = project?.source_of_truth_doc;
  if (typeof doc === 'string' && doc.startsWith('docs/')) {
    if (!fs.existsSync(path.join(root, doc))) errors.push(`${label}: local source-of-truth file missing: ${doc}`);
  }
}

for (const site of sites) {
  const label = `site ${site?.id ?? '<unknown>'}`;
  for (const key of ['id', 'name', 'url', 'status', 'repo', 'branch', 'build', 'deployment', 'drive_control', 'verification']) {
    requiredString(site, key, label);
  }
  try {
    const url = new URL(site.url);
    if (url.protocol !== 'https:') errors.push(`${label}: URL must use https`);
  } catch {
    errors.push(`${label}: invalid URL '${site?.url}'`);
  }
}

for (const asset of assets) {
  const label = `asset ${asset?.asset_id ?? '<unknown>'}`;
  for (const key of ['asset_id', 'project_id', 'name', 'asset_type', 'status', 'canonical_location', 'version']) {
    requiredString(asset, key, label);
  }
  if (!projectIds.has(asset?.project_id)) errors.push(`${label}: unknown project_id '${asset?.project_id}'`);
  if (!allowedAssetStatuses.has(asset?.status)) errors.push(`${label}: invalid status '${asset?.status}'`);
}

const siteRepos = new Set(sites.map((site) => site.repo));
for (const repo of siteRepos) {
  if (!projects.some((project) => project.repo === repo)) {
    warnings.push(`site-registry: repository '${repo}' has no project-registry owner`);
  }
}

const deploymentApps = Array.isArray(deploymentDoc.apps) ? deploymentDoc.apps : [];
const cannabisFleetProject = projects.find((project) => project.id === 'cannabis-fleet-battle');
const cannabisFleetDeployment = deploymentApps.find((app) => app.id === 'cannabis-fleet-battle');
const burnBudsDeployment = deploymentApps.find((app) => app.id === 'protect-the-plants');

if (cannabisFleetProject?.type !== 'archive-pointer' || cannabisFleetProject?.status !== 'archive-candidate') {
  errors.push('cannabis-fleet-battle: project registry must remain an archive-pointer/archive-candidate');
}
if (cannabisFleetDeployment?.status !== 'do-not-develop' || cannabisFleetDeployment?.runtime !== 'merged-archive-pointer') {
  errors.push('cannabis-fleet-battle: deployment registry must remain a do-not-develop merged archive pointer');
}
if (typeof cannabisFleetDeployment?.route === 'string' && cannabisFleetDeployment.route.trim()) {
  errors.push('cannabis-fleet-battle: archived scaffold must not own a public route');
}
if (cannabisFleetDeployment?.machineData?.canonicalGameId !== 'protect-the-plants' ||
    cannabisFleetDeployment?.machineData?.canonicalRoute !== '/games/protect-the-plants/' ||
    cannabisFleetDeployment?.machineData?.publicReleaseAllowed !== false) {
  errors.push('cannabis-fleet-battle: deployment pointer must target canonical Burn Buds and prohibit separate release');
}
if (burnBudsDeployment?.route !== '/games/protect-the-plants/' || burnBudsDeployment?.title !== 'Burn Buds') {
  errors.push('protect-the-plants: Burn Buds must remain the canonical public hidden-fleet game');
}

for (const candidateId of ['thc-u-know', 'kush-kings']) {
  const app = deploymentApps.find((entry) => entry.id === candidateId);
  const navGame = (navigationDoc.games || []).find((entry) => entry.id === candidateId);
  if (app?.status !== 'runtime-integration') {
    errors.push(`${candidateId}: full-stack candidate must remain runtime-integration until live promotion gates pass`);
  }
  if (navGame?.public !== false || navGame?.status !== 'development' || navGame?.route) {
    errors.push(`${candidateId}: unverified runtime candidate must not be counted as a public playable game`);
  }
  if (!navGame?.candidateRoute || navGame.candidateRoute !== app?.route) {
    errors.push(`${candidateId}: candidateRoute must match the deployment runtime route`);
  }
}
if (fleetArchiveDoc?.type !== 'archive-pointer' ||
    fleetArchiveDoc?.status !== 'archive-candidate' ||
    fleetArchiveDoc?.developmentPolicy !== 'do-not-develop-separately' ||
    fleetArchiveDoc?.canonicalGame?.id !== 'protect-the-plants' ||
    fleetArchiveDoc?.canonicalGame?.route !== '/games/protect-the-plants/' ||
    fleetArchiveDoc?.releaseGates?.separatePublicReleaseAllowed !== false) {
  errors.push('games/cannabis-fleet-battle/game.json: archive manifest must remain merged into Burn Buds');
}

const canonicalNavigation = [
  { id: 'home', label: 'Home', route: '/' },
  { id: 'seeds', label: 'Seeds', route: '/seeds/' },
  { id: 'learn', label: 'Learn', route: '/learn/' },
  { id: 'courses', label: 'Courses', route: '/courses/' },
  { id: 'diagnostic', label: 'Diagnostic', route: '/tools/' },
  { id: 'games', label: 'Games', route: '/games/' },
  { id: 'community', label: 'Community', route: '/community/' },
  { id: 'shop', label: 'Shop', route: '/shop/' }
];
const siteNavigation = shellDoc.primaryNavigation;

if (shellDoc.status !== 'canonical') {
  errors.push('site-navigation-v6: status must be canonical');
}
if (shellDoc.brandHome?.route !== '/') {
  errors.push('site-navigation-v6: brandHome must own /');
}
if (!Array.isArray(siteNavigation)) {
  errors.push('site-navigation-v6: primaryNavigation must be an array');
}

if (Array.isArray(siteNavigation)) {
  if (siteNavigation.length !== canonicalNavigation.length) {
    errors.push(`site-navigation-v6: canonical primary navigation must contain exactly ${canonicalNavigation.length} items`);
  } else {
    for (let index = 0; index < canonicalNavigation.length; index += 1) {
      const expected = canonicalNavigation[index];
      const actual = siteNavigation[index];
      for (const key of ['id', 'label', 'route']) {
        if (actual?.[key] !== expected[key]) {
          errors.push(`site-navigation-v6: primary navigation item ${index + 1} ${key} must be '${expected[key]}'`);
        }
      }
    }
  }
}

const labels = Array.isArray(siteNavigation) ? siteNavigation.map((item) => item.label) : [];
for (const required of canonicalNavigation.map((item) => item.label)) {
  if (!labels.includes(required)) errors.push(`site-navigation-v6: required primary label '${required}' is missing`);
}
for (const obsolete of ['Genetics', 'Tools']) {
  if (labels.includes(obsolete)) errors.push(`site-navigation-v6: retired primary label '${obsolete}' is not allowed`);
}
if (!shellDoc.sectionOwnership?.courses?.includes('/courses/')) errors.push('site-navigation-v6: Courses must own /courses/');
if (!shellDoc.sectionOwnership?.courses?.includes('/learn/learning-hub/')) errors.push('site-navigation-v6: Courses must own historical Learning Hub course URLs');
if (!shellDoc.sectionOwnership?.diagnostic?.includes('/growlens/')) errors.push('site-navigation-v6: Diagnostic must own GrowLens');
if (!shellDoc.sectionOwnership?.diagnostic?.includes('/thc-grow-doc/')) errors.push('site-navigation-v6: Diagnostic must own THC Grow Doc');

// The visitor-facing public-navigation registry and the V6 shell registry are both
// authoritative for the primary row and must remain byte-for-byte equivalent in
// id, label, route, and order. site-registry retains a legacy embedded copy.
const legacySiteNav = sitesDoc.information_architecture?.canonical_primary_navigation;
if (Array.isArray(legacySiteNav) && legacySiteNav.length) {
  warnings.push('site-registry: embedded canonical_primary_navigation is legacy; public-navigation + site-navigation-v6 are authoritative');
}
if (JSON.stringify(navigationDoc.primaryNavigation) !== JSON.stringify(siteNavigation)) {
  errors.push('public-navigation: primaryNavigation must exactly match site-navigation-v6 primaryNavigation');
}

if (warnings.length) {
  console.warn(`Portfolio registry warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`Portfolio registry validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Portfolio registry OK: ${projects.length} projects, ${sites.length} sites, ${assets.length} manifest assets, ${canonicalNavigation.length} canonical V6 site roots.`);
