import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'site/public-route-patch/games/seed-man-platformer');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const requireFile=(rel)=>{const p=path.join(root,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`missing-or-empty:${rel}`);};
const required=[
  'index.html','app.js','canvas-compat-v1.js','campaign-v20-runtime.js','v20-campaign-guard.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','gameplay-v2.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','input-guard-v1.js','seed-man.css','physics.mjs',
  'data/campaign.json','data/levels-20-v1.json','data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
required.forEach(requireFile);

const campaign=JSON.parse(read('data/campaign.json'));
const levels=JSON.parse(read('data/levels-20-v1.json'));
const art=JSON.parse(read('data/seed-man-art-manifest-v1.json'));
const enemies=JSON.parse(read('data/enemy-catalog-v1.json'));
if(campaign.levelCount!==20)throw new Error(`campaign-levelCount:expected-20:got-${campaign.levelCount}`);
if(campaign.newLevelCount!==19)throw new Error(`campaign-newLevelCount:expected-19:got-${campaign.newLevelCount}`);
if(campaign.worlds?.length!==5)throw new Error(`campaign-worlds:expected-5:got-${campaign.worlds?.length}`);
if(campaign.finalBoss!=='blight-king')throw new Error(`campaign-finalBoss:${campaign.finalBoss}`);
if(levels.levels?.length!==20)throw new Error(`level-catalog:expected-20:got-${levels.levels?.length}`);
for(let i=1;i<=20;i++)if(!levels.levels.some((l)=>l.order===i))throw new Error(`missing-level-order:${i}`);
for(const level of levels.levels)for(const enemy of level.enemyPool||[])if(!enemies.common?.[enemy])throw new Error(`unknown-enemy:${level.id}:${enemy}`);
for(const carrier of ['fire-carrier','electric-carrier','ice-carrier'])if(enemies.phenotypeCarriers?.[carrier]?.dropDurationMs!==30000)throw new Error(`invalid-carrier:${carrier}`);
const finale=levels.levels.find((l)=>l.order===20);
if(finale?.boss!=='blight-king'||!finale?.mechanics?.includes('final-gauntlet'))throw new Error('finale-contract-incomplete');
const campaignWorldKeys=campaign.worlds.map((world)=>world.visualWorldKey);
const expectedWorlds=['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];
if(JSON.stringify(campaignWorldKeys)!==JSON.stringify(expectedWorlds))throw new Error(`campaign-world-keys:${campaignWorldKeys.join(',')}`);

if(art.id!=='seed-man-approved-art-v2')throw new Error(`approved-art-id:${art.id||'missing'}`);
if(art.sourceOfTruth!=='approved-showcase-2026-09-08')throw new Error('approved-art-source-of-truth-missing');
if(art.policy?.authoritative!==true)throw new Error('approved-art-not-authoritative');
if(art.policy?.proceduralFallbackAllowed!==false||art.policy?.legacyAtlasFallbackAllowed!==false)throw new Error('approved-art-fallback-policy-invalid');
if(art.policy?.characterReference!=='green-armored-plant-hero')throw new Error('approved-character-reference-missing');
for(const world of expectedWorlds)if(!art.policy?.worlds?.includes(world))throw new Error(`approved-world-missing:${world}`);

for(const [rel,markers] of [
  ['campaign-v20-runtime.js',['seed-man-campaign-v20-runtime-v1']],
  ['v20-campaign-guard.js',['seed-man-v20-campaign-guard-v1']],
  ['v20-enemy-runtime.js',['seed-man-v20-enemy-runtime-v1']],
  ['combat-browser-v2.js',['seed-man-combat-browser-v2','PHENOTYPE_DURATION = 30']],
  ['enemy-attacks-browser-v2.js',['seed-man-enemy-attacks-browser-v2']],
  ['campaign-ui-v20.js',['seed-man-campaign-ui-v20']],
  ['seed-man-production-art.js',['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false']]
])for(const marker of markers)if(!read(rel).includes(marker))throw new Error(`missing-marker:${rel}:${marker}`);

const index=read('index.html');
for(const stale of ['combat-browser-v1.js','enemy-attacks-browser-v1.js','"id":"sprout-run"','bootstrap-speed','bootstrap-shield','bootstrap-magnet','bootstrap-jump','campaign-ui-v15.js','world-five-v1.js','levels-12-15.json'])if(index.includes(stale))throw new Error(`retired-index-marker:${stale}`);
for(const requiredScript of ['v20-campaign-guard.js','v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js'])if(!index.includes(requiredScript))throw new Error(`missing-index-script:${requiredScript}`);
for(const stale of ['Genome Hydra','Voltage Wasp Alpha','seed-man-production-v1','seed-man-locked-v1'])if(read('seed-man-production-art.js').includes(stale))throw new Error(`retired-renderer-marker:${stale}`);
console.log(JSON.stringify({ok:true,levels:20,worlds:5,bosses:6,finalBoss:'blight-king',approvedArt:true,approvedArtManifest:art.id,combat:'v2',phenotypes:['plant','fire','electric','ice']}));
