import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const rel = (...parts) => path.join(root, ...parts);
const readJson = (...parts) => JSON.parse(fs.readFileSync(rel(...parts), 'utf8'));
const readText = (...parts) => fs.readFileSync(rel(...parts), 'utf8');

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full)); else out.push(full);
  }
  return out;
}

const gameRoot=['games','seed-man-platformer'];
const publicRoot=['site','public-route-patch','games','seed-man-platformer'];
const audit = readJson(...gameRoot,'data','seed-man-production-audit-v1.json');
const game = readJson(...gameRoot,'game.json');
const art = readJson(...gameRoot,'data','seed-man-art-manifest-v1.json');
const levels = readJson(...gameRoot,'data','levels-20-v1.json');
const recipes = readJson(...gameRoot,'data','authored-level-recipes-v1.json');
const worlds = readJson(...gameRoot,'data','world-gameplay-v1.json');
const powerups = readJson(...gameRoot,'data','powerup-catalog-v1.json');
const publicRecipes = readJson(...publicRoot,'data','authored-level-recipes-v1.json');
const publicWorlds = readJson(...publicRoot,'data','world-gameplay-v1.json');
const publicPowerups = readJson(...publicRoot,'data','powerup-catalog-v1.json');
const sm001 = readJson('data','game-asset-batches','SM-001.json');
const renderer = readText(...publicRoot,'seed-man-production-art.js');
const campaignRuntime = readText(...publicRoot,'campaign-v20-runtime.js');
const hazardRuntime = readText(...gameRoot,'src','systems','hazard-system.mjs');
const encounterRuntime = readText(...gameRoot,'src','systems','encounter-director.mjs');

const assetRoot = rel(...publicRoot,'assets');
const allAssetFiles = walkFiles(assetRoot).map((file) => path.relative(assetRoot, file).split(path.sep).join('/'));
const approvedBinaryFiles = allAssetFiles.filter((file) => file.startsWith('approved/') && /\.(?:webp|png|avif|jpg|jpeg)$/i.test(file));
const worldArtFiles = allAssetFiles.filter((file) => /(?:greenhouse|forest|desert|frozen|eco-city|world)/i.test(file));
const worldRendererKeys = Object.entries(art.assets || {}).filter(([key, value]) => key.startsWith('world.') && value?.renderer);
const explicitLayouts=(levels.levels||[]).filter((level)=>level.layout&&level.layout.mode==='authored').length;
const recipeCount=Object.keys(recipes.levels||{}).length;
const layerKeys=Object.values(worlds.worlds||{}).flatMap((world)=>Object.values(world.layerAssetKeys||{}));

const checks = [];
function check(id, ok, severity, message, details = undefined) {
  checks.push({ id, ok: Boolean(ok), severity, message, ...(details === undefined ? {} : { details }) });
}

