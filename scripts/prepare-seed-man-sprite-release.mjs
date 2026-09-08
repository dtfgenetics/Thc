import fs from 'node:fs';

const indexPath='site/public-route-patch/games/seed-man-platformer/index.html';
const publisherPath='scripts/publish-seed-man-route-via-wordpress.mjs';
const productionArtPath='site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js';
const approvedAtlasPath='site/public-route-patch/games/seed-man-platformer/assets/approved/seed-man-approved-master-atlas-v1.webp';
const approvedCoverPath='site/public-route-patch/games/seed-man-platformer/assets/approved/seed-man-cover-banner-approved-v1.webp';
const campaignPath='site/public-route-patch/games/seed-man-platformer/data/campaign.json';
const levels20Path='site/public-route-patch/games/seed-man-platformer/data/levels-20-v1.json';
const bossCatalogPath='site/public-route-patch/games/seed-man-platformer/data/boss-catalog-v1.json';
const enemyCatalogPath='site/public-route-patch/games/seed-man-platformer/data/enemy-catalog-v1.json';
const legacyRuntimePath='site/public-route-patch/games/seed-man-platformer/seed-man-sprite-runtime-v1.js';
const legacyAtlasPath='site/public-route-patch/games/seed-man-platformer/assets/seed-man/seed-man-atlas-v1.svg';
const runtimePath='site/public-route-patch/games/seed-man-platformer/seed-man-sprite-runtime-v2.js';
const atlasPath='site/public-route-patch/games/seed-man-platformer/assets/seed-man/seed-man-atlas-v2.svg';
const LEGACY_VERSION='seed-man-authored-atlas-v1';
const VERSION='seed-man-authored-atlas-v2';
const VISUAL_ENHANCEMENT='seed-man-sprite-motion-phenotype-v3';

for(const file of [indexPath,publisherPath,productionArtPath,approvedAtlasPath,approvedCoverPath,campaignPath,levels20Path,bossCatalogPath,enemyCatalogPath,legacyRuntimePath,legacyAtlasPath,runtimePath,atlasPath]){
  if(!fs.existsSync(file))throw new Error(`Missing Seed Man release input: ${file}`);
}

const productionArt=fs.readFileSync(productionArtPath,'utf8');
for(const marker of ['seed-man-approved-production-v4','approved-showcase-master-atlas-v1','green-armored-plant-hero','drawApprovedSeedMan','drawApprovedBackground','drawApprovedPlatforms','seedManRendererOwner']){
  if(!productionArt.includes(marker))throw new Error(`Approved Seed Man production renderer missing marker: ${marker}`);
}
const approvedAtlas=fs.readFileSync(approvedAtlasPath);
if(approvedAtlas.length<100000)throw new Error(`Approved Seed Man master atlas is unexpectedly small: ${approvedAtlas.length}`);
if(approvedAtlas.subarray(0,4).toString('ascii')!=='RIFF')throw new Error('Approved Seed Man master atlas is not a WebP/RIFF asset.');
if(fs.readFileSync(approvedCoverPath).length<20000)throw new Error('Approved Seed Man cover art is unexpectedly small.');

const campaign=JSON.parse(fs.readFileSync(campaignPath,'utf8'));
if(campaign.levelCount!==20||campaign.finalBoss!=='blight-king'||campaign.worlds?.length!==5)throw new Error('Seed Man production campaign must contain five worlds, 20 levels, and Blight King as final boss.');
const campaignLevels=campaign.worlds.flatMap(world=>world.levels||[]);
if(campaignLevels.length!==20)throw new Error(`Seed Man production campaign contains ${campaignLevels.length} levels instead of 20.`);
if(campaignLevels.at(-1)?.id!=='5-4-the-last-seed'||campaignLevels.at(-1)?.boss!=='blight-king'||campaignLevels.at(-1)?.phases!==4)throw new Error('Level 20 must be The Last Seed with four-phase Blight King.');
const levelPack=JSON.parse(fs.readFileSync(levels20Path,'utf8'));
if(levelPack.levels?.length!==20||levelPack.levels.at(-1)?.boss!=='blight-king')throw new Error('Seed Man 20-level metadata pack is incomplete.');
const bosses=JSON.parse(fs.readFileSync(bossCatalogPath,'utf8'));
if(!JSON.stringify(bosses).includes('blight-king'))throw new Error('Boss catalog is missing Blight King.');

