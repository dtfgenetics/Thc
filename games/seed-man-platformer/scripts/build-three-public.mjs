import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { build } from 'esbuild';

const projectRoot = resolve(import.meta.dirname, '..');
const entry = resolve(projectRoot, 'src/render/three-world-public-entry.mjs');
const outfile = resolve(projectRoot, process.env.SEED_MAN_THREE_OUTFILE || 'dist/three-world-v1.js');
const publicOutfile = resolve(projectRoot, '../../site/public-route-patch/games/seed-man-platformer/three-world-v1.js');

await mkdir(dirname(outfile), { recursive: true });
await mkdir(dirname(publicOutfile), { recursive: true });

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'eof',
  sourcemap: false,
  treeShaking: true,
  charset: 'utf8',
  banner: {
    js: '/* Seed Man Three.js world bundle v3 — generated from canonical source. Legacy renderer marker: seed-man-three-world-v1 */'
  }
});

const output = await readFile(outfile, 'utf8');
const metadata = await stat(outfile);

const requiredMarkers = [
  'SeedManThreeWorld',
  'seed-man-three-public-v3',
  'seed-man-three-public-v1',
  'seed-man-three-world-v2',
  'seed-man-three-world-v1',
  'seed-man-three-instancing-v1',
  'seed-man-visual-world-api-v1',
  'greenhouse-valley',
  'forest-ruins',
  'desert-canyon',
  'frozen-peaks',
  'eco-city'
];
for (const marker of requiredMarkers) {
  if (!output.includes(marker)) throw new Error(`Three.js public bundle missing marker: ${marker}`);
}

const executableOutput = output
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');

for (const pattern of [/from["']three["']/, /import\(["']three["']\)/, /require\(["']three["']\)/, /node_modules\/three/i]) {
  if (pattern.test(executableOutput)) throw new Error(`Three.js public bundle retains an external package dependency: ${pattern}`);
}

if (metadata.size < 250_000) throw new Error(`Three.js public bundle unexpectedly small: ${metadata.size} bytes`);
if (metadata.size > 900_000) throw new Error(`Three.js public bundle exceeds 900 KB budget: ${metadata.size} bytes`);

await copyFile(outfile, publicOutfile);
const publicMetadata = await stat(publicOutfile);
if (publicMetadata.size !== metadata.size) throw new Error('Seed Man public Three.js bundle copy size mismatch.');

console.log(JSON.stringify({
  version: 'seed-man-three-public-v3',
  legacyVersion: 'seed-man-three-public-v1',
  legacyRenderer: 'seed-man-three-world-v1',
  visualApi: 'seed-man-visual-world-api-v1',
  renderer: 'seed-man-three-world-v2',
  optimization: 'seed-man-three-instancing-v1',
  outfile,
  publicOutfile,
  bytes: metadata.size,
  selfContained: true,
  publicRouteSynchronized: true,
  legalCommentsPreserved: true,
  target: 'es2020'
}, null, 2));
