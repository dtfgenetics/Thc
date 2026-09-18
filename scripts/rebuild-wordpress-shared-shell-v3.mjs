import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import {
  SITEWIDE_HEADER_MARKER,
  SITEWIDE_HEADER_REFERENCE,
  SITEWIDE_HEADER_VERSION,
  getWordPressSitewideHeaderBlock,
} from './lib/sitewide-header-template-v6.mjs';
import {
  SITEWIDE_FOOTER_STYLE_TAG,
  getWordPressSitewideFooterBlock,
} from './lib/sitewide-footer-template-v6.mjs';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_SHARED_SHELL_V3||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-shared-shell-v6';
const responsiveLayoutPath=process.env.DTF_RESPONSIVE_LAYOUT_CSS||join(process.cwd(),'site/wordpress/assets/responsive-layout-v1.css');
const uxPolishPath=process.env.DTF_SITEWIDE_UX_POLISH_CSS||join(process.cwd(),'site/wordpress/assets/sitewide-ux-polish-v1.css');
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Shared-Shell-V6/1.1'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`shared-shell-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');

async function request(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60_000)});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if((response.status>=500||response.status===429)&&attempt<5){await new Promise(r=>setTimeout(r,attempt*1400));continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){lastError=error;if(attempt<5) await new Promise(r=>setTimeout(r,attempt*1400));}
  }
  throw lastError;
}

const media=await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
const brand=Array.isArray(media)?media[0]:null;
if(!brand?.source_url) throw new Error('Canonical DTF cannabis-leaf brand media is missing');

const [responsiveLayoutCss,uxPolishCss]=await Promise.all([
  readFile(responsiveLayoutPath,'utf8'),
  readFile(uxPolishPath,'utf8'),
]);
if(!responsiveLayoutCss.includes('DTFSeeds shared responsive layout system v1')) throw new Error('Responsive layout stylesheet marker is missing');
if(!responsiveLayoutCss.includes('@media (min-width:701px) and (max-width:1120px)')) throw new Error('Tablet responsive state is missing');
if(!responsiveLayoutCss.includes('@media (max-width:700px)')) throw new Error('Mobile responsive state is missing');
if(!uxPolishCss.includes('DTFSeeds sitewide UX polish v1')) throw new Error('Sitewide UX polish stylesheet marker is missing');
for(const token of ['scroll-padding-top:',':focus-visible','min-height:44px','overscroll-behavior:contain']){
  if(!uxPolishCss.includes(token)) throw new Error(`Sitewide UX polish token is missing: ${token}`);
}
const responsiveLayoutStyle=`<style id="dtf-responsive-layout-v1">${responsiveLayoutCss}</style>`;
const uxPolishStyle=`<style id="dtf-sitewide-ux-polish-v1">${uxPolishCss}</style>`;

const header=getWordPressSitewideHeaderBlock(`${responsiveLayoutStyle}${uxPolishStyle}${SITEWIDE_FOOTER_STYLE_TAG}`);
for(const token of [SITEWIDE_HEADER_MARKER,'overflow-x:auto','canonical-eight-v1','>Home</a>','>Seeds</a>','>Courses</a>','>Diagnostic</a>']){
  if(!header.includes(token)) throw new Error(`Generated shared header is missing required compatibility token: ${token}`);
}
const footer=getWordPressSitewideFooterBlock({brandImageUrl:brand.source_url});

function replaceShell(original,type,replacement){
  const tag=type==='header'?'header':'footer';
  const block=new RegExp(`<!-- wp:html -->\\s*(?:<style[\\s\\S]*?<\\/style>\\s*)*<${tag}[\\s\\S]*?<\\/${tag}>[\\s\\S]*?<!-- \\/wp:html -->`,'i');
  if(block.test(original)) return original.replace(block,replacement);
  const bare=new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`,'i');
  if(bare.test(original)) return original.replace(bare,replacement.replace(/^<!-- wp:html -->|<!-- \/wp:html -->$/g,''));
  throw new Error(`Could not safely locate existing ${tag} shell block`);
}

const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const targets=(parts||[]).filter(p=>p.theme==='hostinger-ai-theme'&&(p.slug==='header'||String(p.slug).startsWith('footer')));
if(!targets.some(p=>p.slug==='header')) throw new Error('Active Hostinger header template part is missing');
const results=[];
for(const part of targets){
  const original=rendered(part.content);
  await writeFile(join(backupDir,`template-part-${String(part.id).replaceAll('/','_')}-before.json`),`${JSON.stringify(part,null,2)}\n`);
  const next=replaceShell(original,part.slug==='header'?'header':'footer',part.slug==='header'?header:footer);
  if(apply&&next!==original) await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
  results.push({id:part.id,slug:part.slug,changed:next!==original,preservedCommerceStyle:next.includes('dtf-commerce-archive-style')||!original.includes('dtf-commerce-archive-style')});
  if(original.includes('dtf-commerce-archive-style')&&!next.includes('dtf-commerce-archive-style')) throw new Error('Shared shell update would remove WooCommerce archive styling');
}
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,headerVersion:SITEWIDE_HEADER_VERSION,footerVersion:'v6',responsiveLayout:'v1',sitewideUxPolish:'v1',reference:SITEWIDE_HEADER_REFERENCE,canonicalNav:['Home','Seeds','Learn','Courses','Diagnostic','Games','Community','Shop'],targets:results};
await writeFile(join(backupDir,'shared-shell-v6-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'shared-shell-v6-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));