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
if (!compat.includes('campaignTarget:20')) throw new Error('Seed Man compatibility bootstrap does not target 20 levels.');
if (!compat.includes('combat-browser-v2.js')) throw new Error('Seed Man compatibility bootstrap does not load combat v2.');
if (!compat.includes('enemy-attacks-browser-v2.js')) throw new Error('Seed Man compatibility bootstrap does not load enemy attacks v2.');

// Release IDs are owned by the canonical build/publish pipeline. This legacy
// helper no longer edits generated files or synchronizes retired v1 modules.
console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  requiredRuntime: REQUIRED,
  retiredRuntime: RETIRED,
  campaignTarget: 20,
  legacyMutationDisabled: true
}, null, 2));
