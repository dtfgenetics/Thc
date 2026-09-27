import { runLoadTasks } from '../../../shared-platform/src/loading.mjs';
import { createProductionAssets } from './production-assets.mjs';

async function fetchJson(fetchImpl,url){const response=await fetchImpl(url,{cache:'no-store'});if(!response.ok)throw new Error(`Seed Man production data failed: ${url} (${response.status})`);return response.json();}

export async function bootstrapProductionGame({
  baseUrl='./',
  fetchImpl=globalThis.fetch,
  onProgress=null,
  retries=1,
}={}){
  if(typeof fetchImpl!=='function')throw new Error('Seed Man production bootstrap requires fetch');

  const resources=[
    ['manifest','seed-man-art-manifest-v1.json'],
    ['levels','levels-20-v1.json'],
    ['enemies','enemy-catalog-v1.json'],
    ['bosses','boss-catalog-v1.json'],
    ['campaign','campaign-20-v1.json'],
    ['recipes','authored-level-recipes-v1.json'],
    ['worlds','world-gameplay-v1.json'],
    ['powerups','powerup-catalog-v1.json'],
  ];

  const loaded=await runLoadTasks(resources.map(([id,file])=>({
    id,
    load:()=>fetchJson(fetchImpl,`${baseUrl}data/${file}`),
  })),{onProgress,retries});

  const manifest=loaded.get('manifest');
  const levels=loaded.get('levels');
  const enemies=loaded.get('enemies');
  const bosses=loaded.get('bosses');
  const campaign=loaded.get('campaign');
  const recipes=loaded.get('recipes');
  const worlds=loaded.get('worlds');
  const powerups=loaded.get('powerups');
  const assets=createProductionAssets({manifest,levels,enemies,bosses,recipes,worlds,powerups,baseUrl});
  return Object.freeze({campaign,manifest,levels,enemies,bosses,recipes,worlds,powerups,assets});
}
