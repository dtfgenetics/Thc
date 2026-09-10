import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'site/public-route-patch/games/seed-man-platformer');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=(rel)=>fs.existsSync(path.join(root,rel));
const requireFile=(rel)=>{const p=path.join(root,rel);if(!exists(rel)||fs.statSync(p).size===0)throw new Error(`missing-or-empty:${rel}`);return p;};
const requireWebp=(rel)=>{const b=fs.readFileSync(requireFile(rel));if(b.subarray(0,4).toString('ascii')!=='RIFF'||b.subarray(8,12).toString('ascii')!=='WEBP')throw new Error(`invalid-webp:${rel}`);};

const required=[
  'index.html','app.js','canvas-compat-v1.js','player-state-v20.js','campaign-v20-runtime.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','three-world-v1.js','three-world-adapter-v1.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','enemy-attacks.js','input-guard-v1.js','seed-man.css',
  'assets/approved/seed-man-character-atlas-v2.webp','assets/approved/seed-man-enemy-boss-atlas-v1.webp','assets/approved/seed-man-platform-atlas-v1.webp',
  'data/campaign.json','data/levels-20-v1.json','data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
required.forEach(requireFile);
for(const rel of ['assets/approved/seed-man-character-atlas-v2.webp','assets/approved/seed-man-enemy-boss-atlas-v1.webp','assets/approved/seed-man-platform-atlas-v1.webp'])requireWebp(rel);

const retired=[
  'data/level-01.json','data/levels-02-11.json','data/levels-12-15.json','campaign-v1.js','gameplay-v2.js','physics.mjs','campaign-combat-v20.js','campaign-progress-v20.js','campaign-runtime-v20.js',
  'campaign-ui-v15.js','world-five-v1.js','combat-browser-v1.js','enemy-attacks-browser-v1.js','seed-man-ui-v3.js',
  'assets/approved/seed-man-approved-master-atlas-v1.webp','assets/approved/seed-man-cover-banner-approved-v1.webp'
];
for(const rel of retired)if(exists(rel))throw new Error(`retired-artifact-present:${rel}`);

const campaign=JSON.parse(read('data/campaign.json'));
const levels=JSON.parse(read('data/levels-20-v1.json'));
const enemies=JSON.parse(read('data/enemy-catalog-v1.json'));
const art=JSON.parse(read('data/seed-man-art-manifest-v1.json'));
if(campaign.id!=='seed-man-campaign-20-v1')throw new Error(`campaign-id:${campaign.id}`);
if(campaign.levelCount!==20||campaign.newLevelCount!==19||campaign.worlds?.length!==5)throw new Error('campaign-contract-invalid');
if(campaign.finalBoss!=='blight-king')throw new Error(`campaign-finalBoss:${campaign.finalBoss}`);
const campaignLevels=campaign.worlds.flatMap((world)=>world.levels||[]);
if(campaignLevels.length!==20||campaignLevels.some((entry)=>Object.hasOwn(entry,'publicDataElementId')))throw new Error('retired-embedded-level-metadata-present');
if(levels.levels?.length!==20)throw new Error(`level-catalog:expected-20:got-${levels.levels?.length}`);
for(let i=1;i<=20;i+=1)if(!levels.levels.some((level)=>level.order===i))throw new Error(`missing-level-order:${i}`);
const finale=levels.levels.find((level)=>level.order===20);
if(finale?.boss!=='blight-king'||!finale?.mechanics?.includes('final-gauntlet'))throw new Error('finale-contract-incomplete');
const expectedWorlds=['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];
if(JSON.stringify(campaign.worlds.map((world)=>world.visualWorldKey))!==JSON.stringify(expectedWorlds))throw new Error('campaign-world-key-mismatch');
if(Object.keys(enemies.common||{}).length!==10||Object.keys(enemies.phenotypeCarriers||{}).length!==3)throw new Error('enemy-roster-contract-invalid');

if(art.schemaVersion!==3||art.id!=='seed-man-approved-art-v2')throw new Error('approved-art-contract-invalid');
if(art.masterAtlas)throw new Error('retired-master-atlas-contract-present');
if(art.policy?.characterReference!=='green-armored-plant-hero'||art.policy?.worldRenderer!=='seed-man-three-world-v2')throw new Error('approved-renderer-contract-invalid');
for(const key of ['character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas'])if(!art.assets?.[key]?.src)throw new Error(`approved-image-asset-missing:${key}`);
for(const world of expectedWorlds){const asset=art.assets?.[`world.${world}.background`];if(asset?.renderer!=='seed-man-three-world-v2')throw new Error(`approved-world-renderer-missing:${world}`);}

const markerSets=[
  ['player-state-v20.js',['seed-man-player-state-v20','delete next.collectedPowerups','delete next.power[key]']],
  ['approved-art-core-v1.js',['seed-man-approved-art-core-v4','seed-man-character-atlas-v2.webp','seed-man-enemy-boss-atlas-v1.webp','seed-man-platform-atlas-v1.webp',"worldRenderer:'seed-man-three-world-v2'"]],
  ['approved-art-runtime-v1.js',['seed-man-approved-art-runtime-v2',"phenotypeForms:Object.freeze(['plant','fire','electric','ice'])"]],
  ['campaign-v20-runtime.js',['seed-man-campaign-v20-runtime-v3',"phenotypeForms:['plant','fire','electric','ice']"]],
  ['campaign-ui-v20.js',['seed-man-campaign-ui-v20']],
  ['v20-enemy-runtime.js',['seed-man-v20-enemy-runtime-v2','PHENOTYPE_DURATION_MS = 30000']],
  ['combat-browser-v2.js',['seed-man-combat-browser-v2','syncBossState','seedman:boss-defeated']],
  ['enemy-attacks-browser-v2.js',['seed-man-enemy-attacks-browser-v2']],
  ['seed-man-production-art.js',['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false']],
  ['canvas-compat-v1.js',['seed-man-runtime-bootstrap-v20','three-world-adapter-v1.js','seed-man-three-public-v3']],
  ['input-guard-v1.js',['seed-man-input-guard-v20','protect-native-interactive-keyboard-behavior','legacySignatureRuntime:false']],
  ['app.js',['seed-man-base-runtime-v20',"campaignAuthority:'campaign-v20-runtime.js'",'level.boss && !level.boss.defeated']]
];
for(const [rel,markers] of markerSets)for(const marker of markers)if(!read(rel).includes(marker))throw new Error(`missing-marker:${rel}:${marker}`);

const three=read('three-world-v1.js');
if(!three.includes('SeedManThreeWorld')||!three.includes('seed-man-three-public-v3')||!three.includes('seed-man-three-world-v2'))throw new Error('three-world-generated-bundle-marker-missing');
if(fs.statSync(path.join(root,'three-world-v1.js')).size<250000)throw new Error('three-world-compatibility-stub-detected');
const index=read('index.html');
for(const marker of ['20-Level Campaign','three-world-v1.js','campaign-v20-runtime.js','campaign-ui-v20.js','v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','player-state-v20.js'])if(!index.includes(marker))throw new Error(`index-production-marker-missing:${marker}`);
for(const stale of ['id="seed-man-level"','Seed Man: Sprout Run','Greenhouse Gauntlet','campaign-v1.js','gameplay-v2.js','combat-browser-v1.js','enemy-attacks-browser-v1.js'])if(index.includes(stale))throw new Error(`legacy-runtime-in-index:${stale}`);
for(const stale of ['readEmbeddedLevel','worldWidth !== 7800','pickups.length !== 24'])if(read('app.js').includes(stale))throw new Error(`legacy-bootstrap-code-present:${stale}`);
for(const stale of ['seed-man-approved-master-atlas-v1.webp','seed-man-cover-banner-approved-v1.webp'])if(read('approved-art-core-v1.js').includes(stale)||JSON.stringify(art).includes(stale))throw new Error(`retired-art-reference:${stale}`);
for(const stale of ['seed-man-signature-features-v1','nursery-night-shift','reservoir-run','root-zone-rumble','trichome-transit','weak-point stomps','power-ups'])if(read('input-guard-v1.js').includes(stale))throw new Error(`retired-input-runtime:${stale}`);
for(const retiredPhenotype of ['solar-flare','static-haze','frost-resin','hydro-surge','terpene-tempest','vine-lash','mycelium-mind','rootbreaker','trichome-crystal','gravity-haze'])if(read('combat-browser-v2.js').includes(retiredPhenotype))throw new Error(`retired-v20-phenotype:${retiredPhenotype}`);

console.log(JSON.stringify({ok:true,campaignId:campaign.id,levels:20,worlds:5,bosses:6,enemies:10,phenotypeCarriers:3,finalBoss:'blight-king',approvedArt:true,worldRenderer:'seed-man-three-world-v2',playerState:'v20',combatRuntime:'v2',inputGuard:'v20',legacySproutRunRemoved:true,corruptAssetsRemoved:true,retiredArtifactsRemoved:retired.length}));