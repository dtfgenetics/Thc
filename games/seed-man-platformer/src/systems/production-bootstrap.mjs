import { createProductionAssets } from './production-assets.mjs';

async function fetchJson(fetchImpl,url){const response=await fetchImpl(url,{cache:'no-store'});if(!response.ok)throw new Error(`Seed Man production data failed: ${url} (${response.status})`);return response.json();}

export async function bootstrapProductionGame({baseUrl='./',fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=='function')throw new Error('Seed Man production bootstrap requires fetch');
  const [manifest,levels,enemies,bosses,campaign]=await Promise.all([
    fetchJson(fetchImpl,`${baseUrl}data/seed-man-art-manifest-v1.json`),
    fetchJson(fetchImpl,`${baseUrl}data/levels-20-v1.json`),
    fetchJson(fetchImpl,`${baseUrl}data/enemy-catalog-v1.json`),
    fetchJson(fetchImpl,`${baseUrl}data/boss-catalog-v1.json`),
    fetchJson(fetchImpl,`${baseUrl}data/campaign-20-v1.json`)
  ]);
  const assets=createProductionAssets({manifest,levels,enemies,bosses,baseUrl});
  return Object.freeze({campaign,manifest,levels,enemies,bosses,assets});
}
