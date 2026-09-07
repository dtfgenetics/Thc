import fs from 'node:fs';

const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const canonicalEnemyAttackModulePath = 'games/seed-man-platformer/src/systems/enemy-attacks.mjs';
const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
const enemyAttackBrowserPath = 'site/public-route-patch/games/seed-man-platformer/enemy-attacks-browser-v1.js';
const enemyAttackModulePath = 'site/public-route-patch/games/seed-man-platformer/enemy-attacks.js';

for (const file of [publisherPath, canonicalEnemyAttackModulePath, combatPath, compatPath, enemyAttackBrowserPath, enemyAttackModulePath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man combat release input: ${file}`);
}

let publisher = fs.readFileSync(publisherPath, 'utf8');
const releaseEntries = [
  "  'combat-browser-v1.js',",
  "  'enemy-attacks-browser-v1.js',",
  "  'enemy-attacks.js',"
];
const anchor = "  'gameplay-v2.js',\n  'input-guard-v1.js',";
if (!publisher.includes(anchor) && releaseEntries.some((entry) => !publisher.includes(entry))) {
  throw new Error('Could not locate Seed Man publisher release-file anchor.');
}
if (publisher.includes(anchor)) {
  const missing = releaseEntries.filter((entry) => !publisher.includes(entry));
  if (missing.length) {
    publisher = publisher.replace(anchor, `  'gameplay-v2.js',\n${missing.join('\n')}\n  'input-guard-v1.js',`);
    fs.writeFileSync(publisherPath, publisher);
  }
}

const canonicalEnemyAttackModule = fs.readFileSync(canonicalEnemyAttackModulePath, 'utf8');
const combat = fs.readFileSync(combatPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');
const enemyAttackBrowser = fs.readFileSync(enemyAttackBrowserPath, 'utf8');
const enemyAttackModule = fs.readFileSync(enemyAttackModulePath, 'utf8');
if (enemyAttackModule !== canonicalEnemyAttackModule) {
  throw new Error('Browser-safe enemy-attacks.js must exactly mirror the canonical enemy-attacks.mjs source.');
}
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
for (const marker of [
  'combatBrowserAutoLoad: true',
  'combat-browser-v1.js',
  'seed-man-phenotype-mobility-frame-v1',
  'mobilityFrameRepairInstalled',
  'enemyAttackBrowserAutoLoad: true',
  'enemy-attacks-browser-v1.js'
]) {
  if (!compat.includes(marker)) throw new Error(`Missing combat compatibility marker: ${marker}`);
}
for (const marker of [
  'seed-man-enemy-attacks-browser-v1',
  "import('./enemy-attacks.js')",
  'radial-burst',
  'blink-strike',
  'ground-wave',
  'hitsTaken'
]) {
  if (!enemyAttackBrowser.includes(marker)) throw new Error(`Missing enemy attack browser marker: ${marker}`);
}
for (const marker of ['ATTACK_PATTERNS', 'stepEnemyAttack', 'advanceEnemyProjectile', 'resolveEnemyContact']) {
  if (!enemyAttackModule.includes(marker)) throw new Error(`Missing enemy attack module marker: ${marker}`);
}
for (const entry of releaseEntries) {
  if (!publisher.includes(entry)) throw new Error(`Seed Man publisher allowlist is missing: ${entry}`);
}

console.log(JSON.stringify({
  ok: true,
  publisherPatched: true,
  combatFile: 'combat-browser-v1.js',
  enemyAttackBrowserFile: 'enemy-attacks-browser-v1.js',
  enemyAttackModuleFile: 'enemy-attacks.js',
  canonicalEnemyAttackModuleFile: 'enemy-attacks.mjs',
  phenotypeAbsorption: 'seed-man-phenotype-absorb-v1',
  phenotypeExpansion: 'seed-man-phenotype-expansion-v1',
  phenotypeMobilityFrameRepair: 'seed-man-phenotype-mobility-frame-v1',
  mobilityForms: ['terpene-tempest:flight', 'hydro-surge:bubble', 'gravity-haze:warp'],
  enemyAttackPatterns: ['aimed-shot', 'burst-shot', 'radial-burst', 'dive-charge', 'ground-wave', 'blink-strike'],
  autoload: true
}, null, 2));