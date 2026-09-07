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
    js: '/* Seed Man Three.js world bundle v2 — generated from canonical source. */'
  }
});

const output = await readFile(outfile, 'utf8');
const metadata = await stat(outfile);

const requiredMarkers = [
  'SeedManThreeWorld',
  'seed-man-three-public-v2',
  'seed-man-three-world-v2'
];
for (const marker of requiredMarkers) {
  if (!output.includes(marker)) throw new Error(`Three.js public bundle missing marker: ${marker}`);
}

// "Self-contained" means the browser artifact has no surviving module/runtime
// dependency on the Three.js package. Three.js legitimately contains URL strings
// in library code and license metadata, so URL presence alone is not evidence of
// an external dependency. Esbuild performs the actual dependency bundling.
const executableOutput = output
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');

const forbiddenPatterns = [
  /from["']three["']/,
  /import\(["']three["']\)/,
  /require\(["']three["']\)/,
  /node_modules\/three/i
];
for (const pattern of forbiddenPatterns) {
  if (pattern.test(executableOutput)) throw new Error(`Three.js public bundle retains an external package dependency: ${pattern}`);
}

if (metadata.size < 250_000) {
  throw new Error(`Three.js public bundle unexpectedly small: ${metadata.size} bytes`);
}
if (metadata.size > 900_000) {
  throw new Error(`Three.js public bundle exceeds 900 KB budget: ${metadata.size} bytes`);
}

console.log(JSON.stringify({
  version: 'seed-man-three-public-v2',
  renderer: 'seed-man-three-world-v2',
  outfile,
  bytes: metadata.size,
  selfContained: true,
  legalCommentsPreserved: true,
  target: 'es2020'
}, null, 2));
