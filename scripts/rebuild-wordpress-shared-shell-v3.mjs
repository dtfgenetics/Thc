import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_SHARED_SHELL_V3||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-shared-shell-v3';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Shared-Shell-V3/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`shared-shell-v3-${stamp}`);
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

const shellStyle=`<style id="dtf-shared-shell-v3-style">
.dtf-shell-v3{background:#081b11;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
.dtf-shell-v3 *{box-sizing:border-box}.dtf-shell-v3-inner{width:min(1240px,calc(100% - 36px));margin:auto;min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:22px}.dtf-shell-brand{display:flex;align-items:center;gap:11px;flex:0 0 auto;color:#fff!important;text-decoration:none!important}.dtf-shell-brand img{display:block;width:42px;height:42px;object-fit:contain}.dtf-shell-brand strong{display:block;font-size:1.02rem;line-height:1}.dtf-shell-brand small{display:block;margin-top:4px;color:#d6b75c;font-size:.62rem;font-weight:850;letter-spacing:.11em;text-transform:uppercase}.dtf-shell-nav{display:flex;align-items:center;gap:2px;flex-wrap:nowrap}.dtf-shell-nav a{display:inline-flex;align-items:center;min-height:42px;padding:9px 10px;border-radius:999px;color:#e4eee7!important;text-decoration:none!important;font-weight:780;white-space:nowrap}.dtf-shell-nav a:hover,.dtf-shell-nav a:focus-visible{background:rgba(255,255,255,.08);outline:none}.dtf-shell-nav .shop{margin-left:5px;padding-inline:16px;background:#d6b75c;color:#081b11!important;font-weight:900}.dtf-shell-nav .shop:hover,.dtf-shell-nav .shop:focus-visible{background:#e2c86f}.dtf-footer-v3{margin:0;background:#081b11;color:#dfe9e2}.dtf-footer-v3 .inner{width:min(1240px,calc(100% - 36px));margin:auto;padding:52px 0 28px}.dtf-footer-grid{display:grid;grid-template-columns:minmax(280px,1.4fr) repeat(2,minmax(170px,.7fr));gap:36px}.dtf-footer-v3 p{color:#b9ccbf;line-height:1.7}.dtf-footer-v3 .links{display:grid;gap:9px;margin-top:14px}.dtf-footer-v3 .links a{color:#dfe9e2!important;text-decoration:none!important}.dtf-footer-v3 .links a:hover{text-decoration:underline!important}.dtf-footer-v3 .links .discord{color:#d6b75c!important;font-weight:850}.dtf-footer-v3 hr{border:0;border-top:1px solid rgba(255,255,255,.12);margin:34px 0 22px}.dtf-footer-v3 .legal{margin:0;color:#91aa9a;font-size:.86rem}
@media(max-width:820px){.dtf-shell-v3-inner{width:100%;display:block;padding:12px 0 10px}.dtf-shell-brand{width:min(100% - 28px,1240px);margin:0 auto 8px}.dtf-shell-nav{width:100%;overflow-x:auto;overscroll-behavior-inline:contain;padding:0 14px 3px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.dtf-shell-nav::-webkit-scrollbar{display:none}.dtf-shell-nav:after{content:"";flex:0 0 6px}.dtf-shell-nav .shop{margin-left:3px}.dtf-footer-grid{grid-template-columns:1.2fr 1fr;gap:28px}.dtf-footer-grid>div:first-child{grid-column:1/-1}}
@media(max-width:560px){.dtf-shell-brand img{width:38px;height:38px}.dtf-shell-nav a{min-height:40px;padding:8px 10px;font-size:.92rem}.dtf-footer-v3 .inner{width:min(100% - 28px,1240px);padding-top:42px}.dtf-footer-grid{grid-template-columns:1fr;gap:25px}.dtf-footer-grid>div:first-child{grid-column:auto}}
</style>`;
const brandLink=`<a class="dtf-shell-brand" href="/" aria-label="DTF Genetics home"><img src="${esc(brand.source_url)}" alt="DTF Genetics cannabis leaf" width="42" height="42"><span><strong>DTF Genetics</strong><small>Dream the Future</small></span></a>`;
const header=`<!-- wp:html -->${shellStyle}<header class="dtf-shell-v3" data-dtf-shell="header-v3"><div class="dtf-shell-v3-inner">${brandLink}<nav class="dtf-shell-nav" aria-label="Primary navigation"><a href="/seeds/">Genetics</a><a href="/learn/">Learn</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="/community/">Community</a><a class="shop" href="/shop/">Shop</a></nav></div></header><!-- /wp:html -->`;
const footer=`<!-- wp:html --><footer class="dtf-footer-v3" data-dtf-shell="footer-v3"><div class="inner"><div class="dtf-footer-grid"><div>${brandLink}<p>Documented genetics, Teaching Healthy Cultivation, practical grow tools, original games, and the community connecting them.</p></div><div><strong>Explore</strong><div class="links"><a href="/seeds/">Genetics</a><a href="/learn/">Learn</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="/shop/">Shop</a></div></div><div><strong>Connect & company</strong><div class="links"><a href="/community/">Community</a><a href="/gallery/">Gallery</a><a href="/about/">About</a><a href="/contact/">Contact</a><a class="discord" href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Discord</a></div></div></div><hr><p class="legal">© 2026 DTF Genetics · Dream the Future · Adults only. Follow applicable local laws.</p></div></footer><!-- /wp:html -->`;

function replaceShell(original,type,replacement){
  const tag=type==='header'?'header':'footer';
  const block=new RegExp(`<!-- wp:html -->\\s*<${tag}[\\s\\S]*?<\\/${tag}>\\s*<!-- \\/wp:html -->`,'i');
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
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,targets:results};
await writeFile(join(backupDir,'shared-shell-v3-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'shared-shell-v3-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
