import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const validateOnly=process.argv.includes('--validate-only');
const apply=String(process.env.APPLY_HARVEST_OUTDOOR_V6||'').toLowerCase()==='true';
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-harvest-outdoor-v6-final';

const subjects=[
  {
    key:'harvest',
    id:'harvest-postharvest-v6',
    slug:'harvest-postharvest',
    route:'/learn/harvest-postharvest/',
    file:'site/wordpress/education/harvest-postharvest-v6.json',
    ownerMarker:'data-dtf-topic="harvest-postharvest"',
    guideMarker:'data-dtf-learning-v4="topic-harvest-postharvest"',
    dataMarker:'data-dtf-harvest-postharvest-v6="true"',
    comment:'dtf-harvest-postharvest-v6',
    kicker:'Teaching Healthy Cultivation · Harvest science and post-harvest control',
    hero:'Harvest & post-harvest, taught as a measurable process.',
    accent:'#9a6135'
  },
  {
    key:'outdoor',
    id:'outdoor-v6',
    slug:'outdoor',
    route:'/learn/outdoor/',
    file:'site/wordpress/education/outdoor-v6.json',
    ownerMarker:'data-dtf-topic="outdoor"',
    guideMarker:'data-dtf-learning-v4="topic-outdoor"',
    dataMarker:'data-dtf-outdoor-v6="true"',
    comment:'dtf-outdoor-v6',
    kicker:'Teaching Healthy Cultivation · Site-aware outdoor plant science',
    hero:'Outdoor cultivation, built around weather, roots, risk and records.',
    accent:'#52733f'
  }
];

const esc=(v='')=>String(v)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const count=(text,needle)=>text.split(needle).length-1;

function fail(message){throw new Error(message)}
async function loadJson(file){return JSON.parse(await readFile(join(ROOT,file),'utf8'))}

function validateCurriculum(spec,curriculum){
  if(curriculum?.schemaVersion!==1||curriculum?.id!==spec.id) fail(`${spec.id}: invalid schema/id`);
  if(curriculum.route!==spec.route) fail(`${spec.id}: route ${curriculum.route} does not match ${spec.route}`);
  if(!curriculum.title||!curriculum.purpose||!curriculum.learningOutcome||!curriculum.evidenceBoundary) fail(`${spec.id}: missing curriculum metadata`);
  if(!Array.isArray(curriculum.sourceRefs)||curriculum.sourceRefs.length<4) fail(`${spec.id}: expected at least four evidence references`);
  const sourceIds=new Set(curriculum.sourceRefs.map(x=>x.id));
  if(sourceIds.size!==curriculum.sourceRefs.length) fail(`${spec.id}: duplicate source id`);
  for(const source of curriculum.sourceRefs){
    if(!source.id||!source.type||!source.citation||!source.supports) fail(`${spec.id}: incomplete source reference`);
  }
  if(!Array.isArray(curriculum.visualTargets)||curriculum.visualTargets.length<10) fail(`${spec.id}: expected at least ten visual targets`);
  if(!Array.isArray(curriculum.deepRoutes)||curriculum.deepRoutes.length<4) fail(`${spec.id}: expected deep routes`);
  if(!Array.isArray(curriculum.chapters)||curriculum.chapters.length!==8) fail(`${spec.id}: expected exactly 8 chapters`);
  const chapterIds=new Set();
  let lessons=0;
  for(const chapter of curriculum.chapters){
    if(!chapter.id||chapterIds.has(chapter.id)) fail(`${spec.id}: missing or duplicate chapter id ${chapter.id}`);
    chapterIds.add(chapter.id);
    if(!chapter.title||!chapter.objective||!Array.isArray(chapter.lessons)||chapter.lessons.length!==4) fail(`${spec.id}/${chapter.id}: expected four complete lessons`);
    if(!Array.isArray(chapter.knowledgeChecks)||chapter.knowledgeChecks.length<3) fail(`${spec.id}/${chapter.id}: knowledge checks incomplete`);
    for(const sourceId of chapter.sourceIds||[]) if(!sourceIds.has(sourceId)) fail(`${spec.id}/${chapter.id}: unknown source ${sourceId}`);
    for(const lesson of chapter.lessons){
      lessons+=1;
      if(!lesson.title||!lesson.summary||!lesson.cultivation||!lesson.observe||!Array.isArray(lesson.concepts)||lesson.concepts.length<3) fail(`${spec.id}/${chapter.id}: incomplete lesson`);
      if(lesson.summary.length<80||lesson.cultivation.length<50||lesson.observe.length<45) fail(`${spec.id}/${chapter.id}/${lesson.title}: lesson text too thin`);
    }
  }
  if(lessons!==32) fail(`${spec.id}: expected exactly 32 lessons, found ${lessons}`);
  const raw=JSON.stringify(curriculum).toLowerCase();
  const forbidden=[
    /harvest at \d+\s*%/,
    /\d+\s*%\s*amber.*(?:always|universal|guarantee)/,
    /amber.*(?:sedative|sleepy).*guarantee/,
    /universal safe (?:pollen )?(?:distance|radius)/,
    /curing (?:kills|removes|fixes) mold/
  ];
  for(const pattern of forbidden) if(pattern.test(raw)) fail(`${spec.id}: forbidden universal/unsupported claim matched ${pattern}`);
  return {chapters:curriculum.chapters.length,lessons,sources:curriculum.sourceRefs.length,visualTargets:curriculum.visualTargets.length};
}

