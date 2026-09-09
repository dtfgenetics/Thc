import fs from 'node:fs';

// Archived legacy migration helper.
// This script targets the retired 15-level Seed Man public-surface contract.
// Do not wire this back into active CI, homepage generation, project pages, or production release flows.

const targets = [
  'site/wordpress/pages/home.html',
  'site/public-route-patch/projects/index.html'
];

const replacements = new Map([
  ['<strong>Seed Man: Sprout Run</strong></a> — original browser platformer vertical slice.', '<strong>Seed Man: Greenhouse Gauntlet</strong></a> — 15-level platform campaign across five worlds with phenotype powers and six bosses.'],
  ['<h3>Seed Man: Sprout Run</h3><p>Platforming vertical slice with hazards, collectibles, checkpoints and powerups.</p>', '<h3>Seed Man: Greenhouse Gauntlet</h3><p>Full 15-level platform campaign across five worlds with phenotype powers, six bosses, checkpoints, authored Seed Man animation and optimized Three.js world rendering.</p>']
]);

for (const path of targets) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) source = source.split(from).join(to);
  fs.writeFileSync(path, source);
}

const home = fs.readFileSync(targets[0], 'utf8');
const projects = fs.readFileSync(targets[1], 'utf8');

const must = (condition, message) => { if (!condition) throw new Error(message); };
must(home.includes('Seed Man: Greenhouse Gauntlet'), 'Homepage does not expose canonical Seed Man title.');
must(home.includes('15-level platform campaign across five worlds'), 'Homepage does not expose current Seed Man campaign scope.');
must(!home.includes('<strong>Seed Man: Sprout Run</strong>'), 'Homepage still exposes retired Seed Man product title.');
must(projects.includes('<h3>Seed Man: Greenhouse Gauntlet</h3>'), 'Projects page does not expose canonical Seed Man title.');
must(projects.includes('Full 15-level platform campaign across five worlds'), 'Projects page does not expose current Seed Man campaign scope.');
must(projects.includes('optimized Three.js world rendering'), 'Projects page does not expose current renderer scope.');
must(!projects.includes('<h3>Seed Man: Sprout Run</h3>'), 'Projects page still exposes retired Seed Man product title.');

console.log(JSON.stringify({
  ok: true,
  archived: true,
  surfaces: targets,
  title: 'Seed Man: Greenhouse Gauntlet',
  levels: 15,
  worlds: 5,
  bosses: 6
}, null, 2));
