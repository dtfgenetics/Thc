import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_COMMERCE_VISUALS||process.env.APPLY_SHOP_VISUAL_V1||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-commerce-visual-backups';
const sharedCssPath=process.env.DTF_VISUAL_V1_CSS||'site/design-system/dtf-visual-v1.css';
const ownerCssPath=process.env.DTF_SHOP_OWNER_V1_CSS||'site/design-system/dtf-shop-owner-v1.css';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Shop-Visual-V1/1.0'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`shop-visual-v1-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=7;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60_000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<7){await sleep(attempt*1500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status})`);
      return body;
    }catch(error){lastError=error;if(attempt<7) await sleep(attempt*1500);}
  }
  throw lastError;
}
const raw=value=>typeof value==='string'?value:(value?.raw||value?.rendered||'');

function stripStyle(content,id){return String(content||'').replace(new RegExp(`<style\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'gi'),'');}
function stripMarked(content,start,end){
  let next=String(content||'');
  for(;;){const a=next.indexOf(start);if(a<0)return next;const b=next.indexOf(end,a+start.length);if(b<0)throw new Error(`Found ${start} without ${end}`);next=`${next.slice(0,a)}${next.slice(b+end.length)}`;}
}
function markShopRoot(content){
  let next=String(content||'').replace(/\sdata-dtf-shop-visual-v1=["']true["']/g,'');
  const marked=/<div\s+class=["']dtf-v1 dtf-shop-v1["']\s+data-dtf-visual=["']shop-premium-2026["'][^>]*>/i;
  if(marked.test(next)) return next.replace(marked,m=>m.replace(/>$/,' data-dtf-shop-visual-v1="true">'));
  const root=/<div\s+data-dtf-visual=["']shop-premium-2026["']([^>]*)>/i;
  if(!root.test(next)) throw new Error('Canonical Shop premium root marker was not found');
  return next.replace(root,'<div class="dtf-v1 dtf-shop-v1" data-dtf-visual="shop-premium-2026" data-dtf-shop-visual-v1="true"$1>');
}

const sharedCss=await readFile(sharedCssPath,'utf8');
const ownerCss=await readFile(ownerCssPath,'utf8');
if(!sharedCss.includes('--dtf-bg:#07170f')||!sharedCss.includes('--dtf-gold:#d5b15a')) throw new Error('Shared Visual V1 tokens are incomplete');
if(!ownerCss.includes('.dtf-v1.dtf-shop-v1')||!ownerCss.includes('body.woocommerce-shop')||!ownerCss.includes('body.single-product')) throw new Error('Shop owner Visual V1 stylesheet is incomplete');
const pageStyles=`<style id="dtf-visual-v1-shared">\n${sharedCss}\n</style>\n<style id="dtf-shop-owner-v1">\n${ownerCss}\n</style>\n`;
const shellStart='<!-- DTF-SHOP-VISUAL-V1-START -->';
const shellEnd='<!-- DTF-SHOP-VISUAL-V1-END -->';
const shellBlock=`${shellStart}<!-- wp:html --><style id="dtf-shop-owner-v1-global">\n${ownerCss}\n</style><!-- /wp:html -->${shellEnd}`;

const shopRows=await request('/wp-json/wp/v2/pages?slug=shop&context=edit&status=publish&per_page=10');
if(!Array.isArray(shopRows)||shopRows.length!==1) throw new Error('Expected exactly one published Shop page');
const shop=shopRows[0];
const before=raw(shop.content);
if(!before.includes('data-dtf-visual="shop-premium-2026"')) throw new Error('Current commerce owner has not produced the premium Shop page');
for(const route of ['/product/10-regular-f2-blue-mango-seeds/','/product/10-feminized-f2-blue-mango-x/','/product/10-reg-f1-blueberry-bubblegum/']){
  if(!before.includes(route)) throw new Error(`Shop page is missing reviewed product route ${route}`);
}
let content=stripStyle(before,'dtf-visual-v1-shared');
content=stripStyle(content,'dtf-shop-owner-v1');
content=markShopRoot(content);
content=`${pageStyles}${content}`;
await writeFile(join(backupDir,`shop-page-${shop.id}-before.json`),`${JSON.stringify(shop,null,2)}\n`);
await writeFile(join(backupDir,'shop-after.html'),`${content}\n`);
if(apply){
  await request(`/wp-json/wp/v2/pages/${shop.id}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
  const stored=await request(`/wp-json/wp/v2/pages/${shop.id}?context=edit`);
  const storedContent=raw(stored.content);
  if(!storedContent.includes('data-dtf-shop-visual-v1="true"')||!storedContent.includes('dtf-shop-owner-v1')) throw new Error('Stored Shop Visual V1 state did not verify');
}

const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const headerParts=(parts||[]).filter(part=>part.theme==='hostinger-ai-theme'&&part.slug==='header');
if(!headerParts.length) throw new Error('Active Hostinger header template part was not found');
const partResults=[];
for(const part of headerParts){
  const original=raw(part.content);
  await writeFile(join(backupDir,`template-part-${String(part.id).replaceAll('/','_')}-before.json`),`${JSON.stringify(part,null,2)}\n`);
  const cleaned=stripMarked(original,shellStart,shellEnd).replace(/<style id="dtf-shop-owner-v1-global">[\s\S]*?<\/style>/gi,'');
  const next=`${cleaned}\n${shellBlock}`;
  if(apply){
    await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
    const refreshed=await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}?context=edit`);
    const stored=raw(refreshed.content);
    if(!stored.includes(shellStart)||!stored.includes('dtf-shop-owner-v1-global')) throw new Error(`Shop Visual V1 global CSS did not persist in ${part.id}`);
  }
  partResults.push({id:part.id,changed:original!==next});
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,shopPageId:shop.id,templateParts:partResults,transactionFieldsTouched:false,markers:['data-dtf-shop-visual-v1="true"','dtf-shop-owner-v1-global']};
await writeFile(join(backupDir,'shop-visual-v1-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'shop-visual-v1-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