const loaded=[];
for(const spec of subjects){
  const curriculum=await loadJson(spec.file);
  loaded.push({spec,curriculum,validation:validateCurriculum(spec,curriculum)});
}

if(validateOnly){
  console.log(JSON.stringify({valid:true,subjects:loaded.map(x=>({id:x.spec.id,...x.validation}))},null,2));
  process.exit(0);
}
if(!apply) fail('Refusing production write: set APPLY_HARVEST_OUTDOOR_V6=true');
if(!user||!pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required for production publication.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`harvest-outdoor-v6-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{
        ...options,
        redirect:'follow',
        signal:AbortSignal.timeout(60000),
        headers:{
          Authorization:auth,
          Accept:'application/json',
          'User-Agent':'DTFSeeds-Harvest-Outdoor-V6/1.0',
          ...(options.body?{'Content-Type':'application/json'}:{}),
          ...(options.headers||{})
        }
      });
      const text=await response.text();
      let body=text;
      try{body=text?JSON.parse(text):null}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){
        await sleep(attempt*1600);
        continue;
      }
      if(!response.ok) fail(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){
      last=error;
      if(attempt<8) await sleep(attempt*1600);
    }
  }
  throw last;
}

async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if(!Array.isArray(rows)||rows.length!==1) fail(`${slug}: expected exactly one WordPress page, found ${Array.isArray(rows)?rows.length:'invalid response'}`);
  return rows[0];
}

function sourceCards(curriculum,ids){
  const wanted=new Set(ids||[]);
  return curriculum.sourceRefs
    .filter(x=>wanted.size===0||wanted.has(x.id))
    .map(x=>`<article class="hov6-source"><span>${esc(x.id)} · ${esc(x.type)}</span><strong>${esc(x.citation)}</strong><p>${esc(x.supports)}</p></article>`)
    .join('');
}

function lessonHtml(lesson,index){
  return `<details class="hov6-lesson"><summary><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(lesson.title)}</strong></summary><div class="hov6-body"><p>${esc(lesson.summary)}</p><div class="hov6-concepts">${lesson.concepts.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="hov6-two"><article><h4>Why this matters in cultivation</h4><p>${esc(lesson.cultivation)}</p></article><article><h4>Measure or observe before acting</h4><p>${esc(lesson.observe)}</p></article></div></div></details>`;
}

function chapterHtml(curriculum,chapter){
  return `<section class="hov6-chapter" id="hov6-${esc(chapter.id)}" data-hov6-chapter="${esc(chapter.id)}"><div class="hov6-chapter-head"><div><p class="hov6-kicker">Chapter ${String(chapter.number).padStart(2,'0')}</p><h3>${esc(chapter.title)}</h3><p>${esc(chapter.objective)}</p></div><a href="#hov6-top">Back to chapters ↑</a></div><div class="hov6-lessons">${chapter.lessons.map(lessonHtml).join('')}</div><div class="hov6-bottom"><article><p class="hov6-kicker">Knowledge check</p><h4>Explain these before moving on</h4><ol>${chapter.knowledgeChecks.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article><article><p class="hov6-kicker">Evidence used in this chapter</p><div class="hov6-sources">${sourceCards(curriculum,chapter.sourceIds)}</div></article></div></section>`;
}

function block(spec,curriculum,pageId){
  const start=`<!-- ${spec.comment}:start -->`;
  const end=`<!-- ${spec.comment}:end -->`;
  return `${start}<style id="${spec.comment}-style">
body.page-id-${pageId} .entry-title,body.page-id-${pageId} .wp-block-post-title,body.page-id-${pageId} header.entry-header>h1{display:none!important}
.hov6{--deep:#071b16;--forest:#103b2e;--green:#1f704f;--gold:#d5b96b;--cream:#f7f4ea;--paper:#fffdf8;--ink:#143027;--muted:#52665e;--line:#d7e2dc;--accent:${spec.accent};background:var(--cream);color:var(--ink);padding:70px 0 80px}.hov6 *{box-sizing:border-box}.hov6-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.hov6-kicker{margin:0 0 8px;color:#78672f;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.hov6-intro{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:start}.hov6 h2{margin:0;font-size:clamp(2.35rem,5vw,4.7rem);line-height:.96;letter-spacing:-.05em}.hov6 h3{margin:0;font-size:clamp(1.85rem,3.5vw,3rem);line-height:1;letter-spacing:-.035em}.hov6 h4{margin:0 0 8px}.hov6 p{color:var(--muted);line-height:1.68}.hov6-lede{font-size:1.08rem}.hov6-stats{padding:24px;border-radius:23px;background:linear-gradient(145deg,var(--deep),var(--forest));color:#fff;border:1px solid #285445}.hov6-stats strong{display:block;color:var(--gold);font-size:2.3rem;line-height:1}.hov6-stats p{color:#d0ded8;margin:7px 0 16px}.hov6-boundary{margin-top:15px;padding:13px 15px;border-left:4px solid var(--accent);background:#fff9ef;border-radius:10px;color:#655a3d}.hov6-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:30px 0 54px}.hov6-nav a{padding:13px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.25}.hov6-nav span{display:block;color:#78672f;font-size:.67rem;margin-bottom:3px}.hov6-chapter{padding:42px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.hov6-chapter-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.hov6-chapter-head>div{max-width:820px}.hov6-chapter-head>a{white-space:nowrap;color:var(--green)!important;font-weight:900;text-decoration:none!important}.hov6-lessons{display:grid;gap:10px}.hov6-lesson{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}.hov6-lesson summary{display:flex;gap:11px;align-items:center;padding:17px 19px;cursor:pointer;list-style:none}.hov6-lesson summary::-webkit-details-marker{display:none}.hov6-lesson summary:after{content:'+';margin-left:auto;color:var(--green);font-weight:950;font-size:1.3rem}.hov6-lesson[open] summary:after{content:'–'}.hov6-lesson summary>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e7f0eb;color:#3b6754;font-size:.7rem;font-weight:950}.hov6-body{padding:0 19px 19px 64px}.hov6-concepts{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 15px}.hov6-concepts span{padding:5px 8px;border-radius:999px;background:#edf3ef;border:1px solid #d8e3dc;color:#416053;font-size:.71rem;font-weight:850}.hov6-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hov6-two article,.hov6-bottom>article{padding:15px;border-radius:14px;background:#f1f5f2;border:1px solid #dbe5df}.hov6-two article:last-child{background:#fff9ef;border-color:#e8dcc4}.hov6-two p{margin:0;font-size:.94rem}.hov6-bottom{display:grid;grid-template-columns:.78fr 1.22fr;gap:14px;margin-top:15px}.hov6-bottom ol{margin:10px 0 0;padding-left:1.2rem}.hov6-bottom li{margin:7px 0;color:#42594f;line-height:1.5}.hov6-sources{display:grid;gap:8px}.hov6-source{padding:10px 11px;border-radius:11px;background:#fff;border:1px solid var(--line)}.hov6-source span{display:block;color:#78672f;font-size:.64rem;font-weight:950;text-transform:uppercase}.hov6-source strong{display:block;margin:3px 0;font-size:.82rem;line-height:1.35}.hov6-source p{margin:0;font-size:.78rem}.hov6-deep{margin-top:40px;padding:26px;border-radius:22px;background:linear-gradient(145deg,#0c2c21,#123d2d);color:#fff}.hov6-deep p{color:#c9d8d1}.hov6-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.hov6-routes a{padding:12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff!important;text-decoration:none!important;font-weight:850}.hov6-visuals{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}.hov6-visuals ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:11px 0 0;padding:0;list-style:none}.hov6-visuals li{padding:10px;border-radius:11px;background:#f1f5f2;color:#43594f;line-height:1.4}.hov6-all-sources{margin-top:18px;padding:20px;border-radius:18px;background:#fff;border:1px solid var(--line)}
@media(max-width:920px){.hov6-intro,.hov6-bottom{grid-template-columns:1fr}.hov6-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.hov6-routes{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.hov6{padding:52px 0 60px}.hov6-wrap{width:min(100% - 26px,1180px)}.hov6-nav,.hov6-two,.hov6-routes,.hov6-visuals ul{grid-template-columns:1fr}.hov6-chapter-head{align-items:flex-start;flex-direction:column}.hov6-body{padding:0 15px 17px}.hov6-lesson summary{padding:15px}}
</style><section class="hov6" ${spec.dataMarker} id="hov6-top"><div class="hov6-wrap"><div class="hov6-intro"><div><p class="hov6-kicker">${esc(spec.kicker)}</p><h2>${esc(spec.hero)}</h2><p class="hov6-lede">${esc(curriculum.learningOutcome)}</p><p class="hov6-boundary"><strong>Evidence boundary:</strong> ${esc(curriculum.evidenceBoundary)}</p></div><aside class="hov6-stats"><strong>8</strong><p>connected chapters</p><strong>32</strong><p>focused lessons</p><strong>${curriculum.sourceRefs.length}</strong><p>evidence references carried into the course</p></aside></div><nav class="hov6-nav" aria-label="${esc(curriculum.title)} chapters">${curriculum.chapters.map(c=>`<a href="#hov6-${esc(c.id)}"><span>Chapter ${String(c.number).padStart(2,'0')}</span>${esc(c.title)}</a>`).join('')}</nav>${curriculum.chapters.map(c=>chapterHtml(curriculum,c)).join('')}<section class="hov6-deep"><p class="hov6-kicker">Continue deeper</p><h3>Connect this subject to the rest of the THC plant-science system.</h3><div class="hov6-routes">${curriculum.deepRoutes.map(x=>`<a href="${esc(x.href)}">${esc(x.label)} →</a>`).join('')}</div></section><section class="hov6-visuals"><p class="hov6-kicker">Visual study map</p><h3>Custom visuals being built for this subject.</h3><p>The finished infographic library remains quality-gated; unfinished placeholders are not counted as completed teaching visuals.</p><ul>${curriculum.visualTargets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="hov6-all-sources"><p class="hov6-kicker">Evidence basis</p><h3>Sources used to constrain this curriculum.</h3><div class="hov6-sources">${sourceCards(curriculum,[])}</div></section></div></section>${end}`;
}

function stripOwnBlock(spec,html){
  const start=`<!-- ${spec.comment}:start -->`;
  const end=`<!-- ${spec.comment}:end -->`;
  const a=html.indexOf(start);
  if(a<0) return html.trim();
  const b=html.indexOf(end,a);
  if(b<0) fail(`${spec.id}: start marker exists without end marker`);
  return `${html.slice(0,a)}${html.slice(b+end.length)}`.trim();
}

const plans=[];
for(const entry of loaded){
  const {spec,curriculum}=entry;
  const page=await pageBySlug(spec.slug);
  const before=rendered(page.content);
  if(!before.includes(spec.ownerMarker)) fail(`${spec.id}: page is not the expected V3 subject owner (${spec.ownerMarker} missing)`);
  if(!before.includes(spec.guideMarker)) fail(`${spec.id}: page is missing V4 guided-learning ownership (${spec.guideMarker} missing)`);
  const clean=stripOwnBlock(spec,before);
  const next=`${clean}\n${block(spec,curriculum,page.id)}`.trim();
  if(count(next,spec.dataMarker)!==1) fail(`${spec.id}: expected exactly one V6 data marker in planned content`);
  if(count(next,'data-hov6-chapter=')!==8) fail(`${spec.id}: planned content does not contain exactly eight V6 chapter markers`);
  if(count(next,'class="hov6-lesson"')!==32) fail(`${spec.id}: planned content does not contain exactly 32 lesson blocks`);
  await writeFile(join(backupDir,`${spec.slug}-page.json`),JSON.stringify(page,null,2));
  await writeFile(join(backupDir,`${spec.slug}-before.html`),before);
  await writeFile(join(backupDir,`${spec.slug}-planned.html`),next);
  plans.push({spec,curriculum,page,before,next});
}

const updated=[];
try{
  for(const plan of plans){
    const body=JSON.stringify({content:plan.next,status:'publish'});
    await request(`/wp-json/wp/v2/pages/${plan.page.id}`,{method:'POST',body});
    updated.push(plan);
  }
  for(const plan of plans){
    const check=await pageBySlug(plan.spec.slug);
    const html=rendered(check.content);
    if(!html.includes(plan.spec.ownerMarker)||!html.includes(plan.spec.guideMarker)||!html.includes(plan.spec.dataMarker)) fail(`${plan.spec.id}: post-write ownership marker verification failed`);
    if(count(html,'data-hov6-chapter=')!==8||count(html,'class="hov6-lesson"')!==32) fail(`${plan.spec.id}: post-write chapter/lesson count verification failed`);
  }
}catch(error){
  for(const plan of [...updated].reverse()){
    try{
      await request(`/wp-json/wp/v2/pages/${plan.page.id}`,{method:'POST',body:JSON.stringify({content:plan.before,status:plan.page.status||'publish'})});
    }catch(rollbackError){
      console.error(`ROLLBACK ERROR ${plan.spec.id}: ${rollbackError.message}`);
    }
  }
  throw error;
}

const report={
  schemaVersion:1,
  site,
  publishedAt:new Date().toISOString(),
  backupDir,
  subjects:plans.map(plan=>({
    id:plan.spec.id,
    route:plan.spec.route,
    pageId:plan.page.id,
    chapters:8,
    lessons:32,
    sources:plan.curriculum.sourceRefs.length,
    visualTargets:plan.curriculum.visualTargets.length,
    v3OwnerPreserved:true,
    v4GuidePreserved:true,
    v6Marker:plan.spec.dataMarker
  })),
  totals:{
    subjects:2,
    chapters:16,
    lessons:64,
    sources:plans.reduce((n,x)=>n+x.curriculum.sourceRefs.length,0),
    visualTargets:plans.reduce((n,x)=>n+x.curriculum.visualTargets.length,0)
  }
};
await writeFile(join(backupDir,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
