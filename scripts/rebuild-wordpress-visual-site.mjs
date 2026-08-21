import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-visual-rebuild';
const apply = String(process.env.APPLY_VISUAL_REBUILD || '').toLowerCase() === 'true';
const brandPath = process.env.DTF_BRAND_ICON || join(process.cwd(), 'site/wordpress/assets/brand/dtf-potleaf-512.png');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Visual-Rebuild/1.0' };
const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `visual-rebuild-${timestamp}`);
await mkdir(backupDir, { recursive: true });

function esc(value='') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function rendered(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.rendered || value.raw || '';
  return '';
}

function plain(value='') {
  return String(value).replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
}

async function request(path, options={}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0,500) : JSON.stringify(body).slice(0,500)}`);
  return body;
}

async function fetchAllMedia() {
  const rows=[];
  for (let page=1; page<=5; page++) {
    try {
      const batch = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || !batch.length) break;
      rows.push(...batch);
      if (batch.length < 100) break;
    } catch (error) {
      if (/400|rest_post_invalid_page_number/i.test(error.message)) break;
      throw error;
    }
  }
  return rows;
}

function mediaText(item) {
  return [item.slug, rendered(item.title), rendered(item.caption), rendered(item.description), item.source_url].join(' ').toLowerCase();
}

function choose(media, groups, used=new Set()) {
  for (const group of groups) {
    const needles = Array.isArray(group) ? group : [group];
    const found = media.find((item) => item?.source_url && !used.has(item.id) && needles.every((needle) => mediaText(item).includes(String(needle).toLowerCase())));
    if (found) { used.add(found.id); return found; }
  }
  return null;
}

function imageUrl(item) { return item?.source_url || item?.guid?.rendered || ''; }
function imageAlt(item, fallback) { return plain(rendered(item?.alt_text) || rendered(item?.title) || fallback); }

function img(item, alt, {ratio='4/3', eager=false, radius='22px'}={}) {
  if (!item) return '';
  const url=esc(imageUrl(item));
  return `<img src="${url}" alt="${esc(imageAlt(item, alt))}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="display:block;width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:${radius};box-shadow:0 16px 38px rgba(0,0,0,.16)">`;
}

function button(href, label, primary=true) {
  const bg = primary ? '#1c7e40' : '#ffffff';
  const fg = primary ? '#ffffff' : '#14351f';
  const border = primary ? '#1c7e40' : '#b7cdbd';
  return `<a href="${esc(href)}" style="display:inline-block;margin:5px 7px 5px 0;padding:12px 18px;border-radius:999px;background:${bg};color:${fg};border:1px solid ${border};text-decoration:none;font-weight:800">${esc(label)}</a>`;
}

function card({title, text, href, image, label='Open'}) {
  return `<article style="overflow:hidden;border:1px solid #d7e5da;border-radius:22px;background:#fff;box-shadow:0 12px 30px rgba(17,55,29,.08)">${image ? img(image,title,{ratio:'16/10',radius:'0'}) : ''}<div style="padding:20px"><h3 style="margin:0 0 10px;font-size:1.3rem">${esc(title)}</h3><p style="margin:0 0 16px;line-height:1.65;color:#35543f">${esc(text)}</p>${button(href,label,true)}</div></article>`;
}

function visualCard(item, title, text, href='/learn/infographics/') {
  return `<article style="overflow:hidden;border:1px solid #dce9df;border-radius:20px;background:#fff">${img(item,title,{ratio:'4/3',radius:'0'})}<div style="padding:16px"><h3 style="margin:0 0 8px;font-size:1.08rem">${esc(title)}</h3><p style="margin:0 0 12px;color:#496152;line-height:1.5;font-size:.95rem">${esc(text)}</p><a href="${esc(href)}" style="font-weight:800;color:#176b37;text-decoration:none">Explore →</a></div></article>`;
}

async function getPage(slug) {
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one page for slug ${slug}, found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}

async function updatePage(page, content, title=null) {
  await writeFile(join(backupDir, `page-${page.id}-${page.slug}-before.json`), `${JSON.stringify(page,null,2)}\n`);
  if (!apply) return page;
  return request(`/wp-json/wp/v2/pages/${page.id}`, {method:'POST', body:JSON.stringify({content,status:'publish',...(title ? {title} : {})})});
}

