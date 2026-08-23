// production-trigger: 2026-08-22 potleaf favicon
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const iconPath=process.env.DTF_BRAND_ICON||join(process.cwd(),'site/wordpress/assets/brand/dtf-potleaf-512.png');
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-potleaf-site-icon';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Potleaf-Icon/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,stamp);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{
    ...options,
    headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
    redirect:'follow',
    signal:AbortSignal.timeout(90_000)
  });
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
  return body;
}

async function ensureIconMedia(){
  const existing=await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
  if(Array.isArray(existing)&&existing[0]?.id) return existing[0];
  const bytes=await readFile(iconPath);
  const response=await fetch(`${siteUrl}/wp-json/wp/v2/media`,{
    method:'POST',
    headers:{...headers,'Content-Type':'image/png','Content-Disposition':`attachment; filename="${basename(iconPath)}"`},
    body:bytes,
    redirect:'follow',
    signal:AbortSignal.timeout(120_000)
  });
  const text=await response.text();
  let body=null;try{body=JSON.parse(text);}catch{body={raw:text.slice(0,500)};}
  if(!response.ok||!body?.id) throw new Error(`Potleaf upload failed (${response.status}): ${JSON.stringify(body).slice(0,500)}`);
  return request(`/wp-json/wp/v2/media/${body.id}`,{method:'POST',body:JSON.stringify({
    slug:'dtf-potleaf-site-icon',
    title:'DTF Genetics Cannabis Leaf',
    alt_text:'DTF Genetics cannabis leaf logo',
    caption:'DTF Genetics cannabis leaf brand mark'
  })});
}

const settings=await request('/wp-json/wp/v2/settings?context=edit');
await writeFile(join(backupDir,'settings-before.json'),`${JSON.stringify(settings,null,2)}\n`);
const media=await ensureIconMedia();
const mediaId=Number(media.id||0);
if(!mediaId) throw new Error('Potleaf media ID not resolved');

const payload={};
if(Object.prototype.hasOwnProperty.call(settings,'site_icon')) payload.site_icon=mediaId;
if(Object.prototype.hasOwnProperty.call(settings,'site_logo')) payload.site_logo=mediaId;
if(!Object.keys(payload).length) throw new Error('WordPress settings endpoint exposes neither site_icon nor site_logo');

await request('/wp-json/wp/v2/settings',{method:'POST',body:JSON.stringify(payload)});
const after=await request('/wp-json/wp/v2/settings?context=edit');
if(Object.prototype.hasOwnProperty.call(after,'site_icon')&&Number(after.site_icon)!==mediaId) throw new Error(`site_icon verification failed: expected ${mediaId}, saw ${after.site_icon}`);
if(Object.prototype.hasOwnProperty.call(after,'site_logo')&&Number(after.site_logo)!==mediaId) throw new Error(`site_logo verification failed: expected ${mediaId}, saw ${after.site_logo}`);

const homeRows=await request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10');
if(Array.isArray(homeRows)&&homeRows.length===1){
  await writeFile(join(backupDir,'home-before.json'),`${JSON.stringify(homeRows[0],null,2)}\n`);
  await request(`/wp-json/wp/v2/pages/${homeRows[0].id}`,{method:'POST',body:JSON.stringify({featured_media:mediaId,status:'publish'})});
}

const report={mediaId,sourceUrl:media.source_url||media.guid?.rendered||'',siteIcon:Number(after.site_icon||0),siteLogo:Number(after.site_logo||0),backupDir};
await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'latest.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
