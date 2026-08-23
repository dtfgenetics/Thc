import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-commerce-visual-backups';
const apply=String(process.env.APPLY_COMMERCE_VISUALS||'').toLowerCase()==='true';
const brandPath=process.env.DTF_BRAND_ICON||join(process.cwd(),'site/wordpress/assets/brand/dtf-potleaf-512.png');
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Commerce-Visuals/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`commerce-visual-${stamp}`);
await mkdir(backupDir,{recursive:true});

function rendered(v){if(typeof v==='string') return v;if(v&&typeof v==='object') return v.rendered||v.raw||'';return '';}
function plain(v=''){return String(v).replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();}
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}

async function request(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60_000)});
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
  return body;
}

async function getPage(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected exactly one page for ${slug}; saw ${Array.isArray(rows)?rows.length:'invalid response'}`);
  return rows[0];
}

async function fetchAllMedia(){
  const rows=[];
  for(let page=1;page<=6;page++){
    try{
      const batch=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if(!Array.isArray(batch)||!batch.length) break;
      rows.push(...batch);
      if(batch.length<100) break;
    }catch(error){if(/invalid_page_number|400/i.test(error.message)) break;throw error;}
  }
  return rows;
}

function mediaText(item){return [item?.slug,rendered(item?.title),item?.alt_text,rendered(item?.caption),item?.source_url].join(' ').toLowerCase();}
function choose(media,groups){for(const group of groups){const terms=Array.isArray(group)?group:[group];const found=media.find(item=>item?.source_url&&terms.every(t=>mediaText(item).includes(String(t).toLowerCase())));if(found)return found;}return null;}
function imageUrl(item){return item?.source_url||item?.guid?.rendered||'';}
function imageAlt(item,fallback){return plain(item?.alt_text||rendered(item?.title)||fallback);}
function img(item,alt,{ratio='4/3',eager=false}={}){if(!item)return '';return `<img src="${esc(imageUrl(item))}" alt="${esc(imageAlt(item,alt))}" ${eager?'loading="eager" fetchpriority="high"':'loading="lazy"'} decoding="async" style="display:block;width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:22px;box-shadow:0 18px 46px rgba(8,34,17,.16)">`;}
function button(href,label,primary=true){const bg=primary?'#173c25':'#ffffff';const fg=primary?'#ffffff':'#173c25';const border=primary?'#173c25':'#b8ccbd';return `<a href="${esc(href)}" style="display:inline-block;margin:5px 8px 5px 0;padding:12px 18px;border-radius:999px;background:${bg};color:${fg};border:1px solid ${border};text-decoration:none;font-weight:850">${esc(label)}</a>`;}
function eyebrow(text){return `<p style="margin:0 0 10px;color:#2d7d48;font-size:.82rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase">${esc(text)}</p>`;}
function panel(inner){return `<article style="background:#fff;border:1px solid #dce8df;border-radius:24px;padding:24px;box-shadow:0 12px 34px rgba(13,55,29,.07)">${inner}</article>`;}

async function ensureBrandMedia(){
  const existing=await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
  if(Array.isArray(existing)&&existing[0]?.id) return existing[0];
  if(!apply) return null;
  const bytes=await readFile(brandPath);
  const response=await fetch(`${siteUrl}/wp-json/wp/v2/media`,{method:'POST',headers:{...headers,'Content-Type':'image/png','Content-Disposition':`attachment; filename="${basename(brandPath)}"`},body:bytes,redirect:'follow',signal:AbortSignal.timeout(120_000)});
  const text=await response.text();let body=null;try{body=JSON.parse(text);}catch{body={raw:text.slice(0,500)};}
  if(!response.ok||!body?.id) throw new Error(`Brand upload failed (${response.status})`);
  return request(`/wp-json/wp/v2/media/${body.id}`,{method:'POST',body:JSON.stringify({slug:'dtf-potleaf-site-icon',title:'DTF Genetics Cannabis Leaf',alt_text:'DTF Genetics cannabis leaf logo',caption:'DTF Genetics cannabis leaf brand mark'})});
}

async function backupAndUpdate(page,payload){
  await writeFile(join(backupDir,`page-${page.id}-${page.slug}-before.json`),`${JSON.stringify(page,null,2)}\n`);
  if(!apply) return page;
  return request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({...payload,status:'publish'})});
}

const [home,seeds,shop,media,settings,index]=await Promise.all([
  getPage('home'),getPage('seeds'),getPage('shop'),fetchAllMedia(),request('/wp-json/wp/v2/settings?context=edit'),request('/wp-json/')
]);
await writeFile(join(backupDir,'settings-before.json'),`${JSON.stringify(settings,null,2)}\n`);

const brand=await ensureBrandMedia();
const picks={
  hero:choose(media,[['whole','plant','atlas'],['plant','anatomy'],['flower','anatomy']]),
  genetics:choose(media,[['sex','expression'],['genetics'],['breeding']]),
  flower:choose(media,[['flower','anatomy'],['trichome']]),
  trichome:choose(media,[['trichome','secretory'],['trichome']]),
  evidence:choose(media,[['evidence','claim'],['observation','conclusion'],['root','anatomy']]),
  lifecycle:choose(media,[['life','cycle'],['seedling','establishment']])
};

const seedsHtml=`<div data-dtf-visual="seeds-premium-2026" style="background:#f4f8f4;color:#173522">
<section style="max-width:1240px;margin:auto;padding:58px 22px 42px;display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:44px;align-items:center">
<div>${eyebrow('DTF Genetics · documented breeding')}<h1 style="font-size:clamp(2.6rem,6vw,5rem);line-height:.98;letter-spacing:-.045em;margin:0 0 20px">From breeding notes to current releases.</h1><p style="font-size:1.13rem;line-height:1.8;color:#46604e;max-width:720px">Explore DTF breeding projects with lineage, generation context, selection direction, and direct routes to verified store listings. Dynamic price and inventory stay on the product page so the catalog remains accurate.</p><p>${button('#current-releases','Shop current releases',true)}${button('/learn/','Learn the genetics',false)}${button('https://discord.gg/xJbUeHFPMt','Join the community',false)}</p></div>
<div>${img(picks.hero,'DTF Genetics plant science and breeding reference',{ratio:'1/1',eager:true})}</div>
</section>

<section id="current-releases" style="max-width:1240px;margin:auto;padding:12px 22px 64px"><div style="display:flex;justify-content:space-between;gap:20px;align-items:end;flex-wrap:wrap;margin-bottom:22px"><div>${eyebrow('Verified store routes')}<h2 style="font-size:clamp(2rem,4vw,3.35rem);margin:0">Current releases</h2></div><p style="max-width:560px;color:#516858;line-height:1.65;margin:0">The linked WooCommerce listing controls current price, stock, pack details, fulfillment information, and policies.</p></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">
${panel(`${eyebrow('F2 · Regular')}<h3 style="font-size:1.55rem;margin:0 0 8px">Blue Mango</h3><p style="font-weight:800;color:#2a5838">Somango XXL × Blueberry Butcher</p><p style="line-height:1.7;color:#506357">Selected around vigorous growth, branching, resin production, substantial flower structure, and a candy-blueberry-meets-ripe-mango aromatic direction.</p>${button('/product/10-regular-f2-blue-mango-seeds/','Open regular F2 listing',true)}`)}
${panel(`${eyebrow('F2 · Feminized')}<h3 style="font-size:1.55rem;margin:0 0 8px">Blue Mango</h3><p style="font-weight:800;color:#2a5838">Somango XXL × Blueberry Butcher</p><p style="line-height:1.7;color:#506357">The feminized F2 route belongs to the same Blue Mango breeding project. Exact transaction details remain on the live listing.</p>${button('/product/10-feminized-f2-blue-mango-x/','Open feminized F2 listing',true)}`)}
${panel(`${eyebrow('F1 · Regular')}<h3 style="font-size:1.55rem;margin:0 0 8px">Blue Bubblegum</h3><p style="font-weight:800;color:#2a5838">Bubblegum Kush × Blueberry Butcher</p><p style="line-height:1.7;color:#506357">A sweet fruit-and-bubblegum breeding direction and a parent line used in Mango Bubbles. The current store route retains its existing product slug.</p>${button('/product/10-reg-f1-blueberry-bubblegum/','Open current F1 listing',true)}`)}
</div></section>

<section style="background:#12341f;color:#fff"><div style="max-width:1240px;margin:auto;padding:62px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:36px;align-items:center"><div>${img(picks.genetics,'Cannabis genetics and sex expression reference',{ratio:'4/3'})}</div><div>${eyebrow('Breeding library')}<h2 style="font-size:clamp(2rem,4vw,3.4rem);margin:0 0 16px;color:#fff">Know the line before you shop the pack.</h2><p style="line-height:1.8;color:#cee0d2">Lineage and breeding direction describe documented projects, not guaranteed outcomes. Generation, seed type, environment, and individual variation all matter.</p><p>${button('/learn/','Study genetics & breeding',true)}${button('/shop/','Open the shop',false)}</p></div></div></div></section>

<section style="max-width:1240px;margin:auto;padding:64px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px">
${panel(`${eyebrow('Flagship line')}<h2 style="margin:0 0 8px">Blue Mango</h2><p><strong>Somango XXL × Blueberry Butcher</strong></p><p style="line-height:1.75;color:#506357">A multi-generation DTF project with an 8–10 week planning window commonly used in project documentation. Phenotype and environment can change actual finish time.</p>`)}
${panel(`${eyebrow('Active breeding line')}<h2 style="margin:0 0 8px">Mango Bubbles</h2><p><strong>Blue Mango × Blue Bubblegum</strong></p><p style="line-height:1.75;color:#506357">Combines the fruit-forward direction of Blue Mango with the sweet bubblegum influence of Blue Bubblegum. A breeding profile does not imply current retail availability.</p>`)}
${panel(`${eyebrow('Parent line')}<h2 style="margin:0 0 8px">Blueberry Butcher</h2><p><strong>Blueberry Muffin × Jack Herer</strong></p><p style="line-height:1.75;color:#506357">An important parent contributing to Blue Mango and Blue Bubblegum. Parent-line documentation does not imply current retail availability.</p>`)}
</div></section>

<section style="background:#e8f0e9"><div style="max-width:1240px;margin:auto;padding:58px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:26px;align-items:center"><div>${img(picks.evidence,'Evidence-based cultivation and breeding documentation',{ratio:'4/3'})}</div><div>${eyebrow('Catalog standard')}<h2 style="font-size:clamp(2rem,4vw,3.2rem);margin:0 0 14px">Observation over hype.</h2><p style="line-height:1.8;color:#496052">DTF genetics pages separate lineage, breeding goals, observed planning ranges, and release-specific facts. We do not present phenotype, yield, potency, aroma, or finish dates as guarantees.</p>${button('/tools/','Document your grow',true)}${button('/community/','Share observations',false)}</div></div></section>
</div>`;

const shopHtml=`<div data-dtf-visual="shop-premium-2026" style="background:#f6f8f4;color:#173522">
<section style="max-width:1240px;margin:auto;padding:58px 22px 42px;display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:42px;align-items:center"><div>${eyebrow('DTF Genetics Shop')}<h1 style="font-size:clamp(2.7rem,6vw,5rem);line-height:.98;letter-spacing:-.045em;margin:0 0 20px">Shop the line. Read the story.</h1><p style="font-size:1.13rem;line-height:1.8;color:#48604f">The storefront and genetics catalog work together: WooCommerce controls the transaction while DTF Genetics documents lineage, generation context, and breeding direction.</p><p>${button('#seed-releases','View current seed routes',true)}${button('/seeds/','Explore genetics',false)}${button('/learn/','Learn before you grow',false)}</p></div><div>${img(picks.flower||picks.trichome,'Cannabis flower and trichome educational reference',{ratio:'1/1',eager:true})}</div></section>

<section id="seed-releases" style="max-width:1240px;margin:auto;padding:12px 22px 62px"><div>${eyebrow('Current product routes')}<h2 style="font-size:clamp(2rem,4vw,3.35rem);margin:0 0 24px">Three reviewed genetics listings</h2></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">
${panel(`<h3 style="font-size:1.5rem;margin-top:0">Blue Mango F2 — Regular</h3><p style="color:#53665a;line-height:1.7">Current WooCommerce route for the regular F2 Blue Mango release.</p>${button('/product/10-regular-f2-blue-mango-seeds/','View listing',true)}${button('/seeds/#current-releases','Breeding context',false)}`)}
${panel(`<h3 style="font-size:1.5rem;margin-top:0">Blue Mango F2 — Feminized</h3><p style="color:#53665a;line-height:1.7">Current WooCommerce route for the feminized F2 Blue Mango release.</p>${button('/product/10-feminized-f2-blue-mango-x/','View listing',true)}${button('/seeds/#current-releases','Breeding context',false)}`)}
${panel(`<h3 style="font-size:1.5rem;margin-top:0">Blue Bubblegum F1 — Regular</h3><p style="color:#53665a;line-height:1.7">Current reviewed F1 product route. The existing product slug is retained while catalog naming remains controlled.</p>${button('/product/10-reg-f1-blueberry-bubblegum/','View listing',true)}${button('/seeds/#current-releases','Breeding context',false)}`)}
</div><p style="margin-top:22px;color:#596c5e">Prices, sale prices, stock, quantities, shipping eligibility, and transaction policies are intentionally not hard-coded here; check the exact product page.</p></section>

<section style="background:#12341f;color:#fff"><div style="max-width:1240px;margin:auto;padding:62px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px">
${panel(`${eyebrow('Genetics')}<h3 style="font-size:1.55rem;margin-top:0">Seeds & breeding projects</h3><p style="line-height:1.7;color:#506357">Current releases connect back to documented lineage and project context.</p>${button('/seeds/','Explore genetics',true)}`)}
${panel(`${eyebrow('Education')}<h3 style="font-size:1.55rem;margin-top:0">Teaching Healthy Cultivation</h3><p style="line-height:1.7;color:#506357">Use the education system, infographic library, and diagnostics to understand the plant beyond the product page.</p>${button('/learn/','Start learning',true)}`)}
${panel(`${eyebrow('Community')}<h3 style="font-size:1.55rem;margin-top:0">Grow logs & announcements</h3><p style="line-height:1.7;color:#506357">Follow community grow reports, events, grow-offs, game testing, and official DTF announcements.</p>${button('https://discord.gg/xJbUeHFPMt','Join Discord',true)}`)}
</div></div></section>

<section style="max-width:1240px;margin:auto;padding:64px 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:28px;align-items:center"><div>${img(picks.lifecycle,'Cannabis lifecycle educational reference',{ratio:'4/3'})}</div><div>${eyebrow('Before you buy')}<h2 style="font-size:clamp(2rem,4vw,3.25rem);margin:0 0 14px">Verify the exact listing.</h2><ul style="line-height:1.85;color:#4e6354;padding-left:22px"><li>Confirm generation, seed type, pack quantity, availability, and shipping eligibility.</li><li>Use DTF-controlled product and checkout routes.</li><li>Do not rely on an old social post for current transaction details.</li><li>Follow local laws and destination restrictions.</li></ul><p>${button('/seeds/','Read genetics profiles',true)}${button('/community/','Official community links',false)}</p></div></section>
</div>`;

const brandId=Number(brand?.id||0);
if(!brandId) throw new Error('DTF brand media was not resolved');
const settingsPayload={};
if(Object.prototype.hasOwnProperty.call(settings,'site_icon')) settingsPayload.site_icon=brandId;
if(Object.prototype.hasOwnProperty.call(settings,'site_logo')) settingsPayload.site_logo=brandId;
if(apply&&Object.keys(settingsPayload).length) await request('/wp-json/wp/v2/settings',{method:'POST',body:JSON.stringify(settingsPayload)});

await backupAndUpdate(home,{featured_media:brandId});
await backupAndUpdate(seeds,{title:'DTF Genetics | Seeds & Breeding Projects',content:seedsHtml,featured_media:Number(picks.genetics?.id||picks.hero?.id||brandId)});
await backupAndUpdate(shop,{title:'DTF Genetics Shop | Current Releases',content:shopHtml,featured_media:brandId});

const aioseoRoutes=Object.keys(index?.routes||{}).filter(key=>/aioseo|social|open-graph/i.test(key));
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,brandMediaId:brandId,brandMediaUrl:brand?.source_url||null,settingsPayload,selectedMedia:Object.fromEntries(Object.entries(picks).map(([k,v])=>[k,v?{id:v.id,title:plain(rendered(v.title)),url:v.source_url}:null])),updatedPages:[{id:home.id,slug:'home',featuredMedia:brandId},{id:seeds.id,slug:'seeds',featuredMedia:Number(picks.genetics?.id||picks.hero?.id||brandId)},{id:shop.id,slug:'shop',featuredMedia:brandId}],aioseoRoutes};
await writeFile(join(backupDir,'commerce-visual-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'commerce-visual-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