async function ensureBrandMedia() {
  const existing=await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
  if (Array.isArray(existing) && existing[0]?.source_url) return existing[0];
  if (!apply) return null;
  const bytes=await readFile(brandPath);
  const response=await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method:'POST',
    headers:{...headers,'Content-Type':'image/png','Content-Disposition':`attachment; filename="${basename(brandPath)}"`},
    body:bytes,
    redirect:'follow',
    signal:AbortSignal.timeout(120_000)
  });
  const text=await response.text();
  let body=null; try { body=JSON.parse(text); } catch { body={raw:text.slice(0,500)}; }
  if (!response.ok || !body?.id) throw new Error(`Brand media upload failed (${response.status})`);
  return request(`/wp-json/wp/v2/media/${body.id}`, {method:'POST', body:JSON.stringify({slug:'dtf-potleaf-site-icon',title:'DTF Genetics Cannabis Leaf',alt_text:'DTF Genetics cannabis leaf logo',caption:'DTF Genetics cannabis leaf brand mark'})});
}

async function applySiteIcon(brand) {
  const settings=await request('/wp-json/wp/v2/settings?context=edit');
  await writeFile(join(backupDir,'settings-before.json'),`${JSON.stringify(settings,null,2)}\n`);
  if (!apply || !brand?.id) return {siteIconSupported:Object.prototype.hasOwnProperty.call(settings,'site_icon'), siteLogoSupported:Object.prototype.hasOwnProperty.call(settings,'site_logo')};
  const payload={};
  if (Object.prototype.hasOwnProperty.call(settings,'site_icon')) payload.site_icon=brand.id;
  if (Object.prototype.hasOwnProperty.call(settings,'site_logo')) payload.site_logo=brand.id;
  if (Object.keys(payload).length) await request('/wp-json/wp/v2/settings',{method:'POST',body:JSON.stringify(payload)});
  return {siteIconSupported:Object.prototype.hasOwnProperty.call(settings,'site_icon'), siteLogoSupported:Object.prototype.hasOwnProperty.call(settings,'site_logo'), payload};
}

async function rebuildHeaderFooter(brand) {
  const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
  await writeFile(join(backupDir,'template-parts-before.json'),`${JSON.stringify(parts,null,2)}\n`);
  const leaf=brand?.source_url ? `<a href="/" aria-label="DTF Genetics home" style="display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none"><img src="${esc(brand.source_url)}" alt="DTF Genetics cannabis leaf" width="48" height="48" style="width:48px;height:48px;object-fit:contain"><span style="font-size:1.15rem;font-weight:900;letter-spacing:.02em">DTF Genetics</span></a>` : '<a href="/" style="font-weight:900;color:#fff;text-decoration:none">DTF Genetics</a>';
  const header=`<!-- wp:html --><header style="background:#0f2f1c;color:#fff;border-bottom:1px solid rgba(255,255,255,.1)"><div style="max-width:1240px;margin:auto;padding:14px 22px;display:flex;gap:22px;align-items:center;justify-content:space-between;flex-wrap:wrap">${leaf}<nav aria-label="Primary navigation" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><a href="/seeds/" style="color:#fff;text-decoration:none;padding:9px 11px;font-weight:700">Seeds</a><a href="/learn/" style="color:#fff;text-decoration:none;padding:9px 11px;font-weight:700">Learn</a><a href="/tools/" style="color:#fff;text-decoration:none;padding:9px 11px;font-weight:700">Tools</a><a href="/games/" style="color:#fff;text-decoration:none;padding:9px 11px;font-weight:700">Games</a><a href="/community/" style="color:#fff;text-decoration:none;padding:9px 11px;font-weight:700">Community</a><a href="/shop/" style="color:#0f2f1c;background:#d9f06e;text-decoration:none;padding:9px 15px;border-radius:999px;font-weight:900">Shop</a></nav></div></header><!-- /wp:html -->`;
  const footer=`<!-- wp:html --><footer style="margin-top:60px;background:#0f2f1c;color:#dfece3"><div style="max-width:1240px;margin:auto;padding:42px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px"><div>${leaf}<p style="line-height:1.6;color:#bcd1c2">Dream the Future. Genetics, plant science, cultivation tools, original games, and community education.</p></div><div><strong style="color:#fff">Explore</strong><p style="line-height:2"><a href="/seeds/" style="color:#dfece3">Genetics</a><br><a href="/learn/" style="color:#dfece3">Teaching Healthy Cultivation</a><br><a href="/learn/infographics/" style="color:#dfece3">Infographics</a><br><a href="/tools/" style="color:#dfece3">Tools</a><br><a href="/games/" style="color:#dfece3">Games</a></p></div><div><strong style="color:#fff">Community</strong><p><a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer" style="color:#d9f06e;font-weight:800">Join the THC Discord</a></p><p style="color:#bcd1c2">Adults only. Follow all applicable local laws.</p></div></div><hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:28px 0"><p style="margin:0;color:#9fbaa8">© 2026 DTF Genetics · Dream the Future</p></div></footer><!-- /wp:html -->`;
  const targets=(parts||[]).filter(p=>p.theme==='hostinger-ai-theme' && (p.slug==='header' || String(p.slug).startsWith('footer')));
  if (apply) {
    for (const part of targets) {
      const content=part.slug==='header' ? header : footer;
      await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
    }
  }
  return targets.map(x=>x.id);
}

