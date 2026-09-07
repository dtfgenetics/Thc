import fs from 'node:fs';

const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';

for (const file of [publisherPath, combatPath, compatPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man combat release input: ${file}`);
}

let publisher = fs.readFileSync(publisherPath, 'utf8');
const combatEntry = "  'combat-browser-v1.js',";
if (!publisher.includes(combatEntry)) {
  const anchor = "  'gameplay-v2.js',\n  'input-guard-v1.js',";
  if (!publisher.includes(anchor)) throw new Error('Could not locate Seed Man publisher release-file anchor.');
  publisher = publisher.replace(anchor, `  'gameplay-v2.js',\n${combatEntry}\n  'input-guard-v1.js',`);
  fs.writeFileSync(publisherPath, publisher);
}

const combat = fs.readFileSync(combatPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');
for (const marker of [
  'seed-man-combat-browser-v1',
  'seed-man-phenotype-absorb-v1',
  'seed-man-phenotype-expansion-v1',
  'combat-static-mite',
  'PHENO ABSORBED',
  'terpene-tempest',
  'hydro-surge',
  'gravity-haze',
  'data-combat'
]) {
  if (!combat.includes(marker)) throw new Error(`Missing combat adapter marker: ${marker}`);
}
for (const marker of ['combatBrowserAutoLoad: true', 'combat-browser-v1.js']) {
  if (!compat.includes(marker)) throw new Error(`Missing combat autoload marker: ${marker}`);
}
if (!publisher.includes(combatEntry)) throw new Error('Combat adapter was not added to Seed Man publisher allowlist.');

console.log(JSON.stringify({
  ok: true,
  publisherPatched: true,
  combatFile: 'combat-browser-v1.js',
  phenotypeAbsorption: 'seed-man-phenotype-absorb-v1',
  phenotypeExpansion: 'seed-man-phenotype-expansion-v1',
  mobilityForms: ['terpene-tempest:flight', 'hydro-surge:bubble', 'gravity-haze:warp'],
  autoload: true
}, null, 2));
