import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_BEGINNER_V5||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-beginner-v5';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Beginner-V5/1.0'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`beginner-v5-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;
      try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1800);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1800);}
  }
  throw last;
}

async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if(!Array.isArray(rows)) throw new Error(`${slug}: invalid WordPress response.`);
  if(rows.length!==1) throw new Error(`${slug}: expected exactly one page, found ${rows.length}.`);
  return rows[0];
}

function scopedCss(pageId){return `<style id="dtf-beginner-v5-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}
.dtf-beginner-v5{--ink:#12311d;--deep:#071b10;--green:#176d39;--gold:#d7b95f;--cream:#f7f4ea;--soft:#edf3ec;--line:#d5e1d7;--muted:#526457;background:var(--cream);color:var(--ink);overflow:hidden}.dtf-beginner-v5 *{box-sizing:border-box}.dtf-beginner-v5 .wrap{width:min(1180px,calc(100% - 34px));margin:auto}.dtf-beginner-v5 .hero{padding:72px 0 62px;background:radial-gradient(circle at 84% 12%,rgba(215,185,95,.23),transparent 31%),linear-gradient(145deg,var(--deep),#103b23);color:#fff}.dtf-beginner-v5 .hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:42px;align-items:center}.dtf-beginner-v5 .kicker{margin:0 0 10px;color:var(--gold);font-size:.76rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.dtf-beginner-v5 h1{margin:0;font-size:clamp(2.8rem,6vw,5.35rem);line-height:.95;letter-spacing:-.055em}.dtf-beginner-v5 .lede{max-width:760px;margin:20px 0 0;color:#d5e2d9;font-size:1.08rem;line-height:1.72}.dtf-beginner-v5 .actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:25px}.dtf-beginner-v5 .btn{display:inline-flex;align-items:center;justify-content:center;min-height:45px;padding:10px 17px;border-radius:999px;text-decoration:none!important;font-weight:900;border:1px solid transparent}.dtf-beginner-v5 .btn.primary{background:var(--gold);color:var(--deep)!important}.dtf-beginner-v5 .btn.secondary{border-color:rgba(255,255,255,.28);color:#fff!important;background:rgba(255,255,255,.06)}.dtf-beginner-v5 .hero-card{padding:25px;border-radius:25px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16)}.dtf-beginner-v5 .hero-card strong{display:block;font-size:1.22rem;margin-bottom:9px}.dtf-beginner-v5 .hero-card ol{margin:14px 0 0;padding-left:1.2rem;color:#d7e3da;line-height:1.75}.dtf-beginner-v5 .section{padding:66px 0}.dtf-beginner-v5 .soft{background:var(--soft)}.dtf-beginner-v5 .dark{background:#0c2a19;color:#fff}.dtf-beginner-v5 .heading{display:flex;align-items:end;justify-content:space-between;gap:26px;margin-bottom:27px}.dtf-beginner-v5 .heading>div{max-width:720px}.dtf-beginner-v5 .heading h2{margin:0;font-size:clamp(2rem,4vw,3.35rem);line-height:1.02;letter-spacing:-.04em}.dtf-beginner-v5 .heading p{max-width:520px;margin:0;color:var(--muted);line-height:1.65}.dtf-beginner-v5 .dark .heading p{color:#c3d3c8}.dtf-beginner-v5 .principles,.dtf-beginner-v5 .modules,.dtf-beginner-v5 .milestones,.dtf-beginner-v5 .traps{display:grid;gap:17px}.dtf-beginner-v5 .principles{grid-template-columns:repeat(3,minmax(0,1fr))}.dtf-beginner-v5 .modules{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-beginner-v5 .milestones,.dtf-beginner-v5 .traps{grid-template-columns:repeat(3,minmax(0,1fr))}.dtf-beginner-v5 .card,.dtf-beginner-v5 .module,.dtf-beginner-v5 .milestone,.dtf-beginner-v5 .trap{background:#fff;border:1px solid var(--line);border-radius:21px;padding:22px;box-shadow:0 11px 28px rgba(15,48,27,.055)}.dtf-beginner-v5 .module{display:grid;grid-template-columns:auto 1fr;gap:15px}.dtf-beginner-v5 .num{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#e7efe7;color:var(--green);font-weight:950}.dtf-beginner-v5 .module h3,.dtf-beginner-v5 .card h3,.dtf-beginner-v5 .milestone h3,.dtf-beginner-v5 .trap h3{margin:0 0 7px;font-size:1.22rem}.dtf-beginner-v5 .module p,.dtf-beginner-v5 .card p,.dtf-beginner-v5 .milestone p,.dtf-beginner-v5 .trap p{margin:0;color:var(--muted);line-height:1.62}.dtf-beginner-v5 .module .links{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}.dtf-beginner-v5 .text-link{color:var(--green)!important;font-weight:900;text-decoration:none!important}.dtf-beginner-v5 .checklist{display:grid;grid-template-columns:1fr 1fr;gap:16px}.dtf-beginner-v5 .checklist ul{margin:0;padding:0;list-style:none;display:grid;gap:9px}.dtf-beginner-v5 .checklist li{position:relative;padding:12px 14px 12px 40px;background:#fff;border:1px solid var(--line);border-radius:14px;line-height:1.48}.dtf-beginner-v5 .checklist li:before{content:'✓';position:absolute;left:14px;color:var(--green);font-weight:950}.dtf-beginner-v5 details{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px 17px}.dtf-beginner-v5 details+details{margin-top:10px}.dtf-beginner-v5 summary{cursor:pointer;font-weight:900}.dtf-beginner-v5 details p{color:var(--muted);line-height:1.62}.dtf-beginner-v5 .callout{padding:28px;border-radius:24px;background:linear-gradient(145deg,#103a22,#0a2215);color:#fff}.dtf-beginner-v5 .callout h2{margin:0 0 10px;font-size:clamp(1.9rem,4vw,3rem)}.dtf-beginner-v5 .callout p{max-width:760px;color:#c7d8cc;line-height:1.68}.dtf-beginner-v5 .dark .card{background:#12351f;border-color:#31543d;box-shadow:none}.dtf-beginner-v5 .dark .card p{color:#bed0c3}
@media(max-width:900px){.dtf-beginner-v5 .hero-grid,.dtf-beginner-v5 .modules,.dtf-beginner-v5 .checklist{grid-template-columns:1fr}.dtf-beginner-v5 .principles,.dtf-beginner-v5 .milestones,.dtf-beginner-v5 .traps{grid-template-columns:repeat(2,minmax(0,1fr))}.dtf-beginner-v5 .heading{align-items:flex-start;flex-direction:column}}
@media(max-width:620px){.dtf-beginner-v5 .wrap{width:min(100% - 26px,1180px)}.dtf-beginner-v5 .hero{padding:52px 0 45px}.dtf-beginner-v5 h1{font-size:clamp(2.5rem,13vw,4rem)}.dtf-beginner-v5 .section{padding:50px 0}.dtf-beginner-v5 .principles,.dtf-beginner-v5 .milestones,.dtf-beginner-v5 .traps{grid-template-columns:1fr}.dtf-beginner-v5 .actions .btn{width:100%}}
</style>`}

const modules=[
  ['Plant stage & anatomy','Learn what roots, stems, leaves, flowers, stomata, vascular tissue, and developmental stage normally do before interpreting a symptom.','/learn/plant-biology/','Plant Biology'],
  ['Propagation & establishment','Follow seeds and cuttings through germination, rooting, acclimation, transplanting, and early establishment without treating calendar age as the only milestone.','/learn/lifecycle-propagation/','Lifecycle & Propagation'],
  ['Environment & VPD','Measure air temperature, humidity, leaf temperature where possible, airflow, transitions, and VPD as connected environmental evidence.','/learn/environment-vpd/','Environment & VPD'],
  ['Lighting & photobiology','Understand PPFD, DLI, photoperiod, canopy uniformity, and leaf response instead of using fixture wattage as a crop measurement.','/learn/lighting/','Lighting'],
  ['Water & root zone','Track source water, pH, EC, irrigation volume, drainage, dry-down behavior, oxygen, and root condition together.','/learn/water-ph-ec/','Water, pH & EC'],
  ['Nutrition & media','Learn nutrient roles, media behavior, availability, salinity, and why visible leaf symptoms are not proof of a single nutrient problem.','/learn/nutrition-media/','Nutrition & Media'],
  ['Plant health & IPM','Scout systematically, separate pests, disease, root stress, environmental injury, and nutrition look-alikes, then verify the response to any change.','/learn/ipm/','Plant Health & IPM'],
  ['Harvest, post-harvest & records','Use multiple maturity signals, careful handling, controlled drying and storage, and batch records so outcomes can be compared instead of remembered loosely.','/learn/harvest-postharvest/','Harvest & Post-harvest']
];

function startHere(pageId){
  const moduleHtml=modules.map((m,i)=>`<article class="module"><div class="num">${i+1}</div><div><h3>${esc(m[0])}</h3><p>${esc(m[1])}</p><div class="links"><a class="text-link" href="${m[2]}">${esc(m[3])} →</a><a class="text-link" href="/learn/encyclopedia/">Encyclopedia →</a></div></div></article>`).join('');
  return `${scopedCss(pageId)}<main class="dtf-beginner-v5" data-dtf-beginner-v5="start-here">
<section class="hero"><div class="wrap hero-grid"><div><p class="kicker">Teaching Healthy Cultivation · Start Here</p><h1>Learn the plant before chasing the fix.</h1><p class="lede">This is the beginner path through THC. Work from plant biology and measurements toward diagnosis and management. You do not need to memorize every chart; you need a repeatable way to observe, measure, compare, change one thing at a time, and verify what happened.</p><div class="actions"><a class="btn primary" href="#course">Start the 8-module path</a><a class="btn secondary" href="/learn/beginner-guides/">Practical beginner guides</a><a class="btn secondary" href="/growlens/">Open GrowLens</a></div></div><aside class="hero-card"><strong>Use the same loop every time</strong><ol><li>Identify plant stage and affected tissue.</li><li>Record the environment and root-zone conditions.</li><li>Compare more than one plausible cause.</li><li>Change the smallest justified variable.</li><li>Recheck the plant and keep the result.</li></ol></aside></div></section>
<section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Three habits</p><h2>The course is built around evidence, not recipes.</h2></div><p>These three habits make every later lesson more useful and reduce the chance of fixing the wrong problem.</p></div><div class="principles"><article class="card"><h3>Observe precisely</h3><p>Describe location, pattern, progression, stage, and tissue. “Yellow leaves” is an observation category, not a diagnosis.</p></article><article class="card"><h3>Measure what matters</h3><p>Use representative measurements and record method, units, location, time, and plant stage so the number has context.</p></article><article class="card"><h3>Verify the response</h3><p>A correction is not proven because it sounded reasonable. Recheck the plant and the measurement after the intervention.</p></article></div></div></section>
<section class="section soft" id="course"><div class="wrap"><div class="heading"><div><p class="kicker">Beginner curriculum</p><h2>Eight modules, in a useful order.</h2></div><p>Move through these in sequence for a first pass. Later, use the subject pages and encyclopedia as references when a specific question appears.</p></div><div class="modules">${moduleHtml}</div></div></section>
<section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Before changing anything</p><h2>Build a minimum evidence set.</h2></div><p>This is the baseline information that makes a plant-health question interpretable instead of guesswork.</p></div><div class="checklist"><ul><li>Plant ID, cultivar/source, and developmental stage</li><li>Whole-plant photo plus close photos of affected tissue</li><li>Where symptoms started: old growth, new growth, roots, stems, flowers</li><li>Air temperature and relative humidity near the canopy</li><li>Light schedule and a measured light value when available</li></ul><ul><li>Media/substrate and container or rooting volume</li><li>Irrigation timing, volume, and recent dry-down behavior</li><li>Source water and pH/EC when those values are actually measured</li><li>Recent feed, transplant, training, spray, equipment, or environmental changes</li><li>Pest inspection, root observations, and how fast the problem is progressing</li></ul></div><div class="actions"><a class="btn primary" style="color:#071b10!important" href="/thc-grow-doc/">Use Grow Doc</a><a class="btn" style="background:#fff;color:#176d39!important;border-color:#bdd0c1" href="/growlens/">Record it in GrowLens</a></div></div></section>
<section class="section dark"><div class="wrap"><div class="heading"><div><p class="kicker">Self-check</p><h2>Can you explain the reasoning?</h2></div><p>Open each question after you answer it yourself. The goal is not trivia; it is building a repeatable decision process.</p></div><details><summary>Why is one damaged leaf not enough to diagnose a nutrient deficiency?</summary><p>Many unrelated stresses can produce similar colors, spots, curling, or necrosis. Distribution, plant stage, root conditions, environment, recent changes, and progression help distinguish plausible causes.</p></details><details><summary>Why should pH and EC values always include the sampling method?</summary><p>Source water, feed solution, runoff, pore-water extracts, and other sample types describe different things. Numbers collected by different methods are not automatically interchangeable.</p></details><details><summary>Why can a correct environmental average still hide a plant problem?</summary><p>Canopies contain gradients. Sensor height, leaf temperature, airflow, hot spots, cold surfaces, dense interiors, and light/dark transitions can differ substantially from the room average.</p></details><details><summary>What makes an intervention useful as evidence?</summary><p>Record the starting condition, make a justified change, hold other variables as stable as practical, and remeasure or reobserve after enough time to evaluate the response.</p></details></div></section>
<section class="section"><div class="wrap"><div class="callout"><p class="kicker">Next step</p><h2>Finish the beginner pass, then go deeper by subject.</h2><p>Use Beginner Guides for practical checkpoints, the subject library for connected explanations, the Encyclopedia for deeper mechanisms, GrowLens for records, and Grow Doc when you are comparing possible plant-health causes.</p><div class="actions"><a class="btn primary" href="/learn/beginner-guides/">Open Beginner Guides</a><a class="btn secondary" href="/learn/encyclopedia/">Browse the Encyclopedia</a><a class="btn secondary" href="/learn/">All THC subjects</a></div></div></div></section>
</main>`;
}

function beginnerGuides(pageId){
  const guides=[
    ['Before the plant enters the space','Make electrical and water safety, drainage, airflow, sanitation, pest exclusion, sensor placement, access, and realistic equipment loads part of the grow plan before optimizing performance.','/learn/environment-vpd/'],
    ['Seeds, cuttings, and young plants','Use developmental readiness rather than days alone. Track germination, rooting, moisture, light, acclimation, transplant response, and identity from the beginning.','/learn/lifecycle-propagation/'],
    ['Light and climate','Map the canopy instead of trusting one room reading. Learn PPFD, DLI, temperature, humidity, leaf temperature, VPD, airflow, and light/dark transitions.','/learn/lighting/'],
    ['Water, roots, and nutrition','Treat irrigation, pH, EC, salinity, media physics, oxygen, nutrient availability, and root health as one system rather than separate product choices.','/learn/water-ph-ec/'],
    ['Plant health and diagnosis','Start with distribution and progression, inspect roots and pests, compare abiotic and biotic causes, then verify the response to any intervention.','/learn/ipm/'],
    ['Harvest and post-harvest','Use representative maturity observations, clean handling, controlled moisture removal, stable storage, and batch records to compare outcomes.','/learn/harvest-postharvest/']
  ];
  const guideHtml=guides.map((g,i)=>`<article class="module"><div class="num">${i+1}</div><div><h3>${esc(g[0])}</h3><p>${esc(g[1])}</p><div class="links"><a class="text-link" href="${g[2]}">Open subject →</a><a class="text-link" href="/learn/encyclopedia/">Go deeper →</a></div></div></article>`).join('');
  const traps=[
    ['Changing several things at once','When light, feed, irrigation, temperature, and products all change together, the response cannot tell you which change mattered.'],
    ['Treating targets as diagnoses','A chart or target range can describe context, but it does not prove why a plant looks abnormal.'],
    ['Diagnosing from color alone','Yellowing, spots, curl, wilt, and slow growth are shared outcomes of many different stresses.'],
    ['Ignoring the roots','Whole-plant symptoms can begin with poor aeration, root damage, irrigation errors, temperature, salinity, or disease below the surface.'],
    ['Using one runoff number as the root zone','Runoff interpretation depends on the medium, irrigation pattern, sampling timing, container, and method.'],
    ['Adding inputs without a baseline','More products create more variables. Record the existing program and measurements before deciding that an additional input is the missing answer.']
  ].map(t=>`<article class="trap"><h3>${esc(t[0])}</h3><p>${esc(t[1])}</p></article>`).join('');
  return `${scopedCss(pageId)}<main class="dtf-beginner-v5" data-dtf-beginner-v5="beginner-guides">
<section class="hero"><div class="wrap hero-grid"><div><p class="kicker">Teaching Healthy Cultivation · Beginner Guides</p><h1>Your first complete grow-learning map.</h1><p class="lede">These guides turn the Start Here course into practical checkpoints. The goal is not to give one recipe for every cultivar or system; it is to show what to observe, what to measure, and what evidence should exist before the next decision.</p><div class="actions"><a class="btn primary" href="/learn/start-here/">Start at module 1</a><a class="btn secondary" href="/learn/records/">Open record templates</a><a class="btn secondary" href="/learn/infographics/">Visual library</a></div></div><aside class="hero-card"><strong>By the end of this path you should be able to:</strong><ol><li>Describe plant stage and normal structure.</li><li>Record the environment and root zone consistently.</li><li>Separate observations from conclusions.</li><li>Compare plausible causes instead of guessing one.</li><li>Document an intervention and verify the result.</li></ol></aside></div></section>
<section class="section soft"><div class="wrap"><div class="heading"><div><p class="kicker">Practical sequence</p><h2>Six guides from setup through post-harvest.</h2></div><p>Use these as checkpoints during a grow, then open the linked THC subject when you need the underlying science.</p></div><div class="modules">${guideHtml}</div></div></section>
<section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Milestones</p><h2>Move forward when the evidence is ready.</h2></div><p>Calendar age is useful context, but developmental readiness and stable measurements make better milestones.</p></div><div class="milestones"><article class="milestone"><h3>Ready to leave establishment</h3><p>The plant has active new growth, an expanding functional root system, stable water balance, and no unresolved pest or disease concern.</p></article><article class="milestone"><h3>Ready for stronger demand</h3><p>Light, airflow, irrigation demand, and training intensity can rise gradually as roots and leaf area increase; the plant response remains the verification step.</p></article><article class="milestone"><h3>Ready to diagnose</h3><p>You have a plant ID, stage, symptom distribution, recent-history notes, root-zone observations, environment measurements, and repeated photos.</p></article></div></div></section>
<section class="section soft"><div class="wrap"><div class="heading"><div><p class="kicker">Record this every session</p><h2>A small consistent log beats a perfect memory.</h2></div><p>You do not need every possible sensor. Preserve the measurements you do have and document method, location, and timing.</p></div><div class="checklist"><ul><li>Date/time and plant or room ID</li><li>Plant stage and meaningful visible changes</li><li>Air temperature and relative humidity</li><li>Light schedule and measured light data when available</li><li>Irrigation volume and timing</li></ul><ul><li>pH/EC plus sample type when measured</li><li>Feed or input changes</li><li>Pest, disease, or root observations</li><li>Actions taken and why</li><li>Photo IDs and next follow-up date</li></ul></div><div class="actions"><a class="btn primary" style="color:#071b10!important" href="/growlens/">Open GrowLens</a><a class="btn" style="background:#fff;color:#176d39!important;border-color:#bdd0c1" href="/learn/records/">Printable records</a></div></div></section>
<section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Common beginner traps</p><h2>Avoid the mistakes that destroy your evidence.</h2></div><p>Most of these errors make the next decision harder because they remove context or introduce too many variables.</p></div><div class="traps">${traps}</div></div></section>
<section class="section dark"><div class="wrap"><div class="heading"><div><p class="kicker">Fast self-check</p><h2>Before calling something a deficiency…</h2></div><p>Make sure you can answer these questions without guessing.</p></div><details><summary>Where did the symptom begin, and is it spreading?</summary><p>Record whether the first affected tissue is old or new, upper or lower, localized or whole-plant, and whether the pattern changes over time.</p></details><details><summary>What changed before the symptom appeared?</summary><p>Check irrigation, environment, feed, transplanting, training, sprays, equipment, root disturbance, and pest pressure. Timing helps rank possible causes.</p></details><details><summary>What root-zone evidence do you have?</summary><p>Media moisture, drainage, root condition, source water, irrigation behavior, and properly identified pH/EC samples can all change nutrient availability and plant water status.</p></details><details><summary>What result would prove your correction helped?</summary><p>Choose a measurable or observable follow-up: stable new growth, changed progression rate, corrected root-zone measurement, reduced pest count, or another specific outcome.</p></details></div></section>
<section class="section"><div class="wrap"><div class="callout"><p class="kicker">Keep building</p><h2>Use the beginner path as the map, not the ceiling.</h2><p>When a topic becomes important, move into the V4 subject pages, advanced diagnostic modules, topic-first Encyclopedia, and visual references. That is where the deeper mechanisms and uncertainty belong.</p><div class="actions"><a class="btn primary" href="/learn/">Browse all subjects</a><a class="btn secondary" href="/learn/encyclopedia/">Open the Encyclopedia</a><a class="btn secondary" href="/thc-grow-doc/">Compare a plant-health problem</a></div></div></div></section>
</main>`;
}

const targets=[
  {slug:'start-here',title:'Start Here — Teaching Healthy Cultivation',render:startHere},
  {slug:'beginner-guides',title:'Beginner Grow Guides — Teaching Healthy Cultivation',render:beginnerGuides}
];
const results=[];
for(const target of targets){
  const page=await pageBySlug(target.slug);
  await writeFile(join(backupDir,`page-${page.id}-${target.slug}-before.json`),`${JSON.stringify(page,null,2)}\n`);
  const content=target.render(page.id);
  if(!content.includes('data-dtf-beginner-v5=')) throw new Error(`${target.slug}: V5 marker missing from generated content.`);
  if(apply){
    await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({title:target.title,content,status:'publish'})});
  }
  results.push({id:page.id,slug:target.slug,url:`${siteUrl}/learn/${target.slug}/`});
}

if(apply){
  for(const item of results){
    let ok=false,html='';
    for(let attempt=1;attempt<=10;attempt+=1){
      try{
        const response=await fetch(`${item.url}?dtf_beginner_v5=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache','User-Agent':'DTFSeeds-Beginner-V5-Verify/1.0'}});
        html=await response.text();
        if(response.ok&&html.includes(`data-dtf-beginner-v5="${item.slug}"`)){ok=true;break;}
      }catch{}
      await sleep(attempt*2500);
    }
    if(!ok) throw new Error(`${item.slug}: visitor-facing V5 marker did not appear.`);
    const h1Count=(html.match(/<h1\b/gi)||[]).length;
    if(h1Count!==1) throw new Error(`${item.slug}: expected one H1, found ${h1Count}.`);
    if(item.slug==='start-here'){
      for(const marker of ['Eight modules','Before changing anything','Can you explain the reasoning?','/learn/plant-biology/','/learn/water-ph-ec/','/learn/ipm/','/growlens/','/thc-grow-doc/']) if(!html.includes(marker)) throw new Error(`${item.slug}: missing ${marker}`);
    }else{
      for(const marker of ['Six guides','Common beginner traps','Record this every session','/learn/records/','/learn/harvest-postharvest/']) if(!html.includes(marker)) throw new Error(`${item.slug}: missing ${marker}`);
    }
  }
}
const report={generatedAt:new Date().toISOString(),apply,backupDir,results};
await writeFile(join(backupDir,'beginner-v5-report.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
