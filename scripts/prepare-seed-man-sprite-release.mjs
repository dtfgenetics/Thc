import fs from 'node:fs';

const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const legacyRuntimePath = 'site/public-route-patch/games/seed-man-platformer/seed-man-sprite-runtime-v1.js';
const legacyAtlasPath = 'site/public-route-patch/games/seed-man-platformer/assets/seed-man/seed-man-atlas-v1.svg';
const runtimePath = 'site/public-route-patch/games/seed-man-platformer/seed-man-sprite-runtime-v2.js';
const atlasPath = 'site/public-route-patch/games/seed-man-platformer/assets/seed-man/seed-man-atlas-v2.svg';
const LEGACY_VERSION = 'seed-man-authored-atlas-v1';
const VERSION = 'seed-man-authored-atlas-v2';
const VISUAL_ENHANCEMENT = 'seed-man-sprite-motion-phenotype-v3';
const APPROVED_REFERENCE = '2026-09-08-approved-showcase-sheet';
const APPROVED_VISUAL = 'approved-showcase-green-hero-v1';

for (const file of [indexPath, publisherPath, legacyRuntimePath, legacyAtlasPath, runtimePath, atlasPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man authored sprite release input: ${file}`);
}

const legacyRuntime = fs.readFileSync(legacyRuntimePath, 'utf8');
for (const marker of ['seed-man-sprite-runtime-v1', LEGACY_VERSION, 'drawAtlasFrame', '__SPROUT_SPRITE_RUNTIME__', 'rendererOwner']) {
  if (!legacyRuntime.includes(marker)) throw new Error(`Seed Man legacy sprite runtime missing marker: ${marker}`);
}
const legacyAtlas = fs.readFileSync(legacyAtlasPath, 'utf8');
for (const marker of ['<svg', 'width="1536"', 'height="512"', 'Fire form', 'Electric form', 'Ice form']) {
  if (!legacyAtlas.includes(marker)) throw new Error(`Seed Man legacy authored atlas missing marker: ${marker}`);
}

const runtime = fs.readFileSync(runtimePath, 'utf8');
for (const marker of [
  'seed-man-sprite-runtime-v2',
  VERSION,
  VISUAL_ENHANCEMENT,
  APPROVED_REFERENCE,
  APPROVED_VISUAL,
  'runC',
  'runD',
  'attackB',
  'activePhenotype',
  'drawElementalVfx',
  'drawPhenotypeLayer',
  'seedManSpriteVisual',
  'rendererOwner',
  '__SPROUT_SPRITE_RUNTIME_V2__',
  'window.drawSeedMan=renderer',
  'orange forehead gem',
  'brown exposed upper arms',
  'white/green armored boots'
]) {
  if (!runtime.includes(marker)) throw new Error(`Seed Man approved showcase runtime missing marker: ${marker}`);
}
if (/if\s*\(phenotype\)\s*return\s+phenotype/.test(runtime)) {
  throw new Error('Seed Man phenotype rendering must not replace movement/attack pose animation.');
}
if (!runtime.includes('drawPhenotypeLayer') || !runtime.includes('drawElementalVfx')) {
  throw new Error('Seed Man phenotype visuals must render as effects around the approved movement pose.');
}
for (const phenotype of ["'solar-flare'", "'static-haze'", "'frost-resin'"]) {
  if (!runtime.includes(phenotype)) throw new Error(`Seed Man approved runtime missing phenotype: ${phenotype}`);
}

const atlas = fs.readFileSync(atlasPath, 'utf8');
for (const marker of ['<svg', 'width="1024"', 'height="1024"', 'row 1: idleA idleB runA runB', 'row 4: victory fire electric ice']) {
  if (!atlas.includes(marker)) throw new Error(`Seed Man authored atlas v2 missing compatibility marker: ${marker}`);
}

let index = fs.readFileSync(indexPath, 'utf8');
const release = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!release) throw new Error('Could not resolve Seed Man release marker for sprite runtime.');
const legacyScript = `  <script src="./seed-man-sprite-runtime-v1.js?v=${release}" defer></script>`;
const spriteScript = `  <script src="./seed-man-sprite-runtime-v2.js?v=${release}" defer></script>`;
const artScriptPattern = new RegExp(`(^\\s*<script src="\\./seed-man-production-art\\.js\\?v=${release.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}" defer><\\/script>\\s*$)`, 'm');
const match = index.match(artScriptPattern);
if (!match && (!index.includes(legacyScript) || !index.includes(spriteScript))) throw new Error('Could not locate Seed Man production-art script anchor for sprite runtimes.');
if (match) {
  const scripts = [legacyScript, spriteScript].filter((script) => !index.includes(script));
  if (scripts.length) {
    index = index.replace(match[1], `${match[1]}\n${scripts.join('\n')}`);
    fs.writeFileSync(indexPath, index);
  }
}

let publisher = fs.readFileSync(publisherPath, 'utf8');
const releaseEntries = [
  "  'seed-man-sprite-runtime-v1.js',",
  "  'assets/seed-man/seed-man-atlas-v1.svg',",
  "  'seed-man-sprite-runtime-v2.js',",
  "  'assets/seed-man/seed-man-atlas-v2.svg',"
];
const publisherAnchor = "  'seed-man-production-art.js',";
if (!publisher.includes(publisherAnchor)) throw new Error('Could not locate Seed Man publisher sprite anchor.');
const missingEntries = releaseEntries.filter((entry) => !publisher.includes(entry));
if (missingEntries.length) {
  publisher = publisher.replace(publisherAnchor, `${publisherAnchor}\n${missingEntries.join('\n')}`);
  fs.writeFileSync(publisherPath, publisher);
}

index = fs.readFileSync(indexPath, 'utf8');
publisher = fs.readFileSync(publisherPath, 'utf8');
if (!index.includes(legacyScript)) throw new Error('Seed Man index is missing legacy authored sprite runtime script.');
if (!index.includes(spriteScript)) throw new Error('Seed Man index is missing approved sprite runtime v2 script.');
if (index.indexOf(spriteScript) < index.indexOf(legacyScript)) throw new Error('Seed Man approved runtime v2 must load after legacy v1 so the approved showcase renderer owns rendering.');
for (const entry of releaseEntries) if (!publisher.includes(entry)) throw new Error(`Seed Man publisher is missing authored sprite file: ${entry}`);

console.log(JSON.stringify({
  ok: true,
  visualSourceOfTruth: APPROVED_REFERENCE,
  approvedVisual: APPROVED_VISUAL,
  legacySpriteRuntime: 'seed-man-sprite-runtime-v1',
  legacyAtlas: LEGACY_VERSION,
  spriteRuntime: 'seed-man-sprite-runtime-v2',
  visualEnhancement: VISUAL_ENHANCEMENT,
  phenotypeMotionPreserved: true,
  compatibilityAtlas: VERSION,
  release,
  publishedFiles: ['seed-man-sprite-runtime-v1.js', 'assets/seed-man/seed-man-atlas-v1.svg', 'seed-man-sprite-runtime-v2.js', 'assets/seed-man/seed-man-atlas-v2.svg']
}, null, 2));
