import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const datasetManifestPath = path.join(root, 'games/high-iq/data/manifest.json');
const iconRoot = path.join(root, 'site/public-route-patch/games/high-iq/assets/domains');
const iconManifestPath = path.join(iconRoot, 'manifest.json');

const fail = (message) => {
  console.error(`High IQ domain icon validation failed: ${message}`);
  process.exitCode = 1;
};

for (const required of [datasetManifestPath, iconManifestPath]) {
  if (!fs.existsSync(required)) fail(`missing ${path.relative(root, required)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const dataset = JSON.parse(fs.readFileSync(datasetManifestPath, 'utf8'));
const icons = JSON.parse(fs.readFileSync(iconManifestPath, 'utf8'));

if (icons.schemaVersion !== 1) fail('icon manifest schemaVersion must be 1');
if (icons.id !== 'high-iq-domain-icons-v1') fail(`unexpected icon manifest id ${icons.id}`);
if (icons.datasetVersion !== dataset.datasetVersion) fail(`dataset version mismatch ${icons.datasetVersion} != ${dataset.datasetVersion}`);
if (icons.status !== 'runtime-ready') fail(`icon manifest status must be runtime-ready, found ${icons.status}`);

const expectedCategories = Object.keys(dataset.categoryCounts || {});
const actualCategories = Object.keys(icons.categories || {});
if (expectedCategories.length !== 10) fail(`expected 10 dataset categories, found ${expectedCategories.length}`);
if (actualCategories.length !== 10) fail(`expected 10 icon categories, found ${actualCategories.length}`);

for (const category of expectedCategories) {
  const entry = icons.categories?.[category];
  if (!entry) {
    fail(`missing icon mapping for ${category}`);
    continue;
  }
  if (!entry.file || /[\\/]/.test(entry.file)) fail(`${category} file must be a basename`);
  if (!/^[a-f0-9]{64}$/.test(entry.sha256 || '')) fail(`${category} is missing a valid sha256`);
  const filePath = path.join(iconRoot, entry.file || '');
  if (!fs.existsSync(filePath)) {
    fail(`${category} references missing ${entry.file}`);
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== entry.sha256) fail(`${category} SHA mismatch ${hash} != ${entry.sha256}`);
  const svg = bytes.toString('utf8');
  if (!svg.includes('<svg') || !svg.includes('viewBox="0 0 64 64"')) fail(`${category} is not a 64x64 SVG master`);
  if (!svg.includes('<title>') || !svg.includes('<desc>')) fail(`${category} lacks accessible title/description metadata`);
  if (/<text\b/i.test(svg)) fail(`${category} contains baked display text`);
  if (/watermark/i.test(svg)) fail(`${category} contains a watermark marker`);
}

for (const category of actualCategories) {
  if (!Object.hasOwn(dataset.categoryCounts || {}, category)) fail(`icon manifest contains noncanonical category ${category}`);
}

if (!process.exitCode) {
  console.log(`High IQ domain icons valid: ${actualCategories.length} canonical categories, dataset v${dataset.datasetVersion}.`);
}
