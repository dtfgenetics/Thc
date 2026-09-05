#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

const config = JSON.parse(readFileSync(args.config || 'site/deployment/release-resources.json', 'utf8'));
const head = args.head || process.env.GITHUB_SHA || 'HEAD';
const requestedBase = args.base || '';
const requestedResource = args.resource || 'auto';
const gatewayManagedOnly = args['gateway-managed-only'] === 'true';

function gitText(commandArgs) {
  try {
    return execFileSync('git', commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function changedFiles(base) {
  if (base && !/^0+$/.test(base)) {
    return gitText(['diff', '--name-only', base, head]).split('\n').map((v) => v.trim()).filter(Boolean);
  }
  return gitText(['show', '--pretty=', '--name-only', head]).split('\n').map((v) => v.trim()).filter(Boolean);
}

function matchesResource(file, resource) {
  return resource.exactPaths.includes(file) || resource.sourcePrefixes.some((prefix) => file.startsWith(prefix));
}

function resolveCheckpoint(resource) {
  if (!resource.checkpointTag) return null;
  const sha = gitText(['rev-parse', '--verify', `refs/tags/${resource.checkpointTag}`]);
  if (!sha) return null;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, head], { stdio: 'ignore' });
    return sha;
  } catch {
    return null;
  }
}

const selected = [];
for (const [id, resource] of Object.entries(config.resources)) {
  if (requestedResource !== 'auto' && requestedResource !== 'all' && requestedResource !== id) continue;
  if (gatewayManagedOnly) {
    if (resource.publicSuiteOwnership !== 'resource') continue;
    if (resource.publisher?.orchestration !== 'gateway-managed') continue;
  }
  const checkpoint = gatewayManagedOnly ? resolveCheckpoint(resource) : null;
  const base = checkpoint || requestedBase;
  const files = changedFiles(base);
  const globalChange = files.some((file) => config.globalBuildPaths.includes(file));
  const affected = requestedResource === id || requestedResource === 'all' || globalChange || files.some((file) => matchesResource(file, resource));
  if (!affected) continue;
  selected.push({
    id,
    route: resource.route,
    artifactRoot: resource.artifactRoot,
    productionTarget: resource.productionTarget,
    checkpointTag: resource.checkpointTag,
    publisherWorkflow: resource.publisher?.workflow || null,
    publisherType: resource.publisher?.type || null,
    sharedProductionTarget: resource.publisher?.sharedProductionTarget || null,
    base: base || null,
    checkpoint: checkpoint || null,
    changedFiles: files.filter((file) => globalChange || matchesResource(file, resource))
  });
}

const matrix = { include: selected.map(({ changedFiles, ...resource }) => resource) };
const plan = {
  schemaVersion: config.schemaVersion,
  head,
  requestedBase: requestedBase || null,
  requestedResource,
  gatewayManagedOnly,
  deploy: selected.length > 0,
  resources: selected,
  matrix
};

console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${plan.deploy}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `plan=${JSON.stringify(plan)}\n`);
}
