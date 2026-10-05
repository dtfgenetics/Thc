import fs from 'node:fs';

const root = 'site/public-route-patch/games/seed-man-platformer';
const indexPath = `${root}/index.html`;
const compatPath = `${root}/canvas-compat-v1.js`;
const truthPath = `${root}/release-truth-v1.js`;
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
  'input-guard-v1.js',
  'release-truth-v1.js'
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

for (const file of [indexPath, compatPath, truthPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man v20 release input: ${file}`);
}

const index = fs.readFileSync(indexPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');
const truth = fs.readFileSync(truthPath, 'utf8');
for (const marker of REQUIRED) {
  if (!index.includes(marker)) throw new Error(`Seed Man v20 public index is missing runtime: ${marker}`);
}
for (const marker of RETIRED) {
  if (index.includes(marker)) throw new Error(`Retired Seed Man runtime remains in public index: ${marker}`);
}
for (const marker of ['20260913-v20-runtime-repair-v2','20-Level Campaign','AUTHORED WORLD ART']) {
  if (!index.includes(marker)) throw new Error(`Seed Man repaired release identity marker is missing: ${marker}`);
}
for (const stale of ['approved-showcase-2026-09-08','APPROVED ART · THREE.JS WORLDS','approved green-armored character art']) {
  if (index.includes(stale)) throw new Error(`Retired or misleading release label remains in public index: ${stale}`);
}
for (const marker of ['seed-man-runtime-health-v21','seed-man-authored-flat-background-v1','seed-man-runtime-mechanics-v1','legacyDynamicLoader: false','legacyCanvasMonkeyPatch: false']) {
  if (!compat.includes(marker)) throw new Error(`Seed Man runtime repair bridge missing marker: ${marker}`);
}
for (const marker of ['seed-man-release-truth-v1','classic-seed-man-oval-v1','AUTHORED WORLD ART']) {
  if (!truth.includes(marker)) throw new Error(`Seed Man release truth guard missing marker: ${marker}`);
}
for (const stale of ['loadScript(', 'HTMLCanvasElement?.prototype', 'proto.getContext=', 'document.createElement(\'script\')']) {
  if (compat.includes(stale)) throw new Error(`Retired Seed Man dynamic bootstrap behavior remains: ${stale}`);
}

console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  release: '20260913-v20-runtime-repair-v2',
  requiredRuntime: REQUIRED,
  retiredRuntime: RETIRED,
  campaignTarget: 20,
  characterTarget: 'classic-seed-man-oval-v1',
  characterCurrent: 'temporary-green-armored-replacement-pending',
  worldPresentation: 'authored-flat-transition',
  worldRendererTarget: 'seed-man-three-world-v2',
  explicitThreeAdapter: true,
  legacyDynamicLoaderDisabled: true,
  legacyCanvasMonkeyPatchDisabled: true,
  legacyMutationDisabled: true
}, null, 2));
