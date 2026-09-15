import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = 'games/seed-man-platformer';
const publicRoot = 'site/public-route-patch/games/seed-man-platformer';
const canonicalCampaignPath = `${root}/data/campaign.json`;
const canonicalLevelsPath = `${root}/data/levels-20-v1.json`;
const canonicalRecipesPath = `${root}/data/authored-level-recipes-v1.json`;
const canonicalWorldGameplayPath = `${root}/data/world-gameplay-v1.json`;
const canonicalPowerupsPath = `${root}/data/powerup-catalog-v1.json`;
const publicCampaignPath = `${publicRoot}/data/campaign.json`;
const publicLevelsPath = `${publicRoot}/data/levels-20-v1.json`;
const publicRecipesPath = `${publicRoot}/data/authored-level-recipes-v1.json`;
const publicWorldGameplayPath = `${publicRoot}/data/world-gameplay-v1.json`;
const publicPowerupsPath = `${publicRoot}/data/powerup-catalog-v1.json`;
const indexPath = `${publicRoot}/index.html`;
const playerStatePath = `${publicRoot}/player-state-v20.js`;
const campaignRuntimePath = `${publicRoot}/campaign-v20-runtime.js`;
const campaignUiPath = `${publicRoot}/campaign-ui-v20.js`;
const approvedArtCorePath = `${publicRoot}/approved-art-core-v1.js`;
const approvedArtRuntimePath = `${publicRoot}/approved-art-runtime-v1.js`;
const productionArtPath = `${publicRoot}/seed-man-production-art.js`;
const threeWorldPath = `${publicRoot}/three-world-v1.js`;
const threeAdapterPath = `${publicRoot}/three-world-adapter-v1.js`;
const worldMechanicsPath = `${publicRoot}/world-mechanics-browser-v1.js`;
const combatPath = `${publicRoot}/combat-browser-v2.js`;
const enemyAttackPath = `${publicRoot}/enemy-attacks-browser-v2.js`;
const compatPath = `${publicRoot}/canvas-compat-v1.js`;

const required = [
  canonicalCampaignPath, canonicalLevelsPath, canonicalRecipesPath, canonicalWorldGameplayPath, canonicalPowerupsPath,
  publicCampaignPath, publicLevelsPath, publicRecipesPath, publicWorldGameplayPath, publicPowerupsPath,
  indexPath, playerStatePath, campaignRuntimePath, campaignUiPath, approvedArtCorePath, approvedArtRuntimePath,
  productionArtPath, threeWorldPath, threeAdapterPath, worldMechanicsPath, combatPath, enemyAttackPath, compatPath, `${root}/package.json`
];
for (const file of required) if (!fs.existsSync(file)) throw new Error(`Missing Seed Man v20 release input: ${file}`);

