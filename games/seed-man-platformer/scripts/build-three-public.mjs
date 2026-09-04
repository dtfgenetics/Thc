import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { build } from 'esbuild';

const projectRoot = resolve(import.meta.dirname, '..');
const entry = resolve(projectRoot, 'src/render/three-world-public-entry.mjs');
const outfile = resolve(
  projectRoot,
  process.env.SEED_MAN_THREE_OUTFILE || 'dist/three-world-v1.js'
);

await mkdir(dirname(outfile), { recursive: true });

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
    js: '/* Seed Man Three.js world bundle v1 — generated from canonical source. */'
  }
});

const output = await readFile(outfile, 'utf8');
const metadata = await stat(outfile);

const requiredMarkers = [
  'SeedManThreeWorld',
  'seed-man-three-public-v1',
  'seed-man-three-world-v1'
];
for (const marker of requiredMarkers) {
  if (!output.includes(marker)) throw new Error(`Three.js public bundle missing marker: ${marker}`);
}

const forbiddenPatterns = [
  /https?:\/\//i,
  /from["']three["']/,
  /import\(["']three["']\)/,
  /node_modules\/three/i
];
for (const pattern of forbiddenPatterns) {
  if (pattern.test(output)) throw new Error(`Three.js public bundle is not self-contained: ${pattern}`);
}

if (metadata.size < 250_000) {
  throw new Error(`Three.js public bundle unexpectedly small: ${metadata.size} bytes`);
}
if (metadata.size > 900_000) {
  throw new Error(`Three.js public bundle exceeds 900 KB budget: ${metadata.size} bytes`);
}

console.log(JSON.stringify({
  version: 'seed-man-three-public-v1',
  outfile,
  bytes: metadata.size,
  selfContained: true,
  target: 'es2020'
}, null, 2));