const media=await fetchAllMedia();
await writeFile(join(backupDir,'media-index.json'),`${JSON.stringify(media.map(m=>({id:m.id,slug:m.slug,title:plain(rendered(m.title)),source_url:m.source_url})),null,2)}\n`);
const used=new Set();
const picks={
  hero:choose(media,[['whole','plant','atlas'],['plant','anatomy'],['cell','canopy']],used),
  anatomy:choose(media,[['plant','anatomy'],['cell','canopy']],used),
  roots:choose(media,[['root','anatomy'],['root','zone','chemistry']],used),
  leaf:choose(media,[['leaf','anatomy'],['gas','exchange']],used),
  trichome:choose(media,[['trichome','secretory'],['trichome']],used),
  lifecycle:choose(media,[['life','cycle','seed','harvest'],['seedling','establishment']],used),
  nutrition:choose(media,[['nutrition','science'],['nutrient','uptake'],['primary','macronutrients']],used),
  diagnose:choose(media,[['diagnosing','deficiency','toxicity'],['deficiency','toxicity']],used),
  ipm:choose(media,[['beneficial','insects'],['spider','mite']],used),
  training:choose(media,[['plant','training','basics'],['stem','training','risk']],used),
  cloning:choose(media,[['cloning','guide'],['germination']],used),
  genetics:choose(media,[['sex','expression'],['breeding','projects']],used),
  flower:choose(media,[['flower','anatomy'],['reproductive','structures']],used),
  evidence:choose(media,[['evidence','claim','specific'],['observation','bounded','conclusion']],used),
  mango:choose(media,[['mango'],['seed','artwork']],used),
  environment:choose(media,[['vpd'],['temperature','humidity'],['environment']],used),
  light:choose(media,[['ppfd'],['dli'],['lighting'],['light']],used),
  harvest:choose(media,[['harvest'],['drying'],['curing']],used)
};

const missing=Object.entries(picks).filter(([,v])=>!v).map(([k])=>k);

const home=await getPage('home');
const learn=await getPage('learn');

