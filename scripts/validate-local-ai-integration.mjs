import fs from 'node:fs';

const fail = (message) => {
  console.error(`local-ai integration validation failed: ${message}`);
  process.exitCode = 1;
};

const registry = JSON.parse(fs.readFileSync('configuration/ai/local-ai-providers.json', 'utf8'));
if (registry.schemaVersion !== 1) fail('registry schemaVersion must be 1');
for (const id of ['moondream', 'ultralytics-yolo', 'whisper', 'piper', 'qwen-local', 'gpt-oss-local', 'opencode', 'hermes-agent']) {
  if (!registry.providers.some((provider) => provider.id === id)) fail(`missing provider ${id}`);
}
if (registry.principles?.observationBeforeDiagnosis !== true) fail('observationBeforeDiagnosis must remain enabled');
if (registry.principles?.noAutomaticActuation !== true) fail('noAutomaticActuation must remain enabled');

const visual = fs.readFileSync('apps/growlens-web/src/aiObservation.ts', 'utf8');
for (const token of [
  "schema: 'growlens-visual-observation'",
  'diagnosticClaims: []',
  "reviewState: 'machine-observation'",
  'providerId',
  'modelId',
  'mediaRef',
]) {
  if (!visual.includes(token)) fail(`GrowLens visual observation contract missing ${token}`);
}

const routing = fs.readFileSync('.agents/skills/dtf-system-orchestrator/references/worker-routing.md', 'utf8');
for (const token of ['provider router', 'OpenCode', 'Hermes', 'Qwen', 'gpt-oss']) {
  if (!routing.toLowerCase().includes(token.toLowerCase())) fail(`worker routing missing local-AI control ${token}`);
}

if (!process.exitCode) console.log('Local AI integration contracts validated.');
