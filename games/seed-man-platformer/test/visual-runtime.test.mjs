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
import { resolveVisualWorldKey } from '../src/render/visual-world-map.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../data/visual-runtime-v1.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

assert.equal(validateVisualRuntime(config), config);
assert.equal(VISUAL_RUNTIME_CONTRACT.locked, false);
assert.equal(VISUAL_RUNTIME_CONTRACT.characterContract, null);
assert.equal(config.reference.styleLocked, false);

const greenhouse = getWorldVisual(config, 'greenhouse-valley');
assert.equal(greenhouse.label, 'Greenhouse Valley');
assert.ok(Array.isArray(greenhouse.layers));

const plan = buildParallaxPlan(config, 'greenhouse-valley');
assert.ok(plan.length > 0);
assert.equal(plan.find((layer) => layer.key === 'gameplay').parallax, 1);

assert.equal(getPhenotypeVisual(config, 'plant').durationMs, 0);
assert.equal(resolveVisualWorldKey({ visualWorldKey: 'frozen-peak' }), 'frozen-peaks');
assert.equal(getWorldVisual(config, 'frozen-peak').label, 'Frozen Peaks');

const alternate = {
  version: 'another-renderer',
  worlds: {
    'new-world': { label: 'New World', layers: ['gameplay'] }
  },
  player: {
    phenotypes: {
      custom: { durationMs: 1250 }
    }
  },
  assetPolicy: {
    locked: false,
    allowRawFilenameReferences: true,
    rendererOwnsGameplayState: true
  }
};
assert.equal(validateVisualRuntime(alternate), alternate);
assert.equal(getWorldVisual(alternate, 'new-world').label, 'New World');
assert.equal(getPhenotypeVisual(alternate, 'custom').durationMs, 1250);

assert.throws(() => validateVisualRuntime(null), /config must be an object/);
console.log('seed-man open visual runtime contract: ok');
