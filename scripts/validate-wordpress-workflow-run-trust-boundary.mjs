import { readFile } from 'node:fs/promises';

const files = {
  stage: '.github/workflows/wordpress-canonical-deploy.yml',
  production: '.github/workflows/wordpress-canonical-production.yml',
  genetics: '.github/workflows/wordpress-genetics-library-production.yml',
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
));

function requireMatch(label, text, pattern) {
  if (!pattern.test(text)) throw new Error(`${label} is missing required trust-boundary contract: ${pattern}`);
}

function workflowRunBlock(text) {
  const match = text.match(/\n  workflow_run:\n([\s\S]*?)(?=\n\npermissions:|\n  [a-zA-Z_]+:)/);
  if (!match) throw new Error('workflow_run block not found.');
  return match[0];
}

for (const [key, text] of Object.entries(source)) {
  const block = workflowRunBlock(text);
  requireMatch(`${key} workflow_run`, block, /\n    branches: \[main\](?:\n|$)/);
}

requireMatch(
  'canonical stage job',
  source.stage,
  /\n  observe:\n    if: github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'\n/,
);
requireMatch(
  'canonical production job',
  source.production,
  /\n  publish:\n    if: github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'\n/,
);
requireMatch('canonical production environment', source.production, /\n    environment: production\n/);
requireMatch('genetics production environment', source.genetics, /\n    environment: production\n/);
requireMatch(
  'genetics recovery condition',
  source.genetics,
  /github\.event\.workflow_run\.conclusion != 'cancelled'.*github\.event\.workflow_run\.conclusion != 'skipped'/,
);

if (!source.stage.includes('Reconcile DTFSeeds WordPress Canonical Pages')) {
  throw new Error('Canonical stage no longer listens to the canonical preflight owner.');
}
if (!source.production.includes('Stage DTFSeeds WordPress Canonical Deployment')) {
  throw new Error('Canonical production no longer listens to the trusted stage owner.');
}
if (!source.genetics.includes('Publish DTFSeeds WordPress Production')) {
  throw new Error('Genetics recovery no longer listens to canonical production.');
}

console.log(JSON.stringify({
  ok: true,
  rule: 'pull-request validation must not cascade into protected WordPress/Genetics production',
  checked: Object.values(files),
}, null, 2));
