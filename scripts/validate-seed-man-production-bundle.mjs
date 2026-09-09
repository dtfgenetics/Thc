import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'site/public-route-patch/games/seed-man-platformer');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const requireFile=(rel)=>{const p=path.join(root,rel);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`missing-or-empty:${rel}`);};
const required=[
  'index.html','app.js','canvas-compat-v1.js','player-state-v20.js','campaign-v20-runtime.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','gameplay-v2.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','input-guard-v1.js','seed-man.css','physics.mjs',
  'data/campaign.json','data/levels-20-v1.json','data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
required.forEach(requireFile);

const campaign=JSON.parse(read('data/campaign.json'));
const levels=JSON.parse(read('data/levels-20-v1.json'));
const enemies=JSON.parse(read('data/enemy-catalog-v1.json'));
const art=JSON.parse(read('data/seed-man-art-manifest-v1.json'));
if(campaign.levelCount!==20)throw new Error(`campaign-levelCount:expected-20:got-${campaign.levelCount}`);
if(campaign.newLevelCount!==19)throw new Error(`campaign-newLevelCount:expected-19:got-${campaign.newLevelCount}`);
if(campaign.worlds?.length!==5)throw new Error(`campaign-worlds:expected-5:got-${campaign.worlds?.length}`);
if(campaign.finalBoss!=='blight-king')throw new Error(`campaign-finalBoss:${campaign.finalBoss}`);
if(levels.levels?.length!==20)throw new Error(`level-catalog:expected-20:got-${levels.levels?.length}`);
for(let i=1;i<=20;i++)if(!levels.levels.some((l)=>l.order===i))throw new Error(`missing-level-order:${i}`);
const finale=levels.levels.find((l)=>l.order===20);
if(finale?.boss!=='blight-king'||!finale?.mechanics?.includes('final-gauntlet'))throw new Error('finale-contract-incomplete');
const campaignWorldKeys=campaign.worlds.map((world)=>world.visualWorldKey);
const expectedWorlds=['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];
if(JSON.stringify(campaignWorldKeys)!==JSON.stringify(expectedWorlds))throw new Error(`campaign-world-keys:${campaignWorldKeys.join(',')}`);
if(Object.keys(enemies.common||{}).length!==10)throw new Error('enemy-roster-common-count');
if(Object.keys(enemies.phenotypeCarriers||{}).length!==3)throw new Error('enemy-roster-carrier-count');
for(const id of ['fire-carrier','electric-carrier','ice-carrier'])if(!enemies.phenotypeCarriers?.[id])throw new Error(`enemy-carrier-missing:${id}`);

if(art.id!=='seed-man-approved-art-v2')throw new Error(`approved-art-id:${art.id||'missing'}`);
if(art.sourceOfTruth!=='approved-showcase-2026-09-08')throw new Error('approved-art-source-of-truth-missing');
if(art.policy?.authoritative!==true)throw new Error('approved-art-not-authoritative');
if(art.policy?.proceduralFallbackAllowed!==false||art.policy?.legacyAtlasFallbackAllowed!==false)throw new Error('approved-art-fallback-policy-invalid');
if(art.policy?.characterReference!=='green-armored-plant-hero')throw new Error('approved-character-reference-missing');
for(const world of expectedWorlds)if(!art.policy?.worlds?.includes(world))throw new Error(`approved-world-missing:${world}`);
for(const key of ['cover.main','character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas','world.atlas','ui.vfx.cover'])if(!art.assets?.[key])throw new Error(`approved-asset-key-missing:${key}`);
for(const region of ['cover.main','character.seedman.atlas','enemy-boss.atlas','world.atlas','platform.atlas','ui-vfx.atlas'])if(!art.masterAtlas?.regions?.[region])throw new Error(`approved-atlas-region-missing:${region}`);

for(const [rel,markers] of [
  ['player-state-v20.js',['seed-man-player-state-v20','speedTimer','shieldCharges']],
  ['campaign-v20-runtime.js',['seed-man-campaign-v20-runtime-v2',"phenotypeForms:['plant','fire','electric','ice']"]],
  ['campaign-ui-v20.js',['seed-man-campaign-ui-v20']],
  ['v20-enemy-runtime.js',['seed-man-v20-enemy-runtime-v2','PHENOTYPE_DURATION_MS = 30000']],
  ['combat-browser-v2.js',['seed-man-combat-browser-v2']],
  ['enemy-attacks-browser-v2.js',['seed-man-enemy-attacks-browser-v2']],
  ['seed-man-production-art.js',['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false']]
])for(const marker of markers)if(!read(rel).includes(marker))throw new Error(`missing-marker:${rel}:${marker}`);

const runtime=read('campaign-v20-runtime.js');
for(const retiredPower of ["'speed'","'shield'","'magnet'","'jump'"])if(runtime.includes(retiredPower))throw new Error(`retired-v20-power:${retiredPower}`);
const playerState=read('player-state-v20.js');
for(const requiredMarker of ['delete next.collectedPowerups','delete next.power[key]'])if(!playerState.includes(requiredMarker))throw new Error(`player-state-sanitizer-missing:${requiredMarker}`);
const compat=read('canvas-compat-v1.js');
for(const marker of ['player-state-v20.js','playerStateRuntime:\'v20\'','playerStateAutoLoad:true'])if(!compat.includes(marker))throw new Error(`compat-player-state-missing:${marker}`);
const combat=read('combat-browser-v2.js');
for(const retiredPhenotype of ['hydro-surge','terpene-tempest','vine-lash','mycelium-mind','rootbreaker','trichome-crystal','gravity-haze'])if(combat.includes(retiredPhenotype))throw new Error(`retired-v20-phenotype:${retiredPhenotype}`);
const index=read('index.html');
for(const stale of ['combat-browser-v1.js','enemy-attacks-browser-v1.js'])if(index.includes(stale))throw new Error(`legacy-runtime-in-index:${stale}`);
for(const stale of ['Genome Hydra','Voltage Wasp Alpha','seed-man-production-v1','seed-man-locked-v1'])if(read('seed-man-production-art.js').includes(stale))throw new Error(`retired-renderer-marker:${stale}`);
console.log(JSON.stringify({ok:true,levels:20,worlds:5,bosses:6,enemies:10,phenotypeCarriers:3,finalBoss:'blight-king',approvedArt:true,approvedArtManifest:art.id,playerState:'v20',combatRuntime:'v2'}));