const homeHtml=`
<div style="background:#f6faf6;color:#16321f;font-family:inherit">
<section style="max-width:1240px;margin:auto;padding:56px 22px 34px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:42px;align-items:center">
  <div><p style="margin:0 0 10px;color:#1c7e40;font-weight:900;letter-spacing:.12em;text-transform:uppercase">DTF Genetics · Dream the Future</p><h1 style="font-size:clamp(2.4rem,6vw,5rem);line-height:.98;margin:0 0 20px;letter-spacing:-.04em">Genetics. Plant science. Tools. Games. Community.</h1><p style="font-size:1.15rem;line-height:1.75;color:#3c5945;max-width:720px">A single home for DTF genetics, Teaching Healthy Cultivation, practical grow tools, visual plant science, original cannabis games, and the community building them.</p><p>${button('/learn/','Start learning',true)}${button('/seeds/','Explore genetics',false)}${button('/tools/','Use grow tools',false)}${button('/games/','Play games',false)}</p></div>
  <div>${img(picks.hero,'Teaching Healthy Cultivation plant science',{ratio:'1/1',eager:true})}</div>
</section>

<section style="max-width:1240px;margin:18px auto 0;padding:0 22px 54px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px">
${card({title:'Teaching Healthy Cultivation',text:'Structured learning from plant anatomy and environment through nutrition, IPM, harvest, breeding, and evidence-based diagnostics.',href:'/learn/',image:picks.anatomy,label:'Open education'})}
${card({title:'THC Grow Doc',text:'Organize symptoms, grow context, evidence, and likely causes instead of diagnosing from a single photo.',href:'/thc-grow-doc/',image:picks.diagnose,label:'Start diagnosis'})}
${card({title:'DTF Genetics',text:'Explore documented breeding projects, lineages, generation context, current releases, and plant observations.',href:'/seeds/',image:picks.genetics,label:'Explore genetics'})}
${card({title:'Original Games',text:'Play cannabis-themed browser games, knowledge challenges, strategy projects, and community-built experiences.',href:'/games/',image:picks.trichome,label:'Open Game Hub'})}
</div></section>

<section style="background:#102f1c;color:#fff"><div style="max-width:1240px;margin:auto;padding:56px 22px"><p style="color:#d9f06e;font-weight:900;text-transform:uppercase;letter-spacing:.1em">Teaching Healthy Cultivation</p><h2 style="font-size:clamp(2rem,4vw,3.6rem);margin:0 0 12px">Learn by seeing the plant as a system.</h2><p style="max-width:820px;color:#c6dacb;line-height:1.75;font-size:1.08rem">The visual library connects anatomy, roots, leaves, environment, nutrition, training, crop stages, pest management, harvest, and genetics so the information is useful in the grow room—not just readable on a page.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:28px">
${visualCard(picks.roots,'Roots & the root zone','Understand root anatomy, oxygen, irrigation, pH, EC, and nutrient availability.')}
${visualCard(picks.leaf,'Leaves & gas exchange','Connect leaf structure to light capture, transpiration, stomata, and crop response.')}
${visualCard(picks.nutrition,'Nutrition & uptake','Learn macronutrients, micronutrients, uptake, interactions, and root-zone chemistry.')}
${visualCard(picks.ipm,'IPM & plant health','Use prevention, scouting, identification, biological controls, and evidence before treatment.')}
${visualCard(picks.training,'Training & canopy','Understand topping, LST, pruning, support, airflow, and light distribution.')}
${visualCard(picks.trichome,'Flowers & trichomes','Study reproductive anatomy, trichome biology, maturation, and harvest observation.')}
</div><p style="margin-top:28px">${button('/learn/infographics/','Browse 100+ educational visuals',true)}${button('/learn/','Open the full learning system',false)}</p></div></section>

<section style="max-width:1240px;margin:auto;padding:62px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px;align-items:center"><div>${img(picks.diagnose,'Cannabis plant health diagnosis visual',{ratio:'4/3'})}</div><div><p style="color:#1c7e40;font-weight:900;text-transform:uppercase;letter-spacing:.1em">Plant-health workflow</p><h2 style="font-size:clamp(2rem,4vw,3.2rem);margin:0 0 14px">Diagnose with evidence, not guesses.</h2><p style="line-height:1.75;color:#3f5c48">Symptoms overlap. Start with where the problem appears, how it progresses, plant stage, root-zone conditions, irrigation, environment, recent changes, pest evidence, and measurements. Grow Doc turns that information into a structured differential.</p><p>${button('/thc-grow-doc/','Open THC Grow Doc',true)}${button('/yellow-leaves/','Read the yellow-leaves guide',false)}</p></div></div></section>

<section style="background:#edf5ef"><div style="max-width:1240px;margin:auto;padding:58px 22px"><p style="color:#1c7e40;font-weight:900;text-transform:uppercase;letter-spacing:.1em">From seed to selection</p><h2 style="font-size:clamp(2rem,4vw,3.2rem);margin:0 0 26px">Education connected to real cultivation work.</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px">
${visualCard(picks.lifecycle,'Crop lifecycle','Germination, seedlings, vegetative growth, flowering, harvest, and the transitions between them.','/learn/')}
${visualCard(picks.cloning,'Propagation','Seeds, seedlings, cloning, establishment, and the environment that supports early growth.','/learn/')}
${visualCard(picks.environment,'Environment & VPD','Temperature, humidity, leaf temperature, VPD, airflow, and environmental stability.','/learn/')}
${visualCard(picks.light,'Lighting & DLI','PPFD, photoperiod, DLI, spectrum, distance, distribution, and plant response.','/learn/')}
</div></div></section>

<section style="max-width:1240px;margin:auto;padding:62px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px"><article style="padding:28px;border:1px solid #d7e5da;border-radius:22px"><h2>Grow tools</h2><p style="line-height:1.7;color:#425c4a">Use GrowLens for cultivation records, environmental calculations, journals, tasks, plant photos, feeding, irrigation, harvest records, reports, and exports.</p>${button('/growlens/','Open GrowLens',true)}${button('/tools/','All tools',false)}</article><article style="padding:28px;border:1px solid #d7e5da;border-radius:22px"><h2>DTF Genetics</h2><p style="line-height:1.7;color:#425c4a">Follow breeding projects with parentage, generations, selection notes, current release routes, and claim-safe phenotype observations.</p>${button('/seeds/','Genetics catalog',true)}${button('/shop/','Current releases',false)}</article><article style="padding:28px;border:1px solid #d7e5da;border-radius:22px"><h2>Community</h2><p style="line-height:1.7;color:#425c4a">Grow discussions, game testing, grow-offs, education, and project feedback live in the Teaching Healthy Cultivation community.</p>${button('https://discord.gg/xJbUeHFPMt','Join Discord',true)}${button('/community/','Community page',false)}</article></div></section>
</div>`;

