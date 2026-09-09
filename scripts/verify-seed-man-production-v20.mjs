import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('site/public-route-patch/games/seed-man-platformer');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const exists=(rel)=>fs.existsSync(path.join(root,rel));
const requireFile=(rel)=>{const p=path.join(root,rel);if(!exists(rel)||fs.statSync(p).size===0)throw new Error(`Missing production file: ${rel}`);return p;};
const requireWebp=(rel)=>{const p=requireFile(rel);const b=fs.readFileSync(p);if(b.subarray(0,4).toString('ascii')!=='RIFF'||b.subarray(8,12).toString('ascii')!=='WEBP')throw new Error(`Invalid WebP asset: ${rel}`);return b.length;};

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
  'data/level-01.json','data/levels-12-15.json','campaign-v1.js','gameplay-v2.js','physics.mjs','campaign-combat-v20.js','campaign-progress-v20.js','campaign-runtime-v20.js',
  'campaign-ui-v15.js','world-five-v1.js','combat-browser-v1.js','enemy-attacks-browser-v1.js','seed-man-ui-v3.js',
  'assets/approved/seed-man-approved-master-atlas-v1.webp','assets/approved/seed-man-cover-banner-approved-v1.webp'
];
for(const rel of retired)if(exists(rel))throw new Error(`Retired production artifact still exists: ${rel}`);

