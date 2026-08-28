import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const runtime = resolve(root, 'site/public-route-patch/games/high-iq');
const html = await readFile(resolve(runtime, 'index.html'), 'utf8');
const app = await readFile(resolve(runtime, 'app-v3.js'), 'utf8');
const core = await readFile(resolve(runtime, 'game-core.mjs'), 'utf8');
const css = await readFile(resolve(runtime, 'high-iq-v3.css'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(runtime, 'data/manifest.json'), 'utf8'));

assert.match(html, /<script type="module" src="\.\/app-v3\.js"><\/script>/);
assert.match(html, /<link rel="stylesheet" href="\.\/high-iq-v3\.css"/);
assert.match(app, /from '\.\/game-core\.mjs'/);
assert.match(app, /High IQ v3 runtime initialized/);
assert.match(app, /balancedSample/);
assert.match(app, /startDaily/);
assert.match(app, /practiceMissedQuestions/);
assert.match(app, /navigator\.share/);
assert.match(app, /localStorage/);
assert.match(core, /export function balancedSample/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);

const idSelectors = [...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((match) => match[1]);
assert(idSelectors.length >= 35, `Expected a substantial High IQ UI contract, found only ${idSelectors.length} ID selectors.`);
for (const id of idSelectors) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`id=["']${escaped}["']`).test(html), `app-v3.js expects #${id}, but index.html does not provide it`);
}

for (const requiredId of [
  'daily-hero-start','daily-start','question-mode','live-accuracy','question-id',
  'result-accuracy','result-streak','result-best','missed-review','practice-missed',
  'share-score','history-list','clear-history','difficulty-map','source-map','data-error-detail'
]) {
  assert(html.includes(`id="${requiredId}"`), `Missing v3 surface: #${requiredId}`);
}

assert.equal(manifest.datasetVersion, '2.2');
assert.equal(manifest.questionCount, 80);
assert.equal(manifest.sourceCount, 50);
assert.equal(manifest.questionChunks.length, 8);
assert.equal(manifest.sourceChunks.length, 2);

let questionCount = 0;
for (const chunk of manifest.questionChunks) {
  const rows = JSON.parse(await readFile(resolve(runtime, 'data', chunk), 'utf8'));
  assert(Array.isArray(rows), `${chunk} must contain an array`);
  questionCount += rows.length;
}
let sourceCount = 0;
for (const chunk of manifest.sourceChunks) {
  const rows = JSON.parse(await readFile(resolve(runtime, 'data', chunk), 'utf8'));
  assert(Array.isArray(rows), `${chunk} must contain an array`);
  sourceCount += rows.length;
}
assert.equal(questionCount, manifest.questionCount);
assert.equal(sourceCount, manifest.sourceCount);

console.log(JSON.stringify({
  ok: true,
  runtime: 'High IQ v3',
  uiContractIds: idSelectors.length,
  questions: questionCount,
  sources: sourceCount,
  datasetVersion: manifest.datasetVersion
}, null, 2));