const subjectCards=[
  [picks.anatomy,'Plant anatomy & physiology','Cells, tissues, roots, stems, leaves, flowers, water movement, photosynthesis, respiration, and plant signaling.'],
  [picks.lifecycle,'Lifecycle & propagation','Germination, seedlings, cloning, vegetative growth, flowering, maturation, and crop transitions.'],
  [picks.environment,'Environment & VPD','Temperature, RH, leaf temperature, VPD, airflow, carbon dioxide, stability, and measurement.'],
  [picks.light,'Lighting','PPFD, DLI, photoperiod, spectrum, fixture distance, uniformity, measurement, and plant response.'],
  [picks.roots,'Water & root zone','Water quality, irrigation, oxygen, media, pH, EC, dryback, salinity, and root health.'],
  [picks.nutrition,'Nutrition','Macro- and micronutrients, availability, interactions, uptake, deficiencies, toxicities, and context.'],
  [picks.training,'Training & canopy','LST, topping, pruning, HST, SCROG, mainlining, support, airflow, and canopy distribution.'],
  [picks.ipm,'IPM & plant health','Exclusion, sanitation, scouting, pest identification, biological controls, pathogens, and action thresholds.'],
  [picks.trichome,'Harvest & post-harvest','Trichome observation, harvest readiness, handling, drying, curing, storage, and quality preservation.'],
  [picks.genetics,'Genetics & breeding','Sex expression, genotype and phenotype, filial generations, inheritance, selection, variation, and documentation.']
];

