import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const sourcePath=process.env.GALLERY_SOURCE||join(process.cwd(),'site/wordpress/pages/gallery.html');
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-gallery-v2';
const apply=String(process.env.APPLY_GALLERY_V2||'').toLowerCase()==='true';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const content=await readFile(sourcePath,'utf8');
for(const marker of [
  'data-dtf-layout="gallery-visual-v2"',
  'Approved visuals only.',
  'Browse by destination.',
  '/seeds/',
  '/learn/',
  '/games/',
  '/tools/',
  '/community/',
  '/shop/'
]){
  if(!content.includes(marker)) throw new Error(`Gallery source missing required marker: ${marker}`);
}

// Fail closed: Gallery V2 intentionally ships without image tags until each
// visual has explicit role-specific approval. This prevents a publisher from
// restoring the retired infographic wall merely to satisfy an image-count goal.
if(/<img\b/i.test(content)) throw new Error('Gallery V2 source contains image markup; explicit visual approval is required before Gallery images can be published.');
for(const forbidden of [
  'DTF Visual Library',
  'Cannabis plant anatomy educational infographic',
  'Nutrient uptake and root-zone chemistry infographic',
  'Beneficial insects and biological controls infographic',
  'Deficiency versus toxicity cannabis diagnostic infographic',
  'Cannabis plant life cycle infographic',
  'Cannabis nutrition science infographic',
  'Air VPD versus leaf VPD visual reference'
]){
  if(content.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Gallery V2 source still contains retired visual content: ${forbidden}`);
}

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Gallery-V2/2.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`gallery-v2-${stamp}`);
await mkdir(backupDir,{recursive:true});
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=7;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{
        ...options,
        headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
        redirect:'follow',signal:AbortSignal.timeout(60_000)
      });
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
      if((response.status===429||response.status>=500)&&attempt<7){await sleep(attempt*1800);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){
      lastError=error;
      if(attempt<7){await sleep(attempt*1800);continue;}
    }
  }
  throw lastError;
}

const rows=await request('/wp-json/wp/v2/pages?slug=gallery&context=edit&status=publish&per_page=10');
if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected exactly one published Gallery page; saw ${Array.isArray(rows)?rows.length:'invalid response'}`);
const page=rows[0];
await writeFile(join(backupDir,`page-${page.id}-gallery-before.json`),`${JSON.stringify(page,null,2)}\n`);

let updated=page;
if(apply){
  updated=await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
}

const storedRows=await request('/wp-json/wp/v2/pages?slug=gallery&context=edit&status=publish&per_page=10');
const stored=Array.isArray(storedRows)?storedRows[0]:null;
const storedContent=typeof stored?.content==='string'?stored.content:(stored?.content?.raw||stored?.content?.rendered||'');
if(apply){
  if(!storedContent.includes('data-dtf-layout="gallery-visual-v2"')) throw new Error('Stored Gallery does not expose the V2 owner marker after publish.');
  if(/<img\b/i.test(storedContent)) throw new Error('Stored Gallery unexpectedly contains image markup after clean V2 publish.');
}

const report={
  generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,pageId:Number(page.id),
  status:updated?.status||page.status,marker:'gallery-visual-v2',imagePolicy:'approved-only-image-less-fallback',
  storedVerification:apply?'success':'not-applied'
};
await writeFile(join(backupDir,'gallery-v2-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'gallery-v2-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
