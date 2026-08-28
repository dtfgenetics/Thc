#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

const configPath = args.config || 'site/deployment/release-lanes.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const mode = args.mode || process.env.RELEASE_MODE || 'auto';
const head = args.head || process.env.GITHUB_SHA || 'HEAD';
const base = args.base || process.env.RELEASE_BASE || '';

function changedFiles() {
  if (mode === 'full') return ['<manual-full-release>'];
  try {
    if (base && !/^0+$/.test(base)) {
      return execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' })
        .split('\n').map((line) => line.trim()).filter(Boolean);
    }
    return execFileSync('git', ['show', '--pretty=', '--name-only', head], { encoding: 'utf8' })
      .split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    console.error(`Unable to calculate release diff: ${error.message}`);
    process.exit(2);
  }
}

function matches(path, rule) {
  return rule.prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

const files = changedFiles();
const forceFull = mode === 'full' || files.some((file) => config.fullReleasePaths.includes(file));
const lanes = {};
for (const [name, rule] of Object.entries(config.lanes)) {
  lanes[name] = forceFull || mode === name || files.some((file) => matches(file, rule));
}

// Approved education assets can affect both the learning pages and WordPress media shell.
if (files.some((file) => file.startsWith('site/wordpress/assets/infographics/'))) {
  lanes.wordpress = true;
  lanes.education = true;
}

// The public Learn infographic library is WordPress-owned content even though its source package lives under the public-route tree.
if (files.some((file) => file.startsWith('site/public-route-patch/learn/infographics/'))) {
  lanes.wordpress = true;
  lanes.education = true;
}

// Other public-route education files remain WordPress-owned and must never be deployed by the game/static worker.
if (files.some((file) => file.startsWith('site/public-route-patch/learn/'))) {
  lanes.education = true;
}

const deploy = Object.values(lanes).some(Boolean);
const plan = {
  schemaVersion: config.schemaVersion,
  site: config.site,
  mode,
  base: base || null,
  head,
  forceFull,
  deploy,
  lanes,
  changedFiles: files
};

const compact = JSON.stringify(plan);
console.log(JSON.stringify(plan, null, 2));

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `public_suite=${lanes.publicSuite}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `wordpress=${lanes.wordpress}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `education=${lanes.education}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `plan=${compact}\n`);
}
