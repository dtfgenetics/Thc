import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import {
  SITEWIDE_HEADER_REFERENCE,
  SITEWIDE_HEADER_VERSION,
  getWordPressSitewideHeaderBlock,
} from './lib/sitewide-header-template.mjs';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_SHARED_SHELL_V3||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-shared-shell-v3';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Shared-Shell-V5/1.1'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`shared-shell-v5-${stamp}`);
await mkdir(backupDir,{recursive:true});
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
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

const footerStyle=`<style id="dtf-shared-footer-v5-style">
.dtf-footer-v3{margin:0;background:#081b11;color:#dfe9e2}.dtf-footer-v3 *{box-sizing:border-box}.dtf-footer-v3 .inner{width:min(1240px,calc(100% - 36px));margin:auto;padding:52px 0 28px}.dtf-footer-grid{display:grid;grid-template-columns:minmax(280px,1.4fr) repeat(2,minmax(170px,.7fr));gap:36px}.dtf-footer-v3 p{color:#b9ccbf;line-height:1.7}.dtf-footer-v3 .links{display:grid;gap:9px;margin-top:14px}.dtf-footer-v3 .links a{color:#dfe9e2!important;text-decoration:none!important;min-height:32px;display:flex;align-items:center}.dtf-footer-v3 .links a:hover{text-decoration:underline!important}.dtf-footer-v3 .links .discord{color:#d6b75c!important;font-weight:850}.dtf-footer-v3 hr{border:0;border-top:1px solid rgba(255,255,255,.12);margin:34px 0 22px}.dtf-footer-v3 .legal{margin:0;color:#91aa9a;font-size:.86rem}.dtf-footer-brand{display:flex!important;align-items:center;gap:12px;min-width:0;color:#fff!important;text-decoration:none!important}.dtf-footer-brand img{display:block;width:50px!important;height:50px!important;object-fit:contain}.dtf-footer-brand strong{display:block;font-size:1.18rem!important;line-height:1;letter-spacing:.035em;text-transform:uppercase;font-weight:900}.dtf-footer-brand small{display:block;margin-top:5px;color:#d8bd68!important;font-size:.62rem!important;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
@media(max-width:620px){.dtf-footer-v3 .inner{width:min(100% - 28px,1240px);padding-top:42px}.dtf-footer-grid{grid-template-columns:1fr;gap:25px}.dtf-footer-v3 .links a{min-height:44px}}
</style>`;
const footerBrandLink=`<a class="dtf-footer-brand" href="/" aria-label="DTF Genetics home"><img src="${esc(brand.source_url)}" alt="DTF Genetics cannabis leaf" width="50" height="50"><span><strong>DTF Genetics</strong><small>Dream the Future</small></span></a>`;
const header=getWordPressSitewideHeaderBlock(footerStyle);
const footer=`<!-- wp:html --><footer class="dtf-footer-v3" data-dtf-shell="footer-v3"><div class="inner"><div class="dtf-footer-grid"><div>${footerBrandLink}<p>Documented genetics, Teaching Healthy Cultivation, practical grow tools, original games, and the community connecting them.</p></div><nav aria-label="Site map"><strong>Explore</strong><div class="links"><a href="/">Home</a><a href="/seeds/">Seeds</a><a href="/learn/">Learn</a><a href="/courses/">Courses</a><a href="/tools/">Diagnostic</a><a href="/games/">Games</a><a href="/community/">Community</a><a href="/shop/">Shop</a></div></nav><nav aria-label="Company and community links"><strong>Connect & company</strong><div class="links"><a href="/gallery/">Gallery</a><a href="/about/">About</a><a href="/contact/">Contact</a><a class="discord" href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Discord</a></div></nav></div><hr><p class="legal">© 2026 DTF Genetics · Dream the Future · Adults only. Follow applicable local laws.</p></div></footer><!-- /wp:html -->`;

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
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,headerVersion:SITEWIDE_HEADER_VERSION,reference:SITEWIDE_HEADER_REFERENCE,canonicalNav:['Home','Seeds','Learn','Courses','Diagnostic','Games','Community','Shop'],targets:results};
await writeFile(join(backupDir,'shared-shell-v5-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'shared-shell-v5-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