const legacyRuntime=fs.readFileSync(legacyRuntimePath,'utf8');
for(const marker of ['seed-man-sprite-runtime-v1',LEGACY_VERSION,'rendererOwner'])if(!legacyRuntime.includes(marker))throw new Error(`Legacy sprite runtime missing marker: ${marker}`);
const runtime=fs.readFileSync(runtimePath,'utf8');
for(const marker of ['seed-man-sprite-runtime-v2',VERSION,VISUAL_ENHANCEMENT,'activePhenotype','drawElementalVfx','approvedRendererAvailable','__SPROUT_SPRITE_RUNTIME_V2__'])if(!runtime.includes(marker))throw new Error(`Sprite v2 runtime missing marker: ${marker}`);
if(!runtime.includes("document.documentElement.dataset.seedManRendererOwner = 'seed-man-production-v1'"))throw new Error('Legacy sprite runtime must yield renderer ownership to approved production art.');
if(/if\s*\(phenotype\)\s*return\s+phenotype/.test(runtime))throw new Error('Phenotype state may not replace movement animation.');

let index=fs.readFileSync(indexPath,'utf8');
const release=index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if(!release)throw new Error('Could not resolve Seed Man release marker.');
const legacyScript=`  <script src="./seed-man-sprite-runtime-v1.js?v=${release}" defer></script>`;
const spriteScript=`  <script src="./seed-man-sprite-runtime-v2.js?v=${release}" defer></script>`;
if(!index.includes(legacyScript)||!index.includes(spriteScript))throw new Error('Seed Man index must retain compatibility sprite runtimes after production-art renderer.');
index=index
  .replace('<title>Seed Man: Greenhouse Gauntlet | DTF Genetics</title>','<title>Seed Man: Grow. Fight. Restore. | DTF Genetics</title>')
  .replace(/spanning five worlds and 15 levels/g,'spanning five worlds and 20 levels')
  .replace(/15-Level Campaign/g,'20-Level Campaign')
  .replace(/LIVE UI · 15 LEVELS/g,'LIVE UI · 20 LEVELS')
  .replace(/<strong>15 levels<\/strong>/g,'<strong>20 levels</strong>')
  .replace('Greenhouse District, Rootworks, Resin Works, Sky Garden and Genetic Frontier','Greenhouse Valley, Forest Ruins, Desert Canyon, Frozen Peaks and Eco City')
  .replace('survive six boss encounters','survive world bosses and the four-phase Blight King finale');
fs.writeFileSync(indexPath,index);

let publisher=fs.readFileSync(publisherPath,'utf8');
const releaseEntries=[
  "  'seed-man-sprite-runtime-v1.js',",
  "  'assets/seed-man/seed-man-atlas-v1.svg',",
  "  'seed-man-sprite-runtime-v2.js',",
  "  'assets/seed-man/seed-man-atlas-v2.svg',",
  "  'assets/approved/seed-man-approved-master-atlas-v1.webp',",
  "  'assets/approved/seed-man-cover-banner-approved-v1.webp',",
  "  'data/levels-20-v1.json',",
  "  'data/boss-catalog-v1.json',",
  "  'data/enemy-catalog-v1.json',"
];
const publisherAnchor="  'seed-man-production-art.js',";
if(!publisher.includes(publisherAnchor))throw new Error('Could not locate Seed Man publisher art anchor.');
const missingEntries=releaseEntries.filter(entry=>!publisher.includes(entry));
if(missingEntries.length){publisher=publisher.replace(publisherAnchor,`${publisherAnchor}\n${missingEntries.join('\n')}`);fs.writeFileSync(publisherPath,publisher);}

index=fs.readFileSync(indexPath,'utf8');publisher=fs.readFileSync(publisherPath,'utf8');
for(const stale of ['15-Level Campaign','LIVE UI · 15 LEVELS','<strong>15 levels</strong>'])if(index.includes(stale))throw new Error(`Retired Seed Man campaign copy remains: ${stale}`);
for(const marker of ['20-Level Campaign','LIVE UI · 20 LEVELS','<strong>20 levels</strong>','Frozen Peaks','Eco City'])if(!index.includes(marker))throw new Error(`Seed Man 20-level page copy missing marker: ${marker}`);
for(const entry of releaseEntries)if(!publisher.includes(entry))throw new Error(`Seed Man publisher missing required release file: ${entry}`);

console.log(JSON.stringify({ok:true,approvedArt:true,characterContract:'green-armored-plant-hero',visualPipeline:'approved-showcase-master-atlas-v1',campaignLevels:20,worlds:5,finalBoss:'blight-king',finalBossPhases:4,compatibilitySpriteRuntime:VERSION,release,publishedFiles:releaseEntries.map(x=>x.trim().replace(/[',]/g,''))},null,2));
