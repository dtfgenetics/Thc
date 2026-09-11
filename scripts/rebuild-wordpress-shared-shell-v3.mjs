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
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Shared-Shell-V4/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`shared-shell-v4-${stamp}`);
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

const shellStyle=`<style id="dtf-shared-shell-v4-style">
:root{--dtf-shell-deep:#041109;--dtf-shell-deep-2:#07180e;--dtf-shell-green:#2e8b52;--dtf-shell-green-2:#3aa363;--dtf-shell-gold:#d8bd68;--dtf-shell-white:#f7fbf8;--dtf-shell-muted:#bdd0c3}
.dtf-shell-v3{position:sticky!important;top:0;z-index:1000;background:linear-gradient(180deg,var(--dtf-shell-deep),var(--dtf-shell-deep-2))!important;color:#fff!important;border:0!important;border-bottom:2px solid var(--dtf-shell-green)!important;box-shadow:0 10px 28px rgba(0,10,5,.2)!important}
.dtf-shell-v3 *{box-sizing:border-box}.dtf-shell-v3-inner{width:min(1460px,calc(100% - 36px))!important;min-height:82px!important;margin:auto;display:grid!important;grid-template-columns:minmax(220px,auto) minmax(0,1fr) auto;align-items:center;gap:24px!important;padding:0!important}.dtf-shell-brand{display:flex!important;align-items:center;gap:12px;min-width:0;color:#fff!important;text-decoration:none!important}.dtf-shell-brand img{display:block;width:50px!important;height:50px!important;object-fit:contain;filter:drop-shadow(0 3px 8px rgba(0,0,0,.2))}.dtf-shell-brand strong{display:block;font-size:1.18rem!important;line-height:1;letter-spacing:.035em;text-transform:uppercase;font-weight:900}.dtf-shell-brand small{display:block;margin-top:5px;color:var(--dtf-shell-gold)!important;font-size:.62rem!important;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.dtf-shell-menu{display:none;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0 12px;border:1px solid rgba(255,255,255,.22);border-radius:9px;background:rgba(255,255,255,.055);color:#fff;font:inherit;font-weight:850;cursor:pointer}.dtf-shell-nav{display:flex!important;align-items:center;justify-content:center;gap:2px;min-width:0}.dtf-shell-nav a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 11px;border-radius:8px;color:#eef5f0!important;text-decoration:none!important;font-size:.92rem;font-weight:760;white-space:nowrap;transition:background-color .16s ease,color .16s ease,box-shadow .16s ease}.dtf-shell-nav a:hover,.dtf-shell-nav a:focus-visible{background:rgba(255,255,255,.075);color:#fff!important;outline:none}.dtf-shell-nav a.is-active,.dtf-shell-nav a[aria-current="page"]{background:linear-gradient(180deg,#317c4e,#225f3a)!important;color:#fff!important;box-shadow:0 6px 14px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.08)!important}.dtf-shell-nav .shop{margin-left:2px!important;background:transparent!important;color:#eef5f0!important;font-weight:780!important}.dtf-shell-nav .shop.is-active,.dtf-shell-nav .shop[aria-current="page"]{background:linear-gradient(180deg,#317c4e,#225f3a)!important;color:#fff!important}.dtf-shell-utility{display:flex;align-items:center;gap:10px;justify-self:end}.dtf-shell-thc{padding-right:8px;text-align:right;color:#f2f7f3;font-size:.66rem;font-weight:800;line-height:1.28;letter-spacing:.02em;white-space:nowrap}.dtf-shell-icons{display:flex;align-items:center;gap:3px}.dtf-shell-icon{display:grid!important;place-items:center;width:40px;height:40px;border-radius:8px;color:#eef5f0!important;text-decoration:none!important}.dtf-shell-icon:hover,.dtf-shell-icon:focus-visible{background:rgba(255,255,255,.075);outline:none}.dtf-shell-icon svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dtf-footer-v3{margin:0;background:#081b11;color:#dfe9e2}.dtf-footer-v3 .inner{width:min(1240px,calc(100% - 36px));margin:auto;padding:52px 0 28px}.dtf-footer-grid{display:grid;grid-template-columns:minmax(280px,1.4fr) repeat(2,minmax(170px,.7fr));gap:36px}.dtf-footer-v3 p{color:#b9ccbf;line-height:1.7}.dtf-footer-v3 .links{display:grid;gap:9px;margin-top:14px}.dtf-footer-v3 .links a{color:#dfe9e2!important;text-decoration:none!important}.dtf-footer-v3 .links a:hover{text-decoration:underline!important}.dtf-footer-v3 .links .discord{color:#d6b75c!important;font-weight:850}.dtf-footer-v3 hr{border:0;border-top:1px solid rgba(255,255,255,.12);margin:34px 0 22px}.dtf-footer-v3 .legal{margin:0;color:#91aa9a;font-size:.86rem}
@media(max-width:1180px){.dtf-shell-v3-inner{grid-template-columns:minmax(190px,auto) minmax(0,1fr) auto;gap:14px!important}.dtf-shell-nav a{padding-inline:8px;font-size:.86rem}.dtf-shell-thc{display:none}}
@media(max-width:920px){.dtf-shell-v3-inner{width:min(100% - 24px,1460px)!important;grid-template-columns:1fr auto auto;min-height:70px!important;padding:8px 0!important;gap:8px!important}.dtf-shell-brand img{width:44px!important;height:44px!important}.dtf-shell-brand strong{font-size:1rem!important}.dtf-shell-brand small{font-size:.56rem!important}.dtf-shell-menu{display:inline-flex}.dtf-shell-utility{gap:2px}.dtf-shell-icon{width:36px;height:36px}.dtf-shell-nav{display:none!important;grid-column:1/-1;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;gap:6px;padding:10px 0 4px;border-top:1px solid rgba(255,255,255,.1)}.dtf-shell-nav.is-open{display:grid!important}.dtf-shell-nav a{min-height:42px;border-radius:9px;font-size:.88rem}.dtf-shell-nav .shop{margin-left:0!important}}
@media(max-width:620px){.dtf-shell-v3-inner{grid-template-columns:1fr auto}.dtf-shell-utility{display:none}.dtf-shell-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-shell-brand strong{font-size:.96rem!important}.dtf-shell-brand small{letter-spacing:.12em}.dtf-footer-v3 .inner{width:min(100% - 28px,1240px);padding-top:42px}.dtf-footer-grid{grid-template-columns:1fr;gap:25px}.dtf-footer-grid>div:first-child{grid-column:auto}}
@media(prefers-reduced-motion:reduce){.dtf-shell-nav a{transition:none}}
</style>`;
const brandLink=`<a class="dtf-shell-brand" href="/" aria-label="DTF Genetics home"><img src="${esc(brand.source_url)}" alt="DTF Genetics cannabis leaf" width="50" height="50"><span><strong>DTF Genetics</strong><small>Dream the Future</small></span></a>`;
const searchIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.7-3.7"></path></svg>';
const userIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>';
const cartIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1"></circle><circle cx="19" cy="20" r="1"></circle><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"></path></svg>';
const headerScript=`<script id="dtf-shared-shell-v4-script">(function(){function norm(p){return p==='/'?'/':'/'+String(p||'/').split('/').filter(Boolean).join('/')+'/';}function sync(){var path=norm(location.pathname);var header=document.querySelector('.dtf-shell-v3');if(!header)return;var menu=header.querySelector('.dtf-shell-menu');var nav=header.querySelector('.dtf-shell-nav');if(menu&&nav){menu.addEventListener('click',function(){var open=nav.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(open));});}header.querySelectorAll('.dtf-shell-nav a').forEach(function(a){var href=norm(a.getAttribute('href')||'/');var active=false;if(href==='/')active=path==='/';else if(href==='/courses/')active=path==='/courses/'||path.indexOf('/learn/learning-hub/')===0;else if(href==='/learn/')active=path.indexOf('/learn/')===0&&path.indexOf('/learn/learning-hub/')!==0;else if(href==='/tools/')active=/^\/(tools|growlens|thc-grow-doc)\//.test(path);else if(href==='/shop/')active=/^\/(shop|product|cart|checkout|my-account)\//.test(path);else active=path.indexOf(href)===0;a.classList.toggle('is-active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();})();</script>`;
const header=`<!-- wp:html -->${shellStyle}<header class="dtf-shell-v3" data-dtf-shell="header-v4"><div class="dtf-shell-v3-inner">${brandLink}<button class="dtf-shell-menu" type="button" aria-expanded="false" aria-controls="dtf-primary-nav">Menu</button><nav id="dtf-primary-nav" class="dtf-shell-nav" aria-label="Primary navigation"><a href="/">Home</a><a href="/seeds/">Seeds</a><a href="/learn/">Learn</a><a href="/courses/">Courses</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="/community/">Community</a><a class="shop" href="/shop/">Shop</a></nav><div class="dtf-shell-utility"><span class="dtf-shell-thc">Teaching Healthy<br>Cultivation</span><div class="dtf-shell-icons"><a class="dtf-shell-icon" href="/?s=" aria-label="Search DTF Genetics">${searchIcon}</a><a class="dtf-shell-icon" href="/my-account/" aria-label="Account">${userIcon}</a><a class="dtf-shell-icon" href="/cart/" aria-label="Cart">${cartIcon}</a></div></div></div></header>${headerScript}<!-- /wp:html -->`;
const footer=`<!-- wp:html --><footer class="dtf-footer-v3" data-dtf-shell="footer-v3"><div class="inner"><div class="dtf-footer-grid"><div>${brandLink}<p>Documented genetics, Teaching Healthy Cultivation, practical grow tools, original games, and the community connecting them.</p></div><div><strong>Explore</strong><div class="links"><a href="/seeds/">Genetics</a><a href="/learn/">Learn</a><a href="/courses/">Courses</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="/shop/">Shop</a></div></div><div><strong>Connect & company</strong><div class="links"><a href="/community/">Community</a><a href="/gallery/">Gallery</a><a href="/about/">About</a><a href="/contact/">Contact</a><a class="discord" href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Discord</a></div></div></div><hr><p class="legal">© 2026 DTF Genetics · Dream the Future · Adults only. Follow applicable local laws.</p></div></footer><!-- /wp:html -->`;

function replaceShell(original,type,replacement){
  const tag=type==='header'?'header':'footer';
  const block=new RegExp(`<!-- wp:html -->\\s*<${tag}[\\s\\S]*?<\\/${tag}>[\\s\\S]*?<!-- \\/wp:html -->`,'i');
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
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,headerVersion:4,reference:'site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg',targets:results};
await writeFile(join(backupDir,'shared-shell-v4-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'shared-shell-v4-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