const learnHtml=`<div style="background:#f7faf7;color:#173420">
<section style="max-width:1240px;margin:auto;padding:54px 22px 34px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:40px;align-items:center"><div><p style="color:#1c7e40;font-weight:900;letter-spacing:.12em;text-transform:uppercase">Teaching Healthy Cultivation</p><h1 style="font-size:clamp(2.5rem,6vw,4.8rem);line-height:1;margin:0 0 18px;letter-spacing:-.04em">Understand the plant. Build the environment. Make better decisions.</h1><p style="font-size:1.12rem;line-height:1.8;color:#415e4b">A visual cultivation education system covering plant biology, environment, lighting, water, root-zone management, nutrition, crop stages, training, IPM, harvest, genetics, breeding, and evidence-based plant-health reasoning.</p><p>${button('/learn/infographics/','Browse the visual library',true)}${button('/thc-grow-doc/','Diagnose a plant problem',false)}${button('/growlens/','Track a grow',false)}</p></div><div>${img(picks.anatomy,'Cannabis plant anatomy educational visual',{ratio:'1/1',eager:true})}</div></section>

<section style="max-width:1240px;margin:auto;padding:30px 22px 62px"><h2 style="font-size:clamp(2rem,4vw,3.2rem)">Explore by subject</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px">${subjectCards.map(([image,title,text])=>visualCard(image,title,text,'/learn/infographics/')).join('')}</div></section>

<section style="background:#102f1c;color:#fff"><div style="max-width:1240px;margin:auto;padding:60px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:32px;align-items:center"><div>${img(picks.diagnose,'Deficiency versus toxicity diagnostic visual',{ratio:'4/3'})}</div><div><p style="color:#d9f06e;font-weight:900;text-transform:uppercase;letter-spacing:.1em">Plant-health reasoning</p><h2 style="font-size:clamp(2rem,4vw,3.2rem);margin-top:0">A symptom is not a diagnosis.</h2><ol style="line-height:1.9;color:#d5e4d9;padding-left:22px"><li>Locate where the symptom began.</li><li>Describe the pattern precisely.</li><li>Add plant stage and recent changes.</li><li>Measure environment and root-zone conditions.</li><li>Compare more than one plausible cause.</li><li>Track progression before and after correction.</li></ol><p>${button('/thc-grow-doc/','Use THC Grow Doc',true)}${button('/yellow-leaves/','Yellow-leaves guide',false)}</p></div></div></div></section>

<section style="max-width:1240px;margin:auto;padding:62px 22px"><p style="color:#1c7e40;font-weight:900;text-transform:uppercase;letter-spacing:.1em">Featured visual lessons</p><h2 style="font-size:clamp(2rem,4vw,3.2rem);margin-top:0">See the science, then apply it.</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">${[
[picks.roots,'Root anatomy & forensics'],[picks.leaf,'Leaf anatomy & gas exchange'],[picks.flower,'Flower anatomy & reproduction'],[picks.trichome,'Trichome secretory biology'],[picks.nutrition,'Nutrient uptake & root-zone chemistry'],[picks.training,'Training and structural risk'],[picks.ipm,'Biological controls & IPM'],[picks.evidence,'Evidence and bounded conclusions'],[picks.genetics,'Sex expression & breeding']].map(([image,title])=>`<figure style="margin:0;background:#fff;border:1px solid #dce9df;border-radius:20px;overflow:hidden">${img(image,title,{ratio:'4/3',radius:'0'})}<figcaption style="padding:14px 16px;font-weight:800">${esc(title)}</figcaption></figure>`).join('')}</div><p style="margin-top:28px">${button('/learn/infographics/','Open all educational visuals',true)}</p></section>

<section style="background:#edf5ef"><div style="max-width:1240px;margin:auto;padding:60px 22px"><h2 style="font-size:clamp(2rem,4vw,3.2rem);margin-top:0">Choose a learning path</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px"><article style="background:#fff;padding:24px;border-radius:20px"><h3>New grower</h3><p style="line-height:1.7;color:#455e4d">Start with plant biology, environment, lighting, water, root-zone conditions, crop stages, sanitation, and observation.</p></article><article style="background:#fff;padding:24px;border-radius:20px"><h3>Plant problem</h3><p style="line-height:1.7;color:#455e4d">Start with symptom pattern, plant stage, irrigation, roots, pH/EC when relevant, environment, pests, and progression.</p></article><article style="background:#fff;padding:24px;border-radius:20px"><h3>Environmental control</h3><p style="line-height:1.7;color:#455e4d">Build from temperature, RH, leaf temperature, VPD, airflow, PPFD, DLI, photoperiod, and repeatable measurements.</p></article><article style="background:#fff;padding:24px;border-radius:20px"><h3>Breeding & documentation</h3><p style="line-height:1.7;color:#455e4d">Use labels, photos, environmental records, phenotype notes, timelines, selection criteria, and source-backed conclusions.</p></article></div></div></section>

<section style="max-width:1240px;margin:auto;padding:62px 22px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px"><article style="border:1px solid #d7e5da;border-radius:22px;padding:28px"><h2>100+ educational visuals</h2><p style="line-height:1.7;color:#425c4a">The infographic library is hosted in the DTFSeeds WordPress Media Library so visuals load from the site itself, not from GitHub raw links.</p>${button('/learn/infographics/','Browse infographics',true)}</article><article style="border:1px solid #d7e5da;border-radius:22px;padding:28px"><h2>Put it to work</h2><p style="line-height:1.7;color:#425c4a">Use GrowLens for records and calculations, and Grow Doc for structured plant-health evidence and differentials.</p>${button('/tools/','Open cultivation tools',true)}</article><article style="border:1px solid #d7e5da;border-radius:22px;padding:28px"><h2>Learn with the community</h2><p style="line-height:1.7;color:#425c4a">Bring grow observations, questions, photos, measurements, and project ideas to Teaching Healthy Cultivation.</p>${button('https://discord.gg/xJbUeHFPMt','Join Discord',true)}</article></div></section>
</div>`;

const brand=await ensureBrandMedia();
const settingsResult=await applySiteIcon(brand);
const presentationTargets=await rebuildHeaderFooter(brand);
await updatePage(home,homeHtml,'DTF Genetics | Dream the Future');
await updatePage(learn,learnHtml,'Teaching Healthy Cultivation');

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,mediaCount:media.length,brandMediaId:brand?.id||null,brandMediaUrl:brand?.source_url||null,settingsResult,presentationTargets,selectedMedia:Object.fromEntries(Object.entries(picks).map(([k,v])=>[k,v?{id:v.id,title:plain(rendered(v.title)),url:v.source_url}:null])),missingSelections:missing,updatedPages:[{id:home.id,slug:home.slug},{id:learn.id,slug:learn.slug}]};
await writeFile(join(backupDir,'visual-rebuild-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'visual-rebuild-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
