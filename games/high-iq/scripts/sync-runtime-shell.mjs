import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const manifestPath = resolve(root, 'games/high-iq/data/manifest.json');
const htmlPath = resolve(root, 'site/public-route-patch/games/high-iq/index.html');
const checkOnly = process.argv.includes('--check');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const original = await readFile(htmlPath, 'utf8');
let html = original;
const categoryCount = Object.keys(manifest.categoryCounts || {}).length;

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`High IQ shell sync could not find ${label}`);
  html = html.replace(pattern, replacement);
}

replaceRequired(
  /(<meta name="description" content="[^"]*?with )\d+( approved questions)/,
  `$1${manifest.questionCount}$2`,
  'meta-description question count'
);
replaceRequired(
  /(<strong id="hero-question-count">)[^<]+(<\/strong>)/,
  `$1${manifest.questionCount}$2`,
  'hero question count'
);
replaceRequired(
  /(<strong id="hero-category-count">)[^<]+(<\/strong>)/,
  `$1${categoryCount}$2`,
  'hero category count'
);
replaceRequired(
  /(<strong id="hero-source-count">)[^<]+(<\/strong>)/,
  `$1${manifest.sourceCount}$2`,
  'hero source count'
);
replaceRequired(
  /(<strong id="hero-version">)[^<]+(<\/strong>)/,
  `$1${manifest.datasetVersion}$2`,
  'hero dataset version'
);

html = html
  .replace(/The v\d+\.\d+ bank is machine-validated/g, `The v${manifest.datasetVersion} bank is machine-validated`)
  .replace(/\b\d+ validated questions\b/g, `${manifest.questionCount} validated questions`)
  .replace(/\b\d+ approved questions\b/g, `${manifest.questionCount} approved questions`);

const v33Stylesheet = '  <link rel="stylesheet" href="./high-iq-v3-3.css" />';
if (!html.includes('high-iq-v3-3.css')) {
  replaceRequired(
    /  <link rel="stylesheet" href="\.\/high-iq-v3\.css" \/>/,
    `  <link rel="stylesheet" href="./high-iq-v3.css" />\n${v33Stylesheet}`,
    'High IQ v3 stylesheet link'
  );
}

if (checkOnly) {
  if (html !== original) {
    throw new Error('High IQ runtime shell is stale. Run: node games/high-iq/scripts/sync-runtime-shell.mjs');
  }
  console.log(`High IQ runtime shell matches v${manifest.datasetVersion}: ${manifest.questionCount} questions / ${categoryCount} topics / ${manifest.sourceCount} sources.`);
} else {
  if (html !== original) await writeFile(htmlPath, html, 'utf8');
  console.log(`High IQ runtime shell synchronized to v${manifest.datasetVersion}: ${manifest.questionCount} questions / ${categoryCount} topics / ${manifest.sourceCount} sources.`);
}
