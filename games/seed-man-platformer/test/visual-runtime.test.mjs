import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VISUAL_RUNTIME_CONTRACT,
  buildParallaxPlan,
  getPhenotypeVisual,
  getWorldVisual,
  validateVisualRuntime
} from '../src/render/visual-runtime.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../data/visual-runtime-v1.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

validateVisualRuntime(config);

assert.deepEqual(Object.keys(config.worlds).sort(), [...VISUAL_RUNTIME_CONTRACT.requiredWorlds].sort());
assert.deepEqual(Object.keys(config.player.phenotypes).sort(), [...VISUAL_RUNTIME_CONTRACT.requiredPhenotypes].sort());

const greenhouse = getWorldVisual(config, 'greenhouse-valley');
assert.equal(greenhouse.label, 'Greenhouse Valley');
assert.ok(greenhouse.materials.includes('grass'));
assert.ok(greenhouse.requiredFx.includes('water-mist'));

const plan = buildParallaxPlan(config, 'greenhouse-valley');
assert.equal(plan.length, 7);
assert.equal(plan.find((layer) => layer.key === 'gameplay').parallax, 1);
assert.ok(plan.find((layer) => layer.key === 'far-bg').parallax < plan.find((layer) => layer.key === 'mid-bg').parallax);
assert.ok(plan.find((layer) => layer.key === 'mid-bg').parallax < plan.find((layer) => layer.key === 'near-bg').parallax);

for (const phenotypeKey of ['fire', 'electric', 'ice']) {
  assert.equal(getPhenotypeVisual(config, phenotypeKey).durationMs, 30000);
}
assert.equal(getPhenotypeVisual(config, 'plant').durationMs, 0);

const invalid = structuredClone(config);
invalid.assetPolicy.allowRawFilenameReferences = true;
assert.throws(() => validateVisualRuntime(invalid), /raw filename references are forbidden/);

console.log('seed-man visual runtime contract: ok');
