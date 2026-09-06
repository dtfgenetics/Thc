import fs from 'node:fs';

const paths = {
  stage: '.github/workflows/wordpress-canonical-deploy.yml',
  production: '.github/workflows/wordpress-canonical-production.yml',
  genetics: '.github/workflows/wordpress-genetics-library-production.yml',
};

const source = Object.fromEntries(
  Object.entries(paths).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]),
);

function fail(message) {
  throw new Error(message);
}

function requireText(label, text, value) {
  if (!text.includes(value)) fail(`${label} is missing required trust-boundary marker: ${value}`);
}

function eventBlock(text) {
  const match = text.match(/^on:\n([\s\S]*?)(?=\npermissions:)/m);
  if (!match) fail('workflow event block not found');
  return match[1];
}

function workflowRunBlock(text) {
  const match = text.match(/\n  workflow_run:\n([\s\S]*?)(?=\n\npermissions:|\n  [a-zA-Z_]+:)/);
  if (!match) fail('workflow_run block not found');
  return match[0];
}

const stageEvents = eventBlock(source.stage);
if (/^\s{2}pull_request:/m.test(stageEvents)) {
  fail('Canonical WordPress staging must never run from pull_request events');
}
if (/^\s{2}workflow_run:/m.test(stageEvents)) {
  fail('Canonical WordPress staging must not be reintroduced as a workflow_run cascade');
}
requireText('canonical stage', stageEvents, 'push:\n    branches: [main]');
requireText('canonical stage checkout', source.stage, 'ref: main');

const productionRun = workflowRunBlock(source.production);
requireText('canonical production handoff', productionRun, '- Stage DTFSeeds WordPress Canonical Deployment');
requireText('canonical production environment', source.production, '    environment: production');
requireText('canonical production checkout', source.production, '          ref: main');
requireText('canonical production success guard', source.production, "[[ \"${{ github.event.workflow_run.conclusion }}\" == \"success\" ]]");

const geneticsRun = workflowRunBlock(source.genetics);
requireText('genetics recovery handoff', geneticsRun, '- Publish DTFSeeds WordPress Production');
requireText('genetics production environment', source.genetics, '    environment: production');
requireText('genetics checkout', source.genetics, '          ref: main');
requireText('genetics cancellation guard', source.genetics, "github.event.workflow_run.conclusion != 'cancelled'");

for (const [label, text] of [
  ['canonical production', source.production],
  ['genetics production', source.genetics],
]) {
  const events = eventBlock(text);
  if (/^\s{2}pull_request:/m.test(events)) {
    fail(`${label} must never expose a pull_request production trigger`);
  }
}

console.log(JSON.stringify({
  ok: true,
  rule: 'pull-request validation cannot enter the privileged WordPress production cascade',
  topology: [
    'main/manual -> Stage DTFSeeds WordPress Canonical Deployment',
    'successful stage -> Publish DTFSeeds WordPress Production',
    'completed production -> Publish DTF Genetics Library recovery owner',
  ],
  checked: Object.values(paths),
}, null, 2));
