import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrowserBundle } from './build-browser-bundle.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..', '..');
const dataRoot = path.join(projectRoot, 'data');
const publicRoot = path.join(repoRoot, 'site', 'public-route-patch', 'games', 'strain-showdown');
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, 'roster-manifest.json'), 'utf8'));
const canonicalCards = manifest.files
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(dataRoot, file), 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id));
const publicCards = manifest.files
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(publicRoot, 'data', file), 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id));
const canonicalFamilies = JSON.parse(fs.readFileSync(path.join(dataRoot, 'families.json'), 'utf8'));
const publicFamilies = JSON.parse(fs.readFileSync(path.join(publicRoot, 'data', 'families.json'), 'utf8'));

if (JSON.stringify(canonicalCards) !== JSON.stringify(publicCards)) {
  throw new Error('Public Strain Showdown roster data is not synchronized with the canonical 96-card roster.');
}
if (JSON.stringify(canonicalFamilies) !== JSON.stringify(publicFamilies)) {
  throw new Error('Public Strain Showdown family data is not synchronized with canonical families.json.');
}

const { target, bundle } = buildBrowserBundle();
const generated = JSON.parse(fs.readFileSync(target, 'utf8'));
const bundledCards = [...generated.cards].sort((a, b) => a.id.localeCompare(b.id));
if (generated.schemaVersion !== 1 || generated.rosterVersion !== manifest.rosterVersion) {
  throw new Error('Generated Strain Showdown browser bundle metadata is invalid.');
}
if (generated.cardCount !== 96 || generated.familyCount !== 8 || generated.cards.length !== 96 || generated.families.length !== 8) {
  throw new Error('Generated Strain Showdown browser bundle is incomplete.');
}
if (JSON.stringify(bundledCards) !== JSON.stringify(canonicalCards)) {
  throw new Error('Generated Strain Showdown browser bundle cards drifted from the canonical roster.');
}
if (JSON.stringify(generated.families) !== JSON.stringify(canonicalFamilies)) {
  throw new Error('Generated Strain Showdown browser bundle family metadata drifted from canonical data.');
}
if (bundle.cards.length !== generated.cards.length || bundle.families.length !== generated.families.length) {
  throw new Error('Generated Strain Showdown browser bundle write verification failed.');
}

for (const file of ['index.html', 'app.js', 'engine.mjs', 'styles.css', 'runtime-v2.css', 'runtime-v3.css']) {
  const full = path.join(publicRoot, file);
  if (!fs.existsSync(full) || fs.statSync(full).size === 0) throw new Error(`Missing public runtime file: ${file}`);
}
const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(publicRoot, 'app.js'), 'utf8');
const runtimeV2 = fs.readFileSync(path.join(publicRoot, 'runtime-v2.css'), 'utf8');
const runtimeV3 = fs.readFileSync(path.join(publicRoot, 'runtime-v3.css'), 'utf8');
if (!html.includes('https://dtfseeds.com/games/strain-showdown/')) throw new Error('Canonical production URL missing from index.html');
if (!html.includes('type="module" src="./app.js"')) throw new Error('Browser module entrypoint missing from index.html');
if (!html.includes('./runtime-v2.css') || !html.includes('./runtime-v3.css')) throw new Error('Responsive Strain Showdown runtime layers must be loaded.');
if (!app.includes('./data/browser-bundle.json')) throw new Error('Browser runtime must prefer the generated canonical roster bundle.');
if (!app.includes('loadLegacyData')) throw new Error('Browser runtime must retain a development fallback when the generated bundle is absent.');

// runtime-v2 historically used a 680px mobile battlefield. runtime-v3 is
// intentionally loaded after it and must override that behavior so all three
// tactical lanes are visible together when a player chooses a play/evolution
// target on a phone.
if (!runtimeV2.includes('.lane-grid{min-width:680px')) throw new Error('Expected legacy mobile lane width contract changed; re-audit the override.');
if (!runtimeV3.includes('.lane-grid{min-width:0!important;grid-template-columns:repeat(3,minmax(0,1fr))')) {
  throw new Error('Mobile Strain Showdown must keep all three tactical lanes visible together.');
}
if (!runtimeV3.includes('.arena{overflow-x:hidden}')) throw new Error('Mobile battlefield must not require horizontal scrolling for lane selection.');
if (!runtimeV3.includes('.lane .attack-button{min-height:44px')) throw new Error('Mobile lane attack actions must retain a 44px touch target.');

console.log(`Strain Showdown public browser data is synchronized; generated ${path.relative(repoRoot, target)}; three-lane mobile battlefield contract verified.`);