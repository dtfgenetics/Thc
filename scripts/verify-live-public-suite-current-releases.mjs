const baseUrl = String(process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/+$/, '');
const attemptCount = Number(process.env.DTF_LIVE_VERIFY_ATTEMPTS || 6);
const retryDelayMs = Number(process.env.DTF_LIVE_VERIFY_DELAY_MS || 5000);
const runId = process.env.GITHUB_RUN_ID || Date.now();

const routes = [
  {
    path: '/games/high-land/',
    markers: ['High Land: The Sweet Escape'],
    cssMarkers: ['--hl-lime', '#c8ff62']
  },
  {
    path: '/games/high-life/',
    markers: ['From Bagseed to Legacy', '18 TURN RUN']
  },
  {
    path: '/games/grower-conversations/',
    markers: ['Grower Conversations', '96-card community deck']
  },
  {
    path: '/games/seed-man-platformer/',
    markers: [
      'data-seed-man-release="20260909-v20-runtime-v4"',
      'data-seed-ui-release="20260909-v20-runtime-v5"',
      'data-seed-man-approved-art="approved-showcase-2026-09-08"',
      'LIVE UI · 20 LEVELS · APPROVED ART · THREE.JS WORLDS · PHENOTYPE COMBAT',
      './three-world-v1.js?v=',
      './campaign-v20-runtime.js?v=',
      './three-world-adapter-v1.js?v=',
      './combat-browser-v2.js?v='
    ],
    forbiddenMarkers: ['id="seed-man-level"','Seed Man: Sprout Run','Greenhouse Gauntlet','combat-browser-v1.js','enemy-attacks-browser-v1.js'],
    assets: [
      { path: 'app.js', markers: ['seed-man-base-runtime-v20', "campaignAuthority:'campaign-v20-runtime.js'", 'level.boss && !level.boss.defeated'], forbiddenMarkers: ['readEmbeddedLevel','worldWidth !== 7800'] },
      { path: 'player-state-v20.js', markers: ['seed-man-player-state-v20'] },
      { path: 'campaign-v20-runtime.js', markers: ['seed-man-campaign-v20-runtime-v3', "phenotypeForms:['plant','fire','electric','ice']"] },
      { path: 'combat-browser-v2.js', markers: ['seed-man-combat-browser-v2','syncBossState','seedman:boss-defeated'] },
      { path: 'approved-art-core-v1.js', markers: ['seed-man-approved-art-core-v4','seed-man-character-atlas-v2.webp','world.greenhouse-valley.background','world.eco-city.background'], forbiddenMarkers: ['seed-man-approved-master-atlas-v1.webp'] },
      { path: 'three-world-v1.js', markers: ['SeedManThreeWorld','seed-man-three-public-v3','seed-man-three-world-v2'], minBytes: 250000 },
      { path: 'three-world-adapter-v1.js', markers: ['seed-man-three-adapter-v2'] },
      { path: 'seed-man-production-art.js', markers: ['approved-showcase-2026-09-08', 'green-armored-plant-hero','fallbackAllowed:false'] },
      { path: 'canvas-compat-v1.js', markers: ['seed-man-runtime-health-v20','legacyDynamicLoader: false','legacyCanvasMonkeyPatch: false'], forbiddenMarkers: ['loadScript(','HTMLCanvasElement?.prototype','proto.getContext='] }
    ],
    missingAssets: [
      'data/level-01.json',
      'assets/approved/seed-man-approved-master-atlas-v1.webp',
      'assets/approved/seed-man-cover-banner-approved-v1.webp',
      'campaign-v1.js','gameplay-v2.js','combat-browser-v1.js','enemy-attacks-browser-v1.js'
    ]
  },
  {
    path: '/games/phenoquest/',
    markers: ['PhenoQuest: The Living Seed Vault','./experience-v2.css','./experience-v2.js'],
    assets: [
      { path: 'experience-v2.js', markers: ['deriveFirstSessionProgress','PhenoQuest guided first-session experience initialized.'] },
      { path: 'experience-v2.css', markers: ['.first-session-guide','prefers-reduced-motion'] },
      { path: '_runtime/src/engine/game-state.js', markers: ['export function setStarterChoice','export function addStoredUnit'] }
    ]
  },
  { path: '/games/weedopolis/', markers: ['Weedopolis'] },
  { path: '/games/crossword/', markers: ['Crossword'] }
];