check('identity-target-vs-runtime',game.visualSourceOfTruth?.character === audit.identity?.lockedTarget,'critical','Runtime character identity must match the locked production target.',{lockedTarget:audit.identity?.lockedTarget,currentRuntime:game.visualSourceOfTruth?.character});
check('sm001-ten-assets-defined',Array.isArray(sm001.assets)&&sm001.assets.length===10,'critical','SM-001 must define exactly ten canonical reference masters.',{defined:sm001.assets?.length??0});
check('sm001-approved-complete',Array.isArray(sm001.assets)&&sm001.assets.length===10&&sm001.assets.every((asset)=>asset.state==='APPROVED'),'critical','All SM-001 canonical reference masters must be approved before player-art replacement.',{states:sm001.assets?.map((asset)=>({assetId:asset.assetId,state:asset.state}))??[]});
check('approved-binary-assets-match-audit',approvedBinaryFiles.length===audit.observedRuntimeAssets?.approvedBinaryCount,'high','Observed approved runtime binary count must match the audit manifest.',{expected:audit.observedRuntimeAssets?.approvedBinaryCount,observed:approvedBinaryFiles.length,files:approvedBinaryFiles});
check('phenotype-full-motion-runtime',!renderer.includes("if(phenotype!=='plant')return APPROVED_CELLS[phenotype];"),'high','Non-plant phenotypes must preserve the full motion/action state family instead of collapsing to one static phenotype cell.');
check('authored-world-art-files',worldArtFiles.length>=5,'high','Five authored world-art kits must exist as files; renderer-only manifest keys are not authored art.',{rendererWorldKeys:worldRendererKeys.length,authoredWorldArtFiles:worldArtFiles});
check('all-levels-authored',Number(game.campaign?.generatedLevels||0)===0&&Number(game.campaign?.authoredLevels||0)===Number(game.campaign?.levels||0),'high','Game contract must report all 20 campaign levels authored.',{authored:game.campaign?.authoredLevels,generated:game.campaign?.generatedLevels,total:game.campaign?.levels});
check('authored-level-recipe-coverage',explicitLayouts+recipeCount===Number(game.campaign?.levels||0),'high','Explicit layouts plus authored recipes must cover all campaign levels.',{explicitLayouts,recipeCount,total:game.campaign?.levels});
check('public-authored-data-parity',JSON.stringify(recipes)===JSON.stringify(publicRecipes)&&JSON.stringify(worlds)===JSON.stringify(publicWorlds)&&JSON.stringify(powerups)===JSON.stringify(publicPowerups),'high','Public route authored recipes/world/powerups must exactly match canonical data.');
check('public-authored-runtime',campaignRuntime.includes('authored-level-recipes-v1.json')&&campaignRuntime.includes('function compileAuthoredRecipe(')&&campaignRuntime.includes('generatedLevelCount')&&campaignRuntime.includes('authoredLevelCount'),'high','Public campaign runtime must load/compile authored recipes and report authored/generated counts.');
check('five-world-layer-contract',Object.keys(worlds.worlds||{}).length===5&&layerKeys.length===35&&layerKeys.every((key)=>Boolean(art.assets?.[key])),'high','Five worlds must each expose seven manifest-backed visual layers.',{worlds:Object.keys(worlds.worlds||{}).length,layerKeys:layerKeys.length});
check('phenotype-powerup-contract',Object.keys(powerups.forms||{}).sort().join(',')==='electric,fire,ice,plant','high','Plant, Fire, Electric and Ice power forms must exist in the powerup catalog.');
check('hazard-runtime-present',hazardRuntime.includes('HAZARD_DEFS')&&hazardRuntime.includes('energy-beam')&&hazardRuntime.includes('toxic-slime'),'high','Data-driven hazard runtime must cover campaign hazards.');
check('encounter-runtime-present',encounterRuntime.includes('instantiateLevelEnemies')&&encounterRuntime.includes('instantiateLevelBosses'),'high','Enemy/carrier/boss encounter director must be present.');
check('desktop-playtest-gate',game.releaseGates?.['browser-desktop-playtest-v20']===true,'high','Desktop browser playtest gate must be true.');
check('mobile-playtest-gate',game.releaseGates?.['browser-mobile-playtest-v20']===true,'high','Mobile browser playtest gate must be true.');
check('human-visual-review-gate',game.releaseGates?.['human-final-visual-review']===true,'high','Human final visual review must be complete.');
check('release-candidate-gate',game.releaseGates?.['release-candidate']===true,'high','Seed Man must not be reported as a release candidate until production gates are complete.');

const failures=checks.filter((entry)=>!entry.ok);
const critical=failures.filter((entry)=>entry.severity==='critical');
const high=failures.filter((entry)=>entry.severity==='high');
const summary={
  gameId:audit.gameId,auditDate:new Date().toISOString().slice(0,10),strict,
  assets:{observedAssetFiles:allAssetFiles.length,approvedBinaryFiles:approvedBinaryFiles.length,authoredWorldArtFiles:worldArtFiles.length,plannedProductionBatches:audit.plannedVisualProduction?.batchCount??23},
  campaign:{levels:game.campaign?.levels,authoredLevels:game.campaign?.authoredLevels,generatedLevels:game.campaign?.generatedLevels,explicitLayouts,authoredRecipes:recipeCount,publicAuthoredRuntime:campaignRuntime.includes('authored-level-recipes-v1.json')},
  gameplay:{worlds:Object.keys(worlds.worlds||{}).length,worldLayerContracts:layerKeys.length,powerForms:Object.keys(powerups.forms||{}),hazardRuntime:true,encounterDirector:true},
  identity:{lockedTarget:audit.identity?.lockedTarget,currentRuntime:game.visualSourceOfTruth?.character},
  result:{checks:checks.length,passed:checks.length-failures.length,failed:failures.length,critical:critical.length,high:high.length,productionComplete:failures.length===0},
  failures,checks
};

console.log(JSON.stringify(summary,null,2));
if(strict&&failures.length>0)process.exitCode=1;
