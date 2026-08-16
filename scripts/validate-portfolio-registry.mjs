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
loadJson('data/asset-manifest.schema.json');

if (!projectsDoc || !sitesDoc || !assetsDoc) {
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
if (!projects.length) errors.push('project-registry: projects is empty');

unique(projects, 'id', 'project-registry');
unique(sites, 'id', 'site-registry');
unique(assets, 'asset_id', 'asset-manifest');

const projectIds = new Set();
for (const project of projects) {
  const label = `project ${project?.id ?? '<unknown>'}`;
  for (const key of ['id', 'name', 'type', 'status', 'drive_path', 'source_of_truth_doc']) {
    requiredString(project, key, label);
  }
  if (project?.id) projectIds.add(project.id);
  if (!allowedProjectStatuses.has(project?.status)) {
    errors.push(`${label}: invalid status '${project?.status}'`);
  }
  if (['canonical', 'canonical-preproduction', 'supporting', 'prototype'].includes(project?.status) && project?.repo === null) {
    errors.push(`${label}: ${project.status} project must identify a repository`);
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

if (warnings.length) {
  console.warn(`Portfolio registry warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`Portfolio registry validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Portfolio registry OK: ${projects.length} projects, ${sites.length} sites, ${assets.length} manifest assets.`);
