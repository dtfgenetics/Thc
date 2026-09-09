import fs from 'node:fs';

const campaignRuntimePath = 'site/public-route-patch/games/seed-man-platformer/campaign-v20-runtime.js';
const enemyRuntimePath = 'site/public-route-patch/games/seed-man-platformer/v20-enemy-runtime.js';
const campaignPath = 'site/public-route-patch/games/seed-man-platformer/data/campaign.json';
const RETIRED_RUNTIME = 'world-five-v1.js';

for (const file of [campaignRuntimePath, enemyRuntimePath, campaignPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing canonical Seed Man v20 runtime input: ${file}`);
}

const campaignRuntime = fs.readFileSync(campaignRuntimePath, 'utf8');
const enemyRuntime = fs.readFileSync(enemyRuntimePath, 'utf8');
const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));

if (!campaignRuntime.includes('seed-man-campaign-v20-runtime-v2')) throw new Error('Canonical v20 campaign runtime marker is missing.');
if (!enemyRuntime.includes('seed-man-v20-enemy-runtime-v3')) throw new Error('Canonical v20 enemy runtime marker is missing.');
if (campaign.levelCount !== 20 || campaign.worlds?.length !== 5) throw new Error('Seed Man campaign must remain 20 levels across five worlds.');
if (campaign.finalBoss !== 'blight-king') throw new Error('Seed Man final boss must remain Blight King.');
for (const retiredAlias of ['solar-flare','static-haze','frost-resin']) if (enemyRuntime.includes(retiredAlias)) throw new Error(`Retired phenotype alias remains in enemy runtime: ${retiredAlias}`);

console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  campaignRuntime: campaignRuntimePath,
  enemyRuntime: enemyRuntimePath,
  levels: campaign.levelCount,
  worlds: campaign.worlds.length,
  finalBoss: campaign.finalBoss,
  retiredRuntime: RETIRED_RUNTIME,
  canonicalPhenotypes: ['plant','fire','electric','ice'],
  legacyMutationDisabled: true
}, null, 2));
