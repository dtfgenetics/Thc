import fs from 'node:fs';

const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const runtimePath = 'site/public-route-patch/games/seed-man-platformer/seed-man-sprite-runtime-v1.js';
const atlasPath = 'site/public-route-patch/games/seed-man-platformer/assets/seed-man/seed-man-atlas-v1.svg';
const VERSION = 'seed-man-authored-atlas-v1';

for (const file of [indexPath, publisherPath, runtimePath, atlasPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man authored sprite release input: ${file}`);
}

const runtime = fs.readFileSync(runtimePath, 'utf8');
for (const marker of ['seed-man-sprite-runtime-v1', VERSION, 'drawAtlasFrame', '__SPROUT_SPRITE_RUNTIME__', 'rendererOwner']) {
  if (!runtime.includes(marker)) throw new Error(`Seed Man sprite runtime missing marker: ${marker}`);
}
const atlas = fs.readFileSync(atlasPath, 'utf8');
for (const marker of ['<svg', 'width="1536"', 'height="512"', 'Fire form', 'Electric form', 'Ice form']) {
  if (!atlas.includes(marker)) throw new Error(`Seed Man authored atlas missing marker: ${marker}`);
}

let index = fs.readFileSync(indexPath, 'utf8');
const release = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!release) throw new Error('Could not resolve Seed Man release marker for sprite runtime.');
const spriteScript = `  <script src="./seed-man-sprite-runtime-v1.js?v=${release}" defer></script>`;
if (!index.includes(spriteScript)) {
  const artScriptPattern = new RegExp(`(^\\s*<script src="\\./seed-man-production-art\\.js\\?v=${release.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}" defer><\\/script>\\s*$)`, 'm');
  const match = index.match(artScriptPattern);
  if (!match) throw new Error('Could not locate Seed Man production-art script anchor for sprite runtime.');
  index = index.replace(match[1], `${match[1]}\n${spriteScript}`);
  fs.writeFileSync(indexPath, index);
}

let publisher = fs.readFileSync(publisherPath, 'utf8');
const releaseEntries = [
  "  'seed-man-sprite-runtime-v1.js',",
  "  'assets/seed-man/seed-man-atlas-v1.svg',"
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
if (!index.includes(spriteScript)) throw new Error('Seed Man index is missing authored sprite runtime script.');
for (const entry of releaseEntries) if (!publisher.includes(entry)) throw new Error(`Seed Man publisher is missing authored sprite file: ${entry}`);

console.log(JSON.stringify({
  ok: true,
  spriteRuntime: 'seed-man-sprite-runtime-v1',
  atlas: VERSION,
  release,
  publishedFiles: ['seed-man-sprite-runtime-v1.js', 'assets/seed-man/seed-man-atlas-v1.svg']
}, null, 2));