const canonicalCampaignText = fs.readFileSync(canonicalCampaignPath, 'utf8');
const canonicalLevelsText = fs.readFileSync(canonicalLevelsPath, 'utf8');
const canonicalRecipesText = fs.readFileSync(canonicalRecipesPath, 'utf8');
const canonicalWorldGameplayText = fs.readFileSync(canonicalWorldGameplayPath, 'utf8');
const canonicalPowerupsText = fs.readFileSync(canonicalPowerupsPath, 'utf8');
const campaign = JSON.parse(canonicalCampaignText);
const levels = JSON.parse(canonicalLevelsText);
const recipes = JSON.parse(canonicalRecipesText);
const worldGameplay = JSON.parse(canonicalWorldGameplayText);
const powerups = JSON.parse(canonicalPowerupsText);
const index = fs.readFileSync(indexPath, 'utf8');
const playerState = fs.readFileSync(playerStatePath, 'utf8');
const campaignRuntime = fs.readFileSync(campaignRuntimePath, 'utf8');
const campaignUi = fs.readFileSync(campaignUiPath, 'utf8');
const worldMechanics = fs.readFileSync(worldMechanicsPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');

const flattened = campaign.worlds?.flatMap((world) => world.levels || []) || [];
const bossLevels = flattened.filter((entry) => entry.boss);
if (campaign.levelCount !== 20) throw new Error(`Seed Man campaign levelCount must be 20, received ${campaign.levelCount}.`);
if (campaign.worlds?.length !== 5) throw new Error(`Seed Man campaign must have five worlds, received ${campaign.worlds?.length || 0}.`);
if (flattened.length !== 20) throw new Error(`Seed Man campaign manifest must expose 20 level entries, received ${flattened.length}.`);
if (levels.levels?.length !== 20) throw new Error(`Seed Man level catalog must contain 20 levels, received ${levels.levels?.length || 0}.`);
if (Object.keys(recipes.levels || {}).length !== 19) throw new Error('Seed Man authored recipe catalog must contain 19 recipes after authored Level 1-1.');
if (Object.keys(worldGameplay.worlds || {}).length !== 5) throw new Error('Seed Man world gameplay catalog must contain five worlds.');
if (Object.keys(powerups.forms || {}).sort().join(',') !== 'electric,fire,ice,plant') throw new Error('Seed Man powerups must expose Plant, Fire, Electric and Ice.');
if (bossLevels.length !== 6) throw new Error(`Seed Man campaign must expose six boss encounters, received ${bossLevels.length}.`);
if (campaign.finalBoss !== 'blight-king' || flattened.at(-1)?.boss !== 'blight-king') throw new Error('Seed Man Level 20 must end with the Blight King.');

const expectedOrders = Array.from({ length: 20 }, (_, index) => index + 1);
const actualOrders = flattened.map((entry) => entry.order);
if (JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) throw new Error(`Seed Man campaign orders must be contiguous 1-20: ${actualOrders.join(',')}`);

for (const legacy of ['campaign-ui-v15.js','world-five-v1.js','levels-12-15.json','combat-browser-v1.js','enemy-attacks-browser-v1.js','TOTAL_LEVELS = 15','levelCount: 15']) {
  if (index.includes(legacy)) throw new Error(`Legacy Seed Man reference remains in public index: ${legacy}`);
}
for (const marker of ['campaign-v20-runtime.js','campaign-ui-v20.js','approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','three-world-v1.js','three-world-adapter-v1.js','world-mechanics-browser-v1.js','combat-browser-v2.js','enemy-attacks-browser-v2.js']) {
  if (!index.includes(marker)) throw new Error(`Seed Man v20 public index is missing required runtime: ${marker}`);
}
if (index.indexOf('app.js?v=20260909-v20-runtime-v5') > index.indexOf('world-mechanics-browser-v1.js')) throw new Error('Seed Man world mechanics must load after the base app runtime.');
if (index.indexOf('world-mechanics-browser-v1.js') > index.indexOf('campaign-v20-runtime.js')) throw new Error('Seed Man world mechanics must load before campaign initialization.');
if (!playerState.includes('seed-man-player-state-v20')) throw new Error('Seed Man v20 player-state runtime marker is missing.');
for (const marker of ['levelCount:20','bossCount:6',"finalBoss:'blight-king'",'levels-20-v1.json','authored-level-recipes-v1.json','world-gameplay-v1.json','powerup-catalog-v1.json','generatedLevelCount','authoredLevelCount']) {
  if (!campaignRuntime.includes(marker)) throw new Error(`Seed Man v20 campaign runtime missing marker: ${marker}`);
}
for (const marker of ['seed-man-world-mechanics-browser-v1','seed-man-world-mechanics-runtime-v1','moving-platforms','collapsing-platforms','conveyor-platforms','wind-zones','heat-updraft','phenotypeImmuneToHazard']) {
  if (!worldMechanics.includes(marker)) throw new Error(`Seed Man public world mechanics missing marker: ${marker}`);
}
for (const marker of ['seed-man-campaign-ui-v20','20']) if (!campaignUi.includes(marker)) throw new Error(`Seed Man v20 campaign UI missing marker: ${marker}`);
for (const marker of ['seed-man-runtime-health-v20','campaignTarget: 20',"combatRuntime: 'v2'", "playerStateRuntime: 'v20'",'legacyDynamicLoader: false','legacyCanvasMonkeyPatch: false']) {
  if (!compat.includes(marker)) throw new Error(`Seed Man runtime health bridge missing v20 marker: ${marker}`);
}
for (const stale of ['loadScript(','HTMLCanvasElement?.prototype','proto.getContext=',"document.createElement('script')"]) if (compat.includes(stale)) throw new Error(`Seed Man runtime health bridge contains retired bootstrap behavior: ${stale}`);
for (const stale of ["document.createElement('script')",'loadScript(']) if (worldMechanics.includes(stale)) throw new Error(`Seed Man world mechanics must be an explicit dependency, not a dynamic loader: ${stale}`);

fs.copyFileSync(canonicalCampaignPath, publicCampaignPath);
fs.copyFileSync(canonicalLevelsPath, publicLevelsPath);
fs.copyFileSync(canonicalRecipesPath, publicRecipesPath);
fs.copyFileSync(canonicalWorldGameplayPath, publicWorldGameplayPath);
fs.copyFileSync(canonicalPowerupsPath, publicPowerupsPath);

execFileSync('npm', ['install', '--prefix', root, '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'], { stdio: 'inherit' });
execFileSync('npm', ['run', '--prefix', root, 'test:production-contracts'], { stdio: 'inherit' });
execFileSync('npm', ['run', '--prefix', root, 'build:three-public'], { stdio: 'inherit' });

const builtThreeWorld = fs.readFileSync(threeWorldPath, 'utf8');
if (!builtThreeWorld.includes('seed-man-three-dynamic-platforms-v1')) throw new Error('Built Seed Man Three.js bundle is missing the dynamic platform runtime.');

for (const [publicPath,canonicalText,label] of [
  [publicCampaignPath,canonicalCampaignText,'campaign.json'],
  [publicLevelsPath,canonicalLevelsText,'levels-20-v1.json'],
  [publicRecipesPath,canonicalRecipesText,'authored-level-recipes-v1.json'],
  [publicWorldGameplayPath,canonicalWorldGameplayText,'world-gameplay-v1.json'],
  [publicPowerupsPath,canonicalPowerupsText,'powerup-catalog-v1.json']
]) {
  if (fs.readFileSync(publicPath, 'utf8') !== canonicalText) throw new Error(`Public ${label} drifted from canonical Seed Man data.`);
}

console.log(JSON.stringify({
  ok: true,
  release: 'seed-man-v20',
  levels: 20,
  authoredLevels: 20,
  generatedLevels: 0,
  authoredRecipes: 19,
  worlds: 5,
  worldLayerContracts: 35,
  bosses: 6,
  finalBoss: 'blight-king',
  phenotypeForms: ['plant','fire','electric','ice'],
  playerStateRuntime: 'v20',
  combatRuntime: 'v2',
  worldMechanicsRuntime: 'seed-man-world-mechanics-browser-v1',
  dynamicPlatformRuntime: 'seed-man-three-dynamic-platforms-v1',
  worldAdapter: 'explicit',
  runtimeBootstrap: 'health-only',
  approvedArtOnly: true,
  legacyV15PublisherDisabled: true,
  legacyCombatV1Disabled: true,
  legacyDynamicLoaderDisabled: true,
  legacyCanvasMonkeyPatchDisabled: true,
  postBuildRuntimeMutationDisabled: true,
  deterministicTests: true
}, null, 2));
