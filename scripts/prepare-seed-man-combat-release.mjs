import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import './prepare-seed-man-world-five-combat.mjs';

const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const canonicalEnemyAttackModulePath = 'games/seed-man-platformer/src/systems/enemy-attacks.mjs';
const canonicalCampaignPath = 'games/seed-man-platformer/data/campaign.json';
const canonicalWorldFivePackPath = 'games/seed-man-platformer/data/levels-12-15.json';
const canonicalThreePackagePath = 'games/seed-man-platformer/package.json';
const canonicalThreeBuildPath = 'games/seed-man-platformer/dist/three-world-v1.js';
const publicCampaignPath = 'site/public-route-patch/games/seed-man-platformer/data/campaign.json';
const publicWorldFivePackPath = 'site/public-route-patch/games/seed-man-platformer/data/levels-12-15.json';
const publicThreeBuildPath = 'site/public-route-patch/games/seed-man-platformer/three-world-v1.js';
const threeAdapterPath = 'site/public-route-patch/games/seed-man-platformer/three-world-adapter-v1.js';
const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
const enemyAttackBrowserPath = 'site/public-route-patch/games/seed-man-platformer/enemy-attacks-browser-v1.js';
const enemyAttackModulePath = 'site/public-route-patch/games/seed-man-platformer/enemy-attacks.js';
const worldFivePath = 'site/public-route-patch/games/seed-man-platformer/world-five-v1.js';
const campaignUiPath = 'site/public-route-patch/games/seed-man-platformer/campaign-ui-v15.js';
const uiV3Path = 'site/public-route-patch/games/seed-man-platformer/seed-man-ui-v3.js';
const visualV4Path = 'site/public-route-patch/games/seed-man-platformer/seed-man-visual-v4.js';

