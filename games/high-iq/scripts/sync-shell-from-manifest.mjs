import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const manifestPath = resolve(root, 'games/high-iq/data/manifest.json');
const htmlPath = resolve(root, 'site/public-route-patch/games/high-iq/index.html');
const checkOnly = process.argv.includes('--check');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let html = await readFile(htmlPath, 'utf8');

const expected = {
  questions: String(manifest.questionCount),
  categories: String(Object.keys(manifest.categoryCounts || {}).length),
  sources: String(manifest.sourceCount),
  version: String(manifest.datasetVersion)
};

function replaceIdText(source, id, value) {
  const pattern = new RegExp(`(<[^>]+id=["']${id}["'][^>]*>)([^<]*)(<\\/)`);
  if (!pattern.test(source)) throw new Error(`High IQ shell is missing #${id}`);
  return source.replace(pattern, `$1${value}$3`);
}

function replaceMetaDescription(source) {
  const pattern = /(<meta\s+name=["']description["']\s+content=["'][^"']*?with\s+)(\d+)(\s+approved questions[^"']*["']\s*\/?>)/i;
  if (!pattern.test(source)) throw new Error('High IQ shell description does not expose an approved-question count');
  return source.replace(pattern, `$1${expected.questions}$3`);
}

let next = html;
next = replaceMetaDescription(next);
next = replaceIdText(next, 'hero-question-count', expected.questions);
next = replaceIdText(next, 'hero-category-count', expected.categories);
next = replaceIdText(next, 'hero-source-count', expected.sources);
next = replaceIdText(next, 'hero-version', expected.version);

if (checkOnly) {
  if (next !== html) {
    throw new Error(`High IQ shell is stale. Run: node games/high-iq/scripts/sync-shell-from-manifest.mjs`);
  }
  console.log(`High IQ shell matches manifest v${expected.version}: ${expected.questions} questions, ${expected.categories} topics, ${expected.sources} sources.`);
} else {
  if (next !== html) await writeFile(htmlPath, next, 'utf8');
  console.log(`High IQ shell synchronized to manifest v${expected.version}: ${expected.questions} questions, ${expected.categories} topics, ${expected.sources} sources.`);
}
