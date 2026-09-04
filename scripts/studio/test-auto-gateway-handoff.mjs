#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const gateway = readFileSync('.github/workflows/dtfseeds-production-gateway.yml', 'utf8');
const integrator = readFileSync('scripts/studio/integrate-generated-change.mjs', 'utf8');
const planner = readFileSync('scripts/plan-dtfseeds-release.mjs', 'utf8');

function requireText(name, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${name} is missing required contract: ${needle}`);
  }
}

function forbidText(name, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${name} contains forbidden stale contract: ${needle}`);
  }
}

requireText('production gateway', gateway, '          - auto\n');
requireText('production gateway', gateway, "AUTO_RELEASE: ${{ github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.mode == 'auto') }}");
requireText('production gateway', gateway, 'if [[ "$AUTO_RELEASE" != \'true\' ]]; then');
requireText('production gateway', gateway, "inputs.mode == 'auto'");
requireText('production gateway', gateway, 'plan cumulatively from the last successful production checkpoint');
forbidText('production gateway', gateway, 'if [[ "${GITHUB_EVENT_NAME}" != "push" ]]; then');

requireText('generated integrator', integrator, "'workflow', 'run', 'dtfseeds-production-gateway.yml'");
requireText('generated integrator', integrator, "'-f', 'mode=auto'");
requireText('generated integrator', integrator, "args['dispatch-production'] !== 'false'");
requireText('generated integrator', integrator, 'sourceIntegrated: true');

requireText('release planner', planner, "if (mode !== 'auto' || !config.productionCheckpointTag) return null;");
requireText('release planner', planner, "const base = checkpoint?.sha || requestedBase;");
requireText('release planner', planner, "const deploy = Object.values(lanes).some(Boolean);");

console.log('automatic cumulative production handoff contract: PASS');
