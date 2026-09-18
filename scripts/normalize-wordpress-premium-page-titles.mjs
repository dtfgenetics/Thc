import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PREMIUM_TITLE_NORMALIZATION||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-premium-title-backups';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`premium-title-${stamp}`);
await mkdir(backupDir,{recursive:true});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

// V3 owns Home/Learn and V4 owns Genetics/Shop. Keep this small normalizer
// deliberately limited to editorial pages that are not owned by those visual
// layers so production polishers do not fight each other. The approved marker
// is derived from each canonical page's H1 so ordinary copy changes cannot leave
// a stale hard-coded production assertion behind.
const targetSlugs=['community','gallery'];

function textFromHtml(value){
  return String(value||'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/g,"'")
    .replace(/\s+/g,' ')
    .trim();
}

async function canonicalTarget(slug){
  const canonicalPath=`site/wordpress/pages/${slug}.html`;
  const canonical=await readFile(canonicalPath,'utf8');
  const match=canonical.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const marker=textFromHtml(match?.[1]);
  const layout=canonical.match(/data-dtf-layout=["']([^"']+)["']/i)?.[1]||'';
  if(!marker) throw new Error(`${slug}: canonical page has no usable H1 marker at ${canonicalPath}.`);
  if(!layout) throw new Error(`${slug}: canonical page has no data-dtf-layout owner marker at ${canonicalPath}.`);
  return {slug,canonicalPath,marker,layout};
}

const targets=await Promise.all(targetSlugs.map(canonicalTarget));

const STYLE_ID='dtf-premium-theme-title-suppression';
const STYLE=`<style id="${STYLE_ID}">
/* This page provides its own designed hero H1. Suppress the theme-generated duplicate title only on this page. */
body.page h1.entry-title,
body.page .entry-header > h1.entry-title,
body.page .page-header > h1.page-title,
body.page h1.wp-block-post-title,
body.page .wp-site-blocks > main > h1.wp-block-post-title,
body.page main > .wp-block-group:first-child > h1.wp-block-post-title{display:none!important}
body.page .entry-header:has(> h1.entry-title:only-child){margin:0!important;padding:0!important;min-height:0!important}
</style>`;

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Premium-Title-Normalizer/3.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
      if((response.status>=500||response.status===429)&&attempt<6){await sleep(attempt*1800);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<6){await sleep(attempt*1800);continue;}}
  }
  throw last;
}
function rendered(value){return typeof value==='string'?value:(value?.raw||value?.rendered||'');}
function ownedLayout(content,target){
  const exact=new RegExp(`data-dtf-layout=["']${target.layout.replace(/[.*+?^${}()|[\]\\]/g,'\\function hasCanonicalMarker(content,target){return String(content).includes(target.marker);}
function normalizeThemeTitle(content){')}["']`,'i');
  const versioned=new RegExp(`data-dtf-layout=["']${target.slug}-visual-v\\d+["']`,'i');
  return exact.test(String(content))||versioned.test(String(content));
}
function customH1(content){return textFromHtml(String(content).match(/<h1\\b[^>]*>([\\s\\S]*?)<\\/h1>/i)?.[1]);}
function normalizeThemeTitle(content){
  const re=new RegExp(`<style\\s+id=["']${STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'i');
  return `${STYLE}\n${String(content).replace(re,'').trimStart()}`;
}

const results=[];
for(const target of targets){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(target.slug)}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${target.slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);
  const page=rows[0];
  const before=rendered(page.content);
  if(!ownedLayout(before,target)) throw new Error(`${target.slug}: live page is missing a DTF-owned ${target.slug}-visual layout marker; refusing title normalization.`);
  const beforeH1=customH1(before);
  if(!beforeH1) throw new Error(`${target.slug}: no custom H1 found; refusing to hide the theme title.`);
  const after=normalizeThemeTitle(before);

  await writeFile(join(backupDir,`page-${page.id}-${target.slug}-before.json`),`${JSON.stringify(page,null,2)}\n`);
  if(apply&&after!==before){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:after,status:'publish'})});}
  const check=await request(`/wp-json/wp/v2/pages/${page.id}?context=edit`);
  const current=rendered(check.content);
  if(apply&&!current.includes(`id="${STYLE_ID}"`)) throw new Error(`${target.slug}: scoped title suppression was not persisted.`);
  if(!ownedLayout(current,target)) throw new Error(`${target.slug}: DTF-owned layout marker changed unexpectedly after normalization.`);
  const currentH1=customH1(current);
  if(!currentH1) throw new Error(`${target.slug}: custom H1 disappeared after normalization.`);
  results.push({slug:target.slug,pageId:page.id,changed:after!==before,applied:apply,canonicalH1:target.marker,liveH1:currentH1,layout:target.layout,canonicalPath:target.canonicalPath});
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,styleId:STYLE_ID,targets:results};
await writeFile(join(backupDir,'premium-title-normalization-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'premium-title-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
