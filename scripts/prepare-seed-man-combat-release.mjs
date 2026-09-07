import fs from 'node:fs';

const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const canonicalEnemyAttackModulePath = 'games/seed-man-platformer/src/systems/enemy-attacks.mjs';
const canonicalCampaignPath = 'games/seed-man-platformer/data/campaign.json';
const canonicalWorldFivePackPath = 'games/seed-man-platformer/data/levels-12-15.json';
const publicCampaignPath = 'site/public-route-patch/games/seed-man-platformer/data/campaign.json';
const publicWorldFivePackPath = 'site/public-route-patch/games/seed-man-platformer/data/levels-12-15.json';
const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
const enemyAttackBrowserPath = 'site/public-route-patch/games/seed-man-platformer/enemy-attacks-browser-v1.js';
const enemyAttackModulePath = 'site/public-route-patch/games/seed-man-platformer/enemy-attacks.js';
const worldFivePath = 'site/public-route-patch/games/seed-man-platformer/world-five-v1.js';

for (const file of [
  publisherPath,
  canonicalEnemyAttackModulePath,
  canonicalCampaignPath,
  canonicalWorldFivePackPath,
  publicCampaignPath,
  publicWorldFivePackPath,
  indexPath,
  combatPath,
  compatPath,
  enemyAttackBrowserPath,
  enemyAttackModulePath,
  worldFivePath
]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man release input: ${file}`);
}

let publisher = fs.readFileSync(publisherPath, 'utf8');
const releaseEntries = [
  "  'combat-browser-v1.js',",
  "  'enemy-attacks-browser-v1.js',",
  "  'enemy-attacks.js',",
  "  'world-five-v1.js',",
  "  'data/levels-12-15.json',"
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
const canonicalCampaign = fs.readFileSync(canonicalCampaignPath, 'utf8');
const canonicalWorldFivePack = fs.readFileSync(canonicalWorldFivePackPath, 'utf8');
const publicCampaign = fs.readFileSync(publicCampaignPath, 'utf8');
const publicWorldFivePack = fs.readFileSync(publicWorldFivePackPath, 'utf8');
const combat = fs.readFileSync(combatPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');
const enemyAttackBrowser = fs.readFileSync(enemyAttackBrowserPath, 'utf8');
const enemyAttackModule = fs.readFileSync(enemyAttackModulePath, 'utf8');
const worldFive = fs.readFileSync(worldFivePath, 'utf8');

if (enemyAttackModule !== canonicalEnemyAttackModule) {
  throw new Error('Browser-safe enemy-attacks.js must exactly mirror the canonical enemy-attacks.mjs source.');
}
if (publicCampaign !== canonicalCampaign) {
  throw new Error('Public campaign manifest must exactly mirror canonical Seed Man campaign data.');
}
if (publicWorldFivePack !== canonicalWorldFivePack) {
  throw new Error('Public World 5 level pack must exactly mirror canonical levels-12-15.json.');
}

const campaign = JSON.parse(canonicalCampaign);
const worldFivePack = JSON.parse(canonicalWorldFivePack);
if (campaign.levelCount !== 15 || campaign.newLevelCount !== 14 || campaign.worlds?.length !== 5) {
  throw new Error('Seed Man campaign must expose the 15-level, five-world World 5 contract.');
}
if (worldFivePack.levels?.length !== 4 || worldFivePack.levels.at(-1)?.id !== 'genome-spire') {
  throw new Error('World 5 pack must contain four stages ending at Genome Spire.');
}

let index = fs.readFileSync(indexPath, 'utf8');
const release = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!release) throw new Error('Could not resolve Seed Man release marker from index.html.');
const worldFiveScript = `  <script src="./world-five-v1.js?v=${release}" defer></script>`;
if (!index.includes(worldFiveScript)) {
  const scriptAnchor = `  <script src="./input-guard-v1.js?v=${release}" defer></script>`;
  if (!index.includes(scriptAnchor)) throw new Error('Could not locate Seed Man World 5 script injection anchor.');
  index = index.replace(scriptAnchor, `${scriptAnchor}\n${worldFiveScript}`);
  fs.writeFileSync(indexPath, index);
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
for (const marker of [
  'seed-man-world-five-v1',
  'Genetic Frontier',
  'Chromosome Crossing',
  'Mutation Marsh',
  'Allele Array',
  'Genome Spire',
  'Genome Hydra',
  'levelCount: 15'
]) {
  if (!worldFive.includes(marker)) throw new Error(`Missing World 5 browser marker: ${marker}`);
}
for (const entry of releaseEntries) {
  if (!publisher.includes(entry)) throw new Error(`Seed Man publisher allowlist is missing: ${entry}`);
}
if (!index.includes(worldFiveScript)) throw new Error('Seed Man index is missing the World 5 browser adapter.');

console.log(JSON.stringify({
  ok: true,
  publisherPatched: true,
  combatFile: 'combat-browser-v1.js',
  enemyAttackBrowserFile: 'enemy-attacks-browser-v1.js',
  enemyAttackModuleFile: 'enemy-attacks.js',
  canonicalEnemyAttackModuleFile: 'enemy-attacks.mjs',
  worldFiveFile: 'world-five-v1.js',
  worldFivePack: 'data/levels-12-15.json',
  campaignLevels: 15,
  campaignWorlds: 5,
  phenotypeAbsorption: 'seed-man-phenotype-absorb-v1',
  phenotypeExpansion: 'seed-man-phenotype-expansion-v1',
  phenotypeMobilityFrameRepair: 'seed-man-phenotype-mobility-frame-v1',
  mobilityForms: ['terpene-tempest:flight', 'hydro-surge:bubble', 'gravity-haze:warp'],
  enemyAttackPatterns: ['aimed-shot', 'burst-shot', 'radial-burst', 'dive-charge', 'ground-wave', 'blink-strike'],
  worldFiveStages: ['chromosome-crossing', 'mutation-marsh', 'allele-array', 'genome-spire'],
  autoload: true
}, null, 2));