const campaign=JSON.parse(read('data/campaign.json'));
const levels=JSON.parse(read('data/levels-20-v1.json'));
const art=JSON.parse(read('data/seed-man-art-manifest-v1.json'));
const enemies=JSON.parse(read('data/enemy-catalog-v1.json'));
if(campaign.levelCount!==20||campaign.newLevelCount!==19||campaign.worlds?.length!==5)throw new Error('Seed Man campaign must be 20 levels across five worlds');
if(campaign.finalBoss!=='blight-king')throw new Error('Final boss contract must be blight-king');
if(levels.levels?.length!==20)throw new Error('Level catalog must contain 20 levels');
for(let i=1;i<=20;i+=1)if(!levels.levels.some((level)=>level.order===i))throw new Error(`Missing level order ${i}`);
const finale=levels.levels.find((level)=>level.order===20);
if(finale?.boss!=='blight-king'||!finale?.mechanics?.includes('final-gauntlet'))throw new Error('Level 20 finale contract is incomplete');
const expectedWorlds=['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];
if(JSON.stringify(campaign.worlds.map((world)=>world.visualWorldKey))!==JSON.stringify(expectedWorlds))throw new Error('Campaign visual-world ordering mismatch');
if(Object.keys(enemies.common||{}).length!==10||Object.keys(enemies.phenotypeCarriers||{}).length!==3)throw new Error('Enemy roster must contain 10 common enemies and 3 phenotype carriers');

if(art.schemaVersion!==3||art.id!=='seed-man-approved-art-v2'||art.sourceOfTruth!=='approved-showcase-2026-09-08')throw new Error('Approved art manifest identity mismatch');
if(art.masterAtlas)throw new Error('Corrupt master atlas must not exist in production art manifest');
if(art.policy?.characterReference!=='green-armored-plant-hero'||art.policy?.worldRenderer!=='seed-man-three-world-v2')throw new Error('Approved character/world renderer contract mismatch');
for(const key of ['character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas'])if(!art.assets?.[key]?.src)throw new Error(`Missing standalone approved image asset: ${key}`);
for(const world of expectedWorlds){const asset=art.assets?.[`world.${world}.background`];if(asset?.renderer!=='seed-man-three-world-v2'||asset?.world!==world)throw new Error(`Missing renderer-backed world: ${world}`);}
for(const form of ['plant','fire','electric','ice'])if(!art.phenotypes?.includes(form))throw new Error(`Missing phenotype form: ${form}`);

const index=read('index.html');
for(const marker of ['20-Level Campaign','three-world-v1.js','campaign-v20-runtime.js','campaign-ui-v20.js','v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','player-state-v20.js'])if(!index.includes(marker))throw new Error(`Public index missing production marker: ${marker}`);
for(const stale of ['id="seed-man-level"','Seed Man: Sprout Run','Greenhouse Gauntlet','campaign-v1.js','gameplay-v2.js','combat-browser-v1.js','enemy-attacks-browser-v1.js'])if(index.includes(stale))throw new Error(`Legacy public marker remains: ${stale}`);

const app=read('app.js');
for(const marker of ['seed-man-base-runtime-v20',"campaignAuthority:'campaign-v20-runtime.js'",'level.boss && !level.boss.defeated'])if(!app.includes(marker))throw new Error(`Base runtime missing marker: ${marker}`);
for(const stale of ['readEmbeddedLevel','candidate.id !== \'sprout-run\'','worldWidth !== 7800','pickups.length !== 24'])if(app.includes(stale))throw new Error(`Legacy Sprout Run authority remains: ${stale}`);

const three=read('three-world-v1.js');
if(!three.includes('SeedManThreeWorld')||!three.includes('seed-man-three-public-v3')||!three.includes('seed-man-three-world-v2'))throw new Error('Public Three.js world bundle is not the generated v3 production bundle');
if(fs.statSync(path.join(root,'three-world-v1.js')).size<250000)throw new Error('Public Three.js world bundle is unexpectedly small; compatibility stub detected');
const bootstrap=read('canvas-compat-v1.js');
for(const marker of ['seed-man-runtime-bootstrap-v20','three-world-adapter-v1.js','seed-man-three-public-v3','player-state-v20.js'])if(!bootstrap.includes(marker))throw new Error(`Runtime bootstrap missing marker: ${marker}`);

const core=read('approved-art-core-v1.js');
for(const marker of ['seed-man-approved-art-core-v4','seed-man-character-atlas-v2.webp','seed-man-enemy-boss-atlas-v1.webp','seed-man-platform-atlas-v1.webp',"worldRenderer:'seed-man-three-world-v2'"])if(!core.includes(marker))throw new Error(`Approved art core missing marker: ${marker}`);
if(core.includes('seed-man-approved-master-atlas-v1.webp'))throw new Error('Corrupt master atlas remains in public art core');
const renderer=read('seed-man-production-art.js');
for(const marker of ['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false'])if(!renderer.includes(marker))throw new Error(`Approved renderer missing marker: ${marker}`);
const combat=read('combat-browser-v2.js');
for(const marker of ['seed-man-combat-browser-v2','syncBossState','seedman:boss-defeated'])if(!combat.includes(marker))throw new Error(`Combat runtime missing progression marker: ${marker}`);
for(const retiredPhenotype of ['solar-flare','static-haze','frost-resin','hydro-surge','terpene-tempest','vine-lash','mycelium-mind','rootbreaker','trichome-crystal','gravity-haze'])if(combat.includes(retiredPhenotype))throw new Error(`Retired phenotype remains: ${retiredPhenotype}`);
if(!read('player-state-v20.js').includes('seed-man-player-state-v20'))throw new Error('Canonical player-state-v20 marker is missing');
if(!read('v20-enemy-runtime.js').includes('seed-man-v20-enemy-runtime-v2'))throw new Error('Canonical v20 enemy runtime marker is missing');
if(!read('enemy-attacks-browser-v2.js').includes('seed-man-enemy-attacks-browser-v2'))throw new Error('Canonical enemy attack runtime marker is missing');

console.log(JSON.stringify({ok:true,levels:20,worlds:5,bosses:6,enemies:10,phenotypeCarriers:3,finalBoss:'blight-king',approvedArt:true,worldRenderer:'seed-man-three-world-v2',playerState:'v20',combatRuntime:'v2',legacySproutRunRemoved:true,corruptAssetsRemoved:true,retiredArtifactsRemoved:retired.length}));
