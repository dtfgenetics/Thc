import dns from 'node:dns';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

export async function ensureCanonicalLearnRoot({
  siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,''),
  username=process.env.WP_API_USERNAME||'',
  password=process.env.WP_API_PASSWORD||'',
  sourcePath='site/wordpress/pages/learn.html',
  fetchImpl=fetch
}={}){
  if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
  const auth='Basic '+Buffer.from(username+':'+password).toString('base64');
  const headers={Authorization:auth,Accept:'application/json','Content-Type':'application/json','User-Agent':'DTFSeeds-Learn-Root-Repair/1.0'};

  async function request(path,options={}){
    const method=String(options.method||'GET').toUpperCase();
    const max=method==='GET'?6:3;
    let last;
    for(let attempt=1;attempt<=max;attempt+=1){
      try{
        const response=await fetchImpl(siteUrl+path,{
          ...options,
          headers:{...headers,...(options.headers||{})},
          redirect:'follow',
          signal:AbortSignal.timeout(30_000)
        });
        const raw=await response.text();
        let body=null;
        try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
        if(!response.ok){
          const error=new Error(method+' '+path+' failed ('+response.status+'): '+String(typeof body==='string'?body:JSON.stringify(body)).slice(0,500));
          error.status=response.status;
          throw error;
        }
        return body;
      }catch(error){
        last=error;
        const transient=!error?.status||error.status===408||error.status===425||error.status===429||error.status>=500;
        if(!transient||attempt===max) throw error;
        await sleep(Math.min(6000,attempt*900));
      }
    }
    throw last;
  }

  async function rows(){
    const result=await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=100');
    if(!Array.isArray(result)) throw new Error('WordPress Learn lookup returned an invalid response');
    if(result.length>1) throw new Error('Multiple canonical Learn candidates exist; refusing automatic repair');
    return result;
  }

  let found=await rows();
  if(found.length===1){
    let page=found[0];
    const needsRepair=Number(page.parent)!==0||page.slug!=='learn'||page.status!=='publish';
    if(needsRepair){
      page=await request('/wp-json/wp/v2/pages/'+page.id,{
        method:'POST',
        body:JSON.stringify({slug:'learn',parent:0,status:'publish'})
      });
    }
    return {pageId:Number(page.id),action:needsRepair?'repaired':'reused',status:page.status??'publish'};
  }

  const source=await readFile(sourcePath,'utf8');
  if(!source.includes('<h1')||!source.includes('Teaching Healthy Cultivation')){
    throw new Error('Canonical Learn source file failed content sanity checks');
  }

  try{
    await request('/wp-json/wp/v2/pages',{
      method:'POST',
      body:JSON.stringify({
        slug:'learn',
        title:'Teaching Healthy Cultivation',
        parent:0,
        content:source,
        status:'publish'
      })
    });
  }catch(error){
    // A create response can fail after WordPress committed the write. Re-read before retrying/failing.
    found=await rows();
    if(found.length!==1) throw error;
  }

  found=await rows();
  if(found.length!==1) throw new Error('Canonical Learn root was not recoverable after create');
  const page=found[0];
  if(Number(page.parent)!==0||page.slug!=='learn'||page.status!=='publish'){
    throw new Error('Recovered Learn root does not satisfy canonical root requirements');
  }
  return {pageId:Number(page.id),action:'created',status:page.status};
}

async function main(){
  try{
    const result=await ensureCanonicalLearnRoot();
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){
    process.stderr.write('ensure-wordpress-learn-root: '+error.message+'\n');
    process.exitCode=1;
  }
}

if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith('/'+process.argv[1].replaceAll('\\','/').split('/').pop())){
  await main();
}
