import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('configuration/ai/local-ai-providers.json', 'utf8'));
const byId = new Map(registry.providers.map((provider) => [provider.id, provider]));

const capability = process.argv[2] || 'code';
const routes = {
  code: { runtime: 'opencode', model: 'qwen-local' },
  reasoning: { runtime: 'hermes-agent', model: 'gpt-oss-local' },
  'structured-extraction': { runtime: 'hermes-agent', model: 'qwen-local' },
};

const selected = routes[capability];
if (!selected) {
  console.error(`Unknown local AI capability: ${capability}`);
  process.exit(2);
}

for (const id of [selected.runtime, selected.model]) {
  if (!byId.has(id)) {
    console.error(`Local AI provider registry is missing ${id}`);
    process.exit(1);
  }
}

const plan = {
  capability,
  controlPlane: 'project-os',
  runtime: byId.get(selected.runtime),
  model: byId.get(selected.model),
  mandatoryGates: [
    'canonical-repository-ownership',
    'managed-job-and-branch',
    'verification-profile',
    'pull-request',
    'release-controller-if-production',
    'live-qa-if-production',
  ],
  productionAuthority: false,
};

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
} else {
  console.log(`Local AI worker plan: ${capability}`);
  console.log(`runtime: ${plan.runtime.id}`);
  console.log(`model: ${plan.model.id}`);
  console.log('control plane: Project OS');
  console.log('production authority: no');
}
