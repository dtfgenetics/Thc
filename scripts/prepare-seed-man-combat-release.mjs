import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = 'games/seed-man-platformer';
const publicRoot = 'site/public-route-patch/games/seed-man-platformer';
const canonicalCampaignPath = `${root}/data/campaign.json`;
const canonicalLevelsPath = `${root}/data/levels-20-v1.json`;
const publicCampaignPath = `${publicRoot}/data/campaign.json`;
const publicLevelsPath = `${publicRoot}/data/levels-20-v1.json`;
const indexPath = `${publicRoot}/index.html`;
const campaignRuntimePath = `${publicRoot}/campaign-v20-runtime.js`;
const campaignGuardPath = `${publicRoot}/v20-campaign-guard.js`;
const campaignUiPath = `${publicRoot}/campaign-ui-v20.js`;
const enemyRuntimePath = `${publicRoot}/v20-enemy-runtime.js`;
const approvedArtCorePath = `${publicRoot}/approved-art-core-v1.js`;
const approvedArtRuntimePath = `${publicRoot}/approved-art-runtime-v1.js`;
const productionArtPath = `${publicRoot}/seed-man-production-art.js`;
const combatPath = `${publicRoot}/combat-browser-v2.js`;
const enemyAttackPath = `${publicRoot}/enemy-attacks-browser-v2.js`;
const compatPath = `${publicRoot}/canvas-compat-v1.js`;

const required = [
  canonicalCampaignPath, canonicalLevelsPath, publicCampaignPath, publicLevelsPath, indexPath,
  campaignRuntimePath, campaignGuardPath, campaignUiPath, enemyRuntimePath,
  approvedArtCorePath, approvedArtRuntimePath, productionArtPath,
  combatPath, enemyAttackPath, compatPath, `${root}/package.json`
];
for (const file of required) if (!fs.existsSync(file)) throw new Error(`Missing Seed Man v20 release input: ${file}`);

const canonicalCampaignText = fs.readFileSync(canonicalCampaignPath, 'utf8');
const canonicalLevelsText = fs.readFileSync(canonicalLevelsPath, 'utf8');
const campaign = JSON.parse(canonicalCampaignText);
const levels = JSON.parse(canonicalLevelsText);
const index = fs.readFileSync(indexPath, 'utf8');
const campaignRuntime = fs.readFileSync(campaignRuntimePath, 'utf8');
const campaignGuard = fs.readFileSync(campaignGuardPath, 'utf8');
const campaignUi = fs.readFileSync(campaignUiPath, 'utf8');
const enemyRuntime = fs.readFileSync(enemyRuntimePath, 'utf8');
const combat = fs.readFileSync(combatPath, 'utf8');
const enemyAttack = fs.readFileSync(enemyAttackPath, 'utf8');
const compat = fs.readFileSync(compatPath, 'utf8');

const flattened = campaign.worlds?.flatMap((world) => world.levels || []) || [];
const bossLevels = flattened.filter((entry) => entry.boss);
if (campaign.levelCount !== 20) throw new Error(`Seed Man campaign levelCount must be 20, received ${campaign.levelCount}.`);
if (campaign.worlds?.length !== 5) throw new Error(`Seed Man campaign must have five worlds, received ${campaign.worlds?.length || 0}.`);
if (flattened.length !== 20) throw new Error(`Seed Man campaign manifest must expose 20 level entries, received ${flattened.length}.`);
if (levels.levels?.length !== 20) throw new Error(`Seed Man level catalog must contain 20 levels, received ${levels.levels?.length || 0}.`);
if (bossLevels.length !== 6) throw new Error(`Seed Man campaign must expose six boss encounters, received ${bossLevels.length}.`);
if (campaign.finalBoss !== 'blight-king' || flattened.at(-1)?.boss !== 'blight-king') throw new Error('Seed Man Level 20 must end with the Blight King.');

const expectedOrders = Array.from({ length: 20 }, (_, index) => index + 1);
const actualOrders = flattened.map((entry) => entry.order);
if (JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) throw new Error(`Seed Man campaign orders must be contiguous 1-20: ${actualOrders.join(',')}`);

for (const legacy of ['campaign-ui-v15.js','world-five-v1.js','levels-12-15.json','TOTAL_LEVELS = 15','levelCount: 15','combat-browser-v1.js','enemy-attacks-browser-v1.js','"id":"sprout-run"','bootstrap-speed','bootstrap-shield','bootstrap-magnet','bootstrap-jump']) {
  if (index.includes(legacy)) throw new Error(`Legacy Seed Man reference remains in public index: ${legacy}`);
}
for (const marker of ['campaign-v20-runtime.js','v20-campaign-guard.js','campaign-ui-v20.js','v20-enemy-runtime.js','approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','combat-browser-v2.js','enemy-attacks-browser-v2.js']) {
  if (!index.includes(marker)) throw new Error(`Seed Man v20 public index is missing required runtime: ${marker}`);
}
for (const marker of ['levelCount:20','bossCount:6',"finalBoss:'blight-king'",'levels-20-v1.json']) if (!campaignRuntime.includes(marker)) throw new Error(`Seed Man v20 campaign runtime missing marker: ${marker}`);
for (const marker of ['seed-man-v20-campaign-guard-v1','speed','shield','magnet','jump']) if (!campaignGuard.includes(marker)) throw new Error(`Seed Man campaign guard missing marker: ${marker}`);
for (const marker of ['seed-man-campaign-ui-v20','20']) if (!campaignUi.includes(marker)) throw new Error(`Seed Man v20 campaign UI missing marker: ${marker}`);
for (const marker of ['seed-man-v20-enemy-runtime-v1',"['fire','electric','ice']",'30000']) if (!enemyRuntime.includes(marker)) throw new Error(`Seed Man enemy runtime missing marker: ${marker}`);
for (const marker of ['seed-man-combat-browser-v2','PHENOTYPE_DURATION = 30']) if (!combat.includes(marker)) throw new Error(`Seed Man combat runtime missing marker: ${marker}`);
if (!enemyAttack.includes('seed-man-enemy-attacks-browser-v2')) throw new Error('Seed Man enemy attack runtime missing v2 marker.');
for (const marker of ['sprout-canvas-compat-v20.1','campaignTarget:20','combat-browser-v2.js','enemy-attacks-browser-v2.js']) if (!compat.includes(marker)) throw new Error(`Seed Man compatibility bootstrap missing v20 marker: ${marker}`);

fs.copyFileSync(canonicalCampaignPath, publicCampaignPath);
fs.copyFileSync(canonicalLevelsPath, publicLevelsPath);

execFileSync('npm', ['install', '--prefix', root, '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'], { stdio: 'inherit' });
execFileSync('npm', ['run', '--prefix', root, 'test:production-contracts'], { stdio: 'inherit' });
execFileSync('npm', ['run', '--prefix', root, 'build:three-public'], { stdio: 'inherit' });

if (fs.readFileSync(publicCampaignPath, 'utf8') !== canonicalCampaignText) throw new Error('Public campaign.json drifted from canonical v20 campaign data.');
if (fs.readFileSync(publicLevelsPath, 'utf8') !== canonicalLevelsText) throw new Error('Public levels-20-v1.json drifted from canonical v20 level catalog.');

console.log(JSON.stringify({ok:true,release:'seed-man-v20',levels:20,worlds:5,bosses:6,finalBoss:'blight-king',phenotypes:['plant','fire','electric','ice'],combat:'seed-man-combat-browser-v2',enemyRuntime:'seed-man-v20-enemy-runtime-v1',approvedArtOnly:true,legacyV15PublisherDisabled:true,deterministicTests:true}, null, 2));
