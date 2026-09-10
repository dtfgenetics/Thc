import fs from 'node:fs';

const root = 'site/public-route-patch/games/seed-man-platformer';
const indexPath = `${root}/index.html`;
const compatPath = `${root}/canvas-compat-v1.js`;
const REQUIRED = [
  'campaign-v20-runtime.js',
  'campaign-ui-v20.js',
  'v20-enemy-runtime.js',
  'combat-browser-v2.js',
  'enemy-attacks-browser-v2.js',
  'approved-art-core-v1.js',
  'approved-art-runtime-v1.js',
  'seed-man-production-art.js',
  'three-world-v1.js',
  'three-world-adapter-v1.js',
  'input-guard-v1.js'
];
const RETIRED = [
  'campaign-v1.js',
  'gameplay-v2.js',
  'world-five-v1.js',
  'campaign-ui-v15.js',
  'combat-browser-v1.js',
  'enemy-attacks-browser-v1.js',
  'levels-12-15.json'
];

for (const file of [indexPath, compatPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man v20 release input: ${file}`);
}

const index = fs.readFileSync(indexPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');
for (const marker of REQUIRED) {
  if (!index.includes(marker)) throw new Error(`Seed Man v20 public index is missing runtime: ${marker}`);
}
for (const marker of RETIRED) {
  if (index.includes(marker)) throw new Error(`Retired Seed Man runtime remains in public index: ${marker}`);
}
if (!index.includes('20-Level Campaign')) throw new Error('Seed Man v20 campaign identity marker is missing.');
if (!index.includes('approved-showcase-2026-09-08')) throw new Error('Seed Man approved-art marker is missing.');
for (const marker of ['seed-man-runtime-health-v20','campaignTarget: 20','legacyDynamicLoader: false','legacyCanvasMonkeyPatch: false']) {
  if (!compat.includes(marker)) throw new Error(`Seed Man runtime health bridge missing marker: ${marker}`);
}
for (const stale of ['loadScript(', 'HTMLCanvasElement?.prototype', 'proto.getContext=', 'document.createElement(\'script\')']) {
  if (compat.includes(stale)) throw new Error(`Retired Seed Man dynamic bootstrap behavior remains: ${stale}`);
}

console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  requiredRuntime: REQUIRED,
  retiredRuntime: RETIRED,
  campaignTarget: 20,
  explicitThreeAdapter: true,
  legacyDynamicLoaderDisabled: true,
  legacyCanvasMonkeyPatchDisabled: true,
  legacyMutationDisabled: true
}, null, 2));
