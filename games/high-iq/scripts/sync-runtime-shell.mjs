import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const manifestPath = resolve(root, 'games/high-iq/data/manifest.json');
const htmlPath = resolve(root, 'site/public-route-patch/games/high-iq/index.html');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let html = await readFile(htmlPath, 'utf8');

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
  .replace(/\b80 validated questions\b/g, `${manifest.questionCount} validated questions`)
  .replace(/\b80 approved questions\b/g, `${manifest.questionCount} approved questions`);

await writeFile(htmlPath, html, 'utf8');
console.log(`High IQ runtime shell synchronized to v${manifest.datasetVersion}: ${manifest.questionCount} questions / ${manifest.sourceCount} sources.`);
