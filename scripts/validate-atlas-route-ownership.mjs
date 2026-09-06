import assert from 'node:assert/strict';
import fs from 'node:fs';

const navigation = JSON.parse(fs.readFileSync('data/public-navigation.json', 'utf8'));
const ownership = fs.readFileSync('docs/ATLAS_ROUTE_OWNERSHIP.md', 'utf8');
const v4 = fs.readFileSync('site/public-route-patch/atlas/index.html', 'utf8');
const learningVerifier = fs.readFileSync('scripts/verify-dtf420-atlas-live.mjs', 'utf8');
const suiteWorkflow = fs.readFileSync('.github/workflows/deploy-public-suite-wordpress-v2.yml', 'utf8');

const learnSections = navigation.learn?.sections ?? [];
const threeD = learnSections.find((entry) => entry.route === '/atlas/');
const library = learnSections.find((entry) => entry.route === '/learn/atlas/');

assert.ok(threeD, 'Learn navigation must expose /atlas/');
assert.match(threeD.label, /3D Plant Atlas/i, '/atlas/ must be labeled as the 3D Plant Atlas');
assert.ok(library, 'Learn navigation must expose /learn/atlas/');
assert.match(library.label, /Atlas Learning Library/i, '/learn/atlas/ must be labeled as the Atlas Learning Library');

const utilityAtlas = navigation.utilityNavigation.find((entry) => entry.id === 'atlas');
assert.equal(utilityAtlas?.route, '/atlas/', 'utility Atlas navigation must point to /atlas/');
assert.match(utilityAtlas?.label ?? '', /3D Plant Atlas/i, 'utility Atlas label must distinguish the 3D explorer');

const toolAtlas = navigation.tools.find((entry) => entry.id === 'atlas');
assert.equal(toolAtlas?.route, '/atlas/', 'public Atlas tool must point to /atlas/');
assert.match(toolAtlas?.title ?? '', /3D Explorer/i, 'public Atlas tool title must identify the 3D explorer');

assert.match(v4, /<link rel="canonical" href="https:\/\/dtfseeds\.com\/atlas\/"/i, 'V4 Atlas must keep /atlas/ canonical metadata');
assert.ok(suiteWorkflow.includes('https://dtfseeds.com/atlas/'), 'Public Suite must verify /atlas/ after deployment');
assert.ok(learningVerifier.includes("['/learn/atlas/', 'THC Living Plant Atlas']"), 'Learning Atlas verifier must continue checking /learn/atlas/');

for (const marker of [
  '`/atlas/` — 3D Plant Atlas',
  '`/learn/atlas/` — Atlas Learning Library',
  'Do not redirect or delete either surface',
]) {
  assert.ok(ownership.includes(marker), `Atlas ownership document is missing: ${marker}`);
}

console.log('Atlas route ownership verified: /atlas/ is the V4 3D explorer and /learn/atlas/ remains the lesson library.');