for (const file of [publisherPath, canonicalEnemyAttackModulePath, canonicalCampaignPath, canonicalWorldFivePackPath, canonicalThreePackagePath, publicCampaignPath, publicWorldFivePackPath, indexPath, combatPath, compatPath, enemyAttackBrowserPath, enemyAttackModulePath, worldFivePath, campaignUiPath, uiV3Path, visualV4Path, threeAdapterPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing Seed Man release input: ${file}`);
}

execFileSync('npm', ['install', '--prefix', 'games/seed-man-platformer', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'], { stdio: 'inherit' });
execFileSync('npm', ['run', '--prefix', 'games/seed-man-platformer', 'build:three-public'], { stdio: 'inherit' });
if (!fs.existsSync(canonicalThreeBuildPath)) throw new Error('Seed Man Three.js build did not produce dist/three-world-v1.js.');
const threeBuild = fs.readFileSync(canonicalThreeBuildPath);
const threeBuildText = threeBuild.toString('utf8');
for (const marker of ['SeedManThreeWorld', 'seed-man-three-public-v1', 'seed-man-three-world-v2', 'seed-man-greenhouse-backdrop-v2', 'seed-man-level-world-v2']) {
  if (!threeBuildText.includes(marker)) throw new Error(`Seed Man Three.js build missing current visual renderer marker: ${marker}`);
}
if (threeBuild.length < 250_000 || threeBuild.length > 900_000) throw new Error(`Seed Man Three.js build outside release budget: ${threeBuild.length} bytes.`);
fs.writeFileSync(publicThreeBuildPath, threeBuild);

let publisher = fs.readFileSync(publisherPath, 'utf8');
const releaseEntries = [
  "  'combat-browser-v1.js',",
  "  'enemy-attacks-browser-v1.js',",
  "  'enemy-attacks.js',",
  "  'world-five-v1.js',",
  "  'campaign-ui-v15.js',",
  "  'seed-man-ui-v3.js',",
  "  'seed-man-visual-v4.js',",
  "  'three-world-v1.js',",
  "  'three-world-adapter-v1.js',",
  "  'data/levels-12-15.json',"
];
const anchor = "  'gameplay-v2.js',\n  'input-guard-v1.js',";
if (!publisher.includes(anchor) && releaseEntries.some((entry) => !publisher.includes(entry))) throw new Error('Could not locate Seed Man publisher release-file anchor.');
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
const campaignUi = fs.readFileSync(campaignUiPath, 'utf8');
const uiV3 = fs.readFileSync(uiV3Path, 'utf8');
const visualV4 = fs.readFileSync(visualV4Path, 'utf8');
const threeAdapter = fs.readFileSync(threeAdapterPath, 'utf8');

if (enemyAttackModule !== canonicalEnemyAttackModule) throw new Error('Browser-safe enemy-attacks.js must exactly mirror the canonical enemy-attacks.mjs source.');
if (publicCampaign !== canonicalCampaign) throw new Error('Public campaign manifest must exactly mirror canonical Seed Man campaign data.');
if (publicWorldFivePack !== canonicalWorldFivePack) throw new Error('Public World 5 level pack must exactly mirror canonical levels-12-15.json.');
if (!fs.readFileSync(publicThreeBuildPath).equals(threeBuild)) throw new Error('Public Three.js bundle must exactly mirror the canonical release build.');

const campaign = JSON.parse(canonicalCampaign);
const worldFivePack = JSON.parse(canonicalWorldFivePack);
if (campaign.levelCount !== 15 || campaign.newLevelCount !== 14 || campaign.worlds?.length !== 5) throw new Error('Seed Man campaign must expose the 15-level, five-world World 5 contract.');
if (worldFivePack.levels?.length !== 4 || worldFivePack.levels.at(-1)?.id !== 'genome-spire') throw new Error('World 5 pack must contain four stages ending at Genome Spire.');

let index = fs.readFileSync(indexPath, 'utf8');
const release = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!release) throw new Error('Could not resolve Seed Man release marker from index.html.');
const worldFiveScript = `  <script src="./world-five-v1.js?v=${release}" defer></script>`;
const threeWorldScript = `  <script src="./three-world-v1.js?v=${release}" defer></script>`;
const threeAdapterScript = `  <script src="./three-world-adapter-v1.js?v=${release}" defer></script>`;
const uiV3Script = `  <script src="./seed-man-ui-v3.js?v=${release}" defer></script>`;
if (!index.includes(threeWorldScript)) {
  if (!index.includes(uiV3Script)) throw new Error('Could not locate Seed Man UI v3 script anchor for Three.js renderer.');
  index = index.replace(uiV3Script, `${threeWorldScript}\n${uiV3Script}`);
}
if (!index.includes(threeAdapterScript)) {
  if (!index.includes(threeWorldScript)) throw new Error('Could not locate Seed Man Three.js script anchor for runtime adapter.');
  index = index.replace(threeWorldScript, `${threeWorldScript}\n${threeAdapterScript}`);
}
fs.writeFileSync(indexPath, index);

for (const marker of ['seed-man-combat-browser-v1','seed-man-phenotype-absorb-v1','seed-man-phenotype-expansion-v1','combat-static-mite','PHENO ABSORBED','terpene-tempest','hydro-surge','gravity-haze','data-combat']) if (!combat.includes(marker)) throw new Error(`Missing combat adapter marker: ${marker}`);
for (const marker of ['combatBrowserAutoLoad: true','combat-browser-v1.js','seed-man-phenotype-mobility-frame-v1','mobilityFrameRepairInstalled','enemyAttackBrowserAutoLoad: true','enemy-attacks-browser-v1.js','campaignUiAutoLoad: true','campaign-ui-v15.js']) if (!compat.includes(marker)) throw new Error(`Missing combat compatibility marker: ${marker}`);
for (const marker of ['seed-man-enemy-attacks-browser-v1',"import('./enemy-attacks.js')",'radial-burst','blink-strike','ground-wave','hitsTaken']) if (!enemyAttackBrowser.includes(marker)) throw new Error(`Missing enemy attack browser marker: ${marker}`);
for (const marker of ['ATTACK_PATTERNS','stepEnemyAttack','advanceEnemyProjectile','resolveEnemyContact']) if (!enemyAttackModule.includes(marker)) throw new Error(`Missing enemy attack module marker: ${marker}`);
for (const marker of ['seed-man-world-five-v1','Genetic Frontier','Chromosome Crossing','Mutation Marsh','Allele Array','Genome Spire','Genome Hydra','levelCount: 15']) if (!worldFive.includes(marker)) throw new Error(`Missing World 5 browser marker: ${marker}`);
for (const marker of ['seed-man-campaign-ui-v15','TOTAL_LEVELS = 15','TOTAL_WORLDS = 5','TOTAL_BOSSES = 6','sproutCampaignUi']) if (!campaignUi.includes(marker)) throw new Error(`Missing 15-level campaign UI marker: ${marker}`);
for (const marker of ['seed-man-ui-v3','seed-run-context','Opening Route','Mid Route','Final Run','data-ui-v3','sprout:level-selected','seed-man-visual-v4']) if (!uiV3.includes(marker)) throw new Error(`Missing Seed Man UI v3 marker: ${marker}`);
for (const marker of ['seed-man-visual-v4','WORLD_THEMES','world-05','data-visual-v4','BOSS ENCOUNTER','data-seed-pheno-active']) if (!visualV4.includes(marker)) throw new Error(`Missing Seed Man visual v4 marker: ${marker}`);
for (const marker of ['seed-man-three-adapter-v2','seed-man-three-world-v2','SeedManThreeWorld','drawThreeBackedBackground','__SPROUT_THREE_ADAPTER__','ResizeObserver','visibilitychange','renderer.mountLevel','renderer.sync','renderer.render']) if (!threeAdapter.includes(marker)) throw new Error(`Missing current Three.js live runtime adapter marker: ${marker}`);
for (const marker of ['seed-man-world-five-combat-v1',"'chromosome-crossing'","'mutation-marsh'","'allele-array'","'genome-spire'",'return ENCOUNTERS[level?.id] || [];']) if (!combat.includes(marker)) throw new Error(`Missing prepared World 5 combat marker: ${marker}`);
for (const entry of releaseEntries) if (!publisher.includes(entry)) throw new Error(`Seed Man publisher allowlist is missing: ${entry}`);
if (!index.includes(worldFiveScript)) throw new Error('Seed Man index is missing the World 5 browser adapter.');
if (!index.includes(threeWorldScript)) throw new Error('Seed Man index is missing the Three.js production bundle.');
if (!index.includes(threeAdapterScript)) throw new Error('Seed Man index is missing the Three.js live runtime adapter.');
if (!index.includes(uiV3Script)) throw new Error('Seed Man index is missing the UI v3 adapter.');

console.log(JSON.stringify({ ok: true, publisherPatched: true, campaignLevels: 15, campaignWorlds: 5, campaignBosses: 6, phenotypeAbsorption: 'seed-man-phenotype-absorb-v1', phenotypeExpansion: 'seed-man-phenotype-expansion-v1', phenotypeMobilityFrameRepair: 'seed-man-phenotype-mobility-frame-v1', worldFiveCombat: 'seed-man-world-five-combat-v1', campaignUi: 'seed-man-campaign-ui-v15', uiV3: 'seed-man-ui-v3', visualV4: 'seed-man-visual-v4', threeWorld: 'seed-man-three-world-v2', threePublicApi: 'seed-man-three-public-v1', threeAdapter: 'seed-man-three-adapter-v2', threeWorldBytes: threeBuild.length, autoload: true, liveRendererOwnership: true, resizeStrategy: 'event-driven', hiddenTabRendering: 'paused' }, null, 2));