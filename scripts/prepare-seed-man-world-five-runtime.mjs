import fs from 'node:fs';

const route='site/public-route-patch/games/seed-man-platformer';
const campaignRuntimePath=`${route}/campaign-v20-runtime.js`;
const enemyRuntimePath=`${route}/v20-enemy-runtime.js`;
const campaignPath=`${route}/data/campaign.json`;
const approvedCorePath=`${route}/approved-art-core-v1.js`;
const threeWorldPath=`${route}/three-world-v1.js`;
const releaseTruthPath=`${route}/release-truth-v1.js`;
const retiredArtifacts=[`${route}/world-five-v1.js`,`${route}/assets/approved/seed-man-approved-master-atlas-v1.webp`];

for(const file of [campaignRuntimePath,enemyRuntimePath,campaignPath,approvedCorePath,threeWorldPath,releaseTruthPath])if(!fs.existsSync(file))throw new Error(`Missing canonical Seed Man v20 runtime input: ${file}`);
for(const file of retiredArtifacts)if(fs.existsSync(file))throw new Error(`Retired Seed Man artifact must stay absent: ${file}`);

const campaignRuntime=fs.readFileSync(campaignRuntimePath,'utf8');
const enemyRuntime=fs.readFileSync(enemyRuntimePath,'utf8');
const approvedCore=fs.readFileSync(approvedCorePath,'utf8');
const threeWorld=fs.readFileSync(threeWorldPath,'utf8');
const releaseTruth=fs.readFileSync(releaseTruthPath,'utf8');
const campaign=JSON.parse(fs.readFileSync(campaignPath,'utf8'));

if(!campaignRuntime.includes('seed-man-campaign-v20-runtime-v3'))throw new Error('Canonical v20 campaign runtime marker is missing.');
if(!enemyRuntime.includes('seed-man-v20-enemy-runtime-v2'))throw new Error('Canonical v20 enemy runtime marker is missing.');
if(!approvedCore.includes('seed-man-art-core-v5')||approvedCore.includes('seed-man-approved-master-atlas-v1.webp'))throw new Error('Repaired Seed Man art core is invalid.');
if(!approvedCore.includes('classic-seed-man-oval-v1')||!approvedCore.includes('seed-man-authored-flat-background-v1'))throw new Error('Seed Man art transition contract is missing.');
for(const world of ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']){
  if(!approvedCore.includes(`world.${world}.background`))throw new Error(`Authored world descriptor missing: ${world}`);
  if(!approvedCore.includes(`${world}-bg-v1.png`))throw new Error(`Authored PNG world master missing from art core: ${world}`);
  if(!fs.existsSync(`${route}/assets/worlds/${world}-bg-v1.png`))throw new Error(`Authored PNG world file missing: ${world}`);
}
if(!threeWorld.includes('seed-man-three-public-v3')||!threeWorld.includes('seed-man-three-world-v2'))throw new Error('Canonical final Three.js world renderer target is missing.');
if(fs.statSync(threeWorldPath).size<250000)throw new Error('Three.js world renderer bundle is still a compatibility stub.');
if(!releaseTruth.includes('seed-man-release-truth-v1')||!releaseTruth.includes('AUTHORED WORLD ART'))throw new Error('Seed Man release truth guard is missing.');
if(campaign.levelCount!==20||campaign.worlds?.length!==5||campaign.finalBoss!=='blight-king')throw new Error('Seed Man campaign must remain 20 levels / five worlds / Blight King finale.');
for(const retiredAlias of ['solar-flare','static-haze','frost-resin'])if(enemyRuntime.includes(retiredAlias))throw new Error(`Retired phenotype alias remains in enemy runtime: ${retiredAlias}`);

console.log(JSON.stringify({ok:true,mode:'validation-only',campaignRuntime:campaignRuntimePath,enemyRuntime:enemyRuntimePath,activeWorldRenderer:'seed-man-authored-flat-background-v1',worldRendererTarget:'seed-man-three-world-v2',levels:campaign.levelCount,worlds:campaign.worlds.length,finalBoss:campaign.finalBoss,characterTarget:'classic-seed-man-oval-v1',canonicalPhenotypes:['plant','fire','electric','ice'],legacyMutationDisabled:true},null,2));
