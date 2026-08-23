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
for(const marker of ['dtf-gallery-v2','DTF Visual Library','/learn/infographics/']){
  if(!content.includes(marker)) throw new Error(`Gallery source missing required marker: ${marker}`);
}

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Gallery-V2/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`gallery-v2-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{
    ...options,
    headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
    redirect:'follow',signal:AbortSignal.timeout(60_000)
  });
  const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
  return body;
}

const rows=await request('/wp-json/wp/v2/pages?slug=gallery&context=edit&per_page=10');
if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected exactly one Gallery page; saw ${Array.isArray(rows)?rows.length:'invalid response'}`);
const page=rows[0];
await writeFile(join(backupDir,`page-${page.id}-gallery-before.json`),`${JSON.stringify(page,null,2)}\n`);

let updated=page;
if(apply){
  updated=await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,pageId:Number(page.id),status:updated?.status||page.status,marker:'dtf-gallery-v2'};
await writeFile(join(backupDir,'gallery-v2-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'gallery-v2-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
