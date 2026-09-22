import fs from 'node:fs';
import process from 'node:process';

const read = (path) => fs.readFileSync(path, 'utf8');
const density = read('scripts/lib/sitewide-content-density-v1.mjs');
const shell = read('scripts/lib/sitewide-header-template-v6.mjs');
const learnSource = [
  read('scripts/rebuild-wordpress-learning-experience-v3.mjs'),
  read('scripts/publish-learning-expanded-references-owner-aware.mjs'),
].join('\n');
const tools = read('site/public-route-patch/tools/index.html');
const games = read('site/public-route-patch/games/index.html');
const projects = read('site/public-route-patch/projects/index.html');

const failures = [];
const requireToken = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
};

for (const token of [
  'dtf-content-density-v1-style',
  'dtf-content-density-v1-script',
  'aria-expanded',
  'aria-controls',
  'body.hidden=true',
  'Show details',
  'Hide details',
  'min-height:44px',
  'prefers-reduced-motion:reduce',
  'dtf-disclosure__body[hidden]',
]) requireToken(density, token, 'density module');

requireToken(shell, "from './sitewide-content-density-v1.mjs'", 'V6 shell');
requireToken(shell, 'SITEWIDE_CONTENT_DENSITY_STYLE_TAG', 'V6 shell');
requireToken(shell, 'SITEWIDE_CONTENT_DENSITY_SCRIPT_TAG', 'V6 shell');

const expected = {
  '/learn/': ['expanded references', 'specialized subjects', 'choose the depth', 'plant-health reasoning'],
  '/tools/': ['connected workflow', 'measure before guessing', 'diagnose with context', 'teaching healthy cultivation'],
  '/games/': ['quick play & puzzles', 'longer strategy', 'new releases', 'live rooms', 'release candidates'],
  '/projects/': ['public game registry', 'multiplayer', 'development roadmap', 'supporting projects', 'release gate'],
};
for (const [route, labels] of Object.entries(expected)) {
  requireToken(density, `\"${route}\"`, 'density route config');
  for (const label of labels) requireToken(density, `\"${label}\"`, `${route} density config`);
}

const sourceChecks = [
  ['Learn', learnSource, ['Expanded references', 'Specialized subjects', 'Choose the depth', 'Plant-health reasoning']],
  ['Tools', tools, ['Connected workflow', 'Measure before guessing', 'Diagnose with context', 'Teaching Healthy Cultivation']],
  ['Games', games, ['Quick play & puzzles', 'Longer strategy', 'New releases', 'Live rooms', 'Release candidates']],
  ['Projects', projects, ['Public game registry', 'Multiplayer', 'Development roadmap', 'Supporting projects', 'Release gate']],
];
for (const [name, source, labels] of sourceChecks) {
  for (const label of labels) {
    if (!source.toLowerCase().includes(label.toLowerCase())) failures.push(`${name}: target section label missing from canonical source: ${label}`);
  }
}

if (!density.includes("if(!labels||!labels.length)return")) failures.push('density module must remain route-scoped');
if (!density.includes("if(!section||section.dataset.dtfDisclosure==='v1')return")) failures.push('density enhancement must remain idempotent');
if (!density.includes("if(location.hash)")) failures.push('density enhancement must preserve hash-target expansion');

if (failures.length) {
  console.error('Content-density V1 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  version: 'v1',
  routes: Object.keys(expected),
  disclosureSections: Object.values(expected).reduce((sum, labels) => sum + labels.length, 0),
  accessibility: ['aria-expanded', 'aria-controls', '44px target', 'reduced motion', 'no-JS content remains visible'],
}, null, 2));