function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
function extractStylesheets(html,pageUrl){return [...html.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match)=>new URL(match[1],pageUrl).toString());}
async function fetchNoRedirect(url,accept='text/html,application/xhtml+xml'){
  return fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache',Accept:accept},signal:AbortSignal.timeout(20000)});
}
function assertDirectSuccess(response,label){
  if(response.status>=300&&response.status<400)throw new Error(`${label} redirected with HTTP ${response.status} to ${response.headers.get('location')||'<unknown>'}`);
  if(response.status!==200)throw new Error(`${label} returned HTTP ${response.status}`);
}
async function verifyAsset(route,asset){
  const assetUrl=new URL(asset.path,`${baseUrl}${route.path}`);assetUrl.searchParams.set('dtf_current_release_verify',String(runId));
  const response=await fetchNoRedirect(assetUrl.toString(),'*/*');assertDirectSuccess(response,`${route.path}${asset.path}`);
  const body=await response.text();
  if(asset.minBytes&&Buffer.byteLength(body)<asset.minBytes)throw new Error(`${route.path}${asset.path} is too small (${Buffer.byteLength(body)} bytes)`);
  for(const marker of asset.markers||[])if(!body.includes(marker))throw new Error(`${route.path}${asset.path} is missing asset marker '${marker}'`);
  for(const marker of asset.forbiddenMarkers||[])if(body.includes(marker))throw new Error(`${route.path}${asset.path} still contains retired marker '${marker}'`);
}
async function verifyMissingAsset(route,assetPath){
  const assetUrl=new URL(assetPath,`${baseUrl}${route.path}`);assetUrl.searchParams.set('dtf_current_release_verify',String(runId));
  const response=await fetchNoRedirect(assetUrl.toString(),'*/*');
  if(![404,410].includes(response.status))throw new Error(`${route.path}${assetPath} should be retired but returned HTTP ${response.status}`);
}
async function verifyRoute(route){
  const url=`${baseUrl}${route.path}?dtf_current_release_verify=${encodeURIComponent(runId)}`;
  let lastError=null;
  for(let attempt=1;attempt<=attemptCount;attempt+=1){
    try{
      const response=await fetchNoRedirect(url);assertDirectSuccess(response,route.path);
      const contentType=response.headers.get('content-type')||'';if(!contentType.toLowerCase().includes('text/html'))throw new Error(`returned unexpected content-type '${contentType}'`);
      const html=await response.text();
      for(const marker of route.markers)if(!html.toLowerCase().includes(marker.toLowerCase()))throw new Error(`missing page marker '${marker}'`);
      for(const marker of route.forbiddenMarkers||[])if(html.toLowerCase().includes(marker.toLowerCase()))throw new Error(`retired page marker still present '${marker}'`);
      if(route.cssMarkers?.length){
        const stylesheets=extractStylesheets(html,url);if(!stylesheets.length)throw new Error('did not expose a stylesheet for V2 UI verification');
        let matched=false;
        for(const stylesheet of stylesheets){const cssResponse=await fetch(stylesheet,{headers:{'Cache-Control':'no-cache, no-store, max-age=0'},signal:AbortSignal.timeout(20000)});if(!cssResponse.ok)continue;const css=await cssResponse.text();if(route.cssMarkers.every((marker)=>css.includes(marker))){matched=true;break;}}
        if(!matched)throw new Error(`stylesheets did not contain V2 markers: ${route.cssMarkers.join(', ')}`);
      }
      for(const asset of route.assets||[])await verifyAsset(route,asset);
      for(const assetPath of route.missingAssets||[])await verifyMissingAsset(route,assetPath);
      console.log(`PASS ${route.path} (attempt ${attempt})`);return;
    }catch(error){lastError=error;console.warn(`Attempt ${attempt}/${attemptCount} failed for ${route.path}: ${error.message}`);if(attempt<attemptCount)await sleep(retryDelayMs);}
  }
  throw new Error(`${route.path} did not converge to its current release: ${lastError?.message||'unknown error'}`);
}

const failures=[];
for(const route of routes){try{await verifyRoute(route);}catch(error){failures.push(error.message);}}
if(failures.length){console.error(`Current public-suite release verification failed (${failures.length}):`);for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log(`Current public-suite release verification passed for ${routes.length} routes.`);
