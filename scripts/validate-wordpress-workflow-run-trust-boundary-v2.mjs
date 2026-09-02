import { readFile } from 'node:fs/promises';

const paths = {
  stage: '.github/workflows/wordpress-canonical-deploy.yml',
  production: '.github/workflows/wordpress-canonical-production.yml',
  genetics: '.github/workflows/wordpress-genetics-library-production.yml',
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
));

function requireMatch(label, text, pattern) {
  if (!pattern.test(text)) {
    throw new Error(`${label} is missing required trust-boundary contract: ${pattern}`);
  }
}

function workflowRunBlock(text) {
  const match = text.match(/\n  workflow_run:\n([\s\S]*?)(?=\n\npermissions:|\n  [a-zA-Z_]+:)/);
  if (!match) throw new Error('workflow_run block not found');
  return match[0];
}

const stageRun = workflowRunBlock(source.stage);
const productionRun = workflowRunBlock(source.production);
const geneticsRun = workflowRunBlock(source.genetics);

// The privileged cascade must begin only from a trusted main-branch preflight.
requireMatch('canonical stage workflow_run', stageRun, /\n    branches: \[main\](?:\n|$)/);
requireMatch(
  'canonical stage job',
  source.stage,
  /\n  observe:\n    if: github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'\n/,
);

// Production must remain behind the stage owner and its protected environment.
if (!productionRun.includes('Stage DTFSeeds WordPress Canonical Deployment')) {
  throw new Error('Canonical production no longer listens to the trusted stage owner');
}
requireMatch('canonical production environment', source.production, /\n    environment: production\n/);
requireMatch(
  'canonical production success check',
  source.production,
  /Require successful trusted handoff[\s\S]*github\.event\.workflow_run\.conclusion[^\n]*success/,
);

// Genetics is a privileged recovery writer. Keep it on main and reject non-runs.
requireMatch('genetics workflow_run', geneticsRun, /\n    branches: \[main\](?:\n|$)/);
if (!geneticsRun.includes('Publish DTFSeeds WordPress Production')) {
  throw new Error('Genetics recovery no longer listens to canonical production');
}
requireMatch('genetics production environment', source.genetics, /\n    environment: production\n/);
requireMatch(
  'genetics recovery condition',
  source.genetics,
  /github\.event\.workflow_run\.conclusion != 'cancelled'.*github\.event\.workflow_run\.conclusion != 'skipped'/,
);

console.log(JSON.stringify({
  ok: true,
  rule: 'pull-request validation must not cascade into privileged WordPress or Genetics production',
  checked: Object.values(paths),
}, null, 2));
