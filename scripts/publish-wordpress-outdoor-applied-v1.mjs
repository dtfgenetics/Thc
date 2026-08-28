import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const file='site/wordpress/education/outdoor-applied-v1.json';
const validateOnly=process.argv.includes('--validate-only');
const apply=String(process.env.APPLY_OUTDOOR_APPLIED_V1||'').toLowerCase()==='true';
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-outdoor-applied-v1';
const start='<!-- thc-outdoor-applied-v1:start -->';
const end='<!-- thc-outdoor-applied-v1:end -->';

const fail=m=>{throw new Error(m)};
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

async function loadData(){return JSON.parse(await readFile(join(ROOT,file),'utf8'))}

function validateData(data){
  if(data?.schemaVersion!==1||data?.id!=='outdoor-applied-v1') fail('Invalid Outdoor applied schema/id');
  if(data.route!=='/learn/outdoor/') fail(`Unexpected route ${data.route}`);
  if(!data.title||!data.purpose||!data.evidenceBoundary) fail('Missing Outdoor applied metadata');
  if(!Array.isArray(data.sourceRefs)||data.sourceRefs.length<6) fail('Expected at least six evidence references');
  const sourceIds=new Set();
  for(const s of data.sourceRefs){
    if(!s.id||sourceIds.has(s.id)||!s.type||!s.citation||!s.supports) fail(`Invalid source ${s.id||'unknown'}`);
    sourceIds.add(s.id);
  }
  if(!Array.isArray(data.modules)||data.modules.length!==5) fail('Expected exactly five applied modules');
  const moduleIds=new Set(); let lessons=0;
  for(const m of data.modules){
    if(!m.id||moduleIds.has(m.id)) fail(`Missing/duplicate module id ${m.id}`); moduleIds.add(m.id);
    if(!m.title||m.title.length<8||!m.learnerQuestion||m.learnerQuestion.length<30) fail(`${m.id}: incomplete module metadata`);
    if(!Array.isArray(m.sourceIds)||m.sourceIds.length<1) fail(`${m.id}: source ids required`);
    for(const id of m.sourceIds) if(!sourceIds.has(id)) fail(`${m.id}: unknown source ${id}`);
    if(!Array.isArray(m.lessons)||m.lessons.length!==4) fail(`${m.id}: expected four lessons`);
    if(!Array.isArray(m.fieldChecklist)||m.fieldChecklist.length<8) fail(`${m.id}: field checklist too thin`);
    for(const l of m.lessons){
      lessons++;
      if(!l.title||l.title.length<8) fail(`${m.id}: missing or thin lesson title`);
      for(const key of ['coreIdea','inspect','decision','avoid']) if(!l[key]||String(l[key]).length<45) fail(`${m.id}/${l.title}: missing or thin ${key}`);
    }
  }
  if(lessons!==20) fail(`Expected 20 applied lessons, found ${lessons}`);

  // These patterns target affirmative dangerous shortcuts only. Anti-claim teaching
  // (for example “do not teach a fixed 12-hour trigger”) is intentionally allowed.
  const raw=JSON.stringify(data).toLowerCase();
  const forbidden=[
    /harvest at \d+\s*%/,
    /(?:spacing|irrigation|flowering date|harvest timing) (?:is|equals|must be) universal/,
    /curing (?:kills|removes|fixes) mold/,
    /rain(?:fall)? (?:total|amount) (?:equals|is) root-zone recharge/
  ];
  for(const p of forbidden) if(p.test(raw)) fail(`Forbidden universal/unsupported claim matched ${p}`);
  return {modules:data.modules.length,lessons,sources:data.sourceRefs.length,checklists:data.modules.length};
}

function sources(data,ids){const wanted=new Set(ids||[]);return data.sourceRefs.filter(s=>wanted.has(s.id)).map(s=>`<article class="oav1-source"><span>${esc(s.id)} · ${esc(s.type)}</span><strong>${esc(s.citation)}</strong><p>${esc(s.supports)}</p></article>`).join('')}
function lesson(l,i){return `<article class="oav1-lesson"><div class="oav1-lesson-head"><span>${String(i+1).padStart(2,'0')}</span><h4>${esc(l.title)}</h4></div><p class="oav1-core">${esc(l.coreIdea)}</p><div class="oav1-three"><section><strong>Inspect first</strong><p>${esc(l.inspect)}</p></section><section><strong>Decision framework</strong><p>${esc(l.decision)}</p></section><section><strong>Avoid this shortcut</strong><p>${esc(l.avoid)}</p></section></div></article>`}
function moduleHtml(data,m){return `<details class="oav1-module" id="oav1-${esc(m.id)}" data-oav1-module="${esc(m.id)}"><summary><span>Module ${String(m.number).padStart(2,'0')}</span><div><h3>${esc(m.title)}</h3><p>${esc(m.learnerQuestion)}</p></div></summary><div class="oav1-module-body"><div class="oav1-lessons">${m.lessons.map(lesson).join('')}</div><div class="oav1-bottom"><article class="oav1-check"><p class="oav1-kicker">Field checklist</p><h4>Capture these before you call the problem solved</h4><ul>${m.fieldChecklist.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article><article><p class="oav1-kicker">Evidence context</p><div class="oav1-sources">${sources(data,m.sourceIds)}</div></article></div></div></details>`}
function block(data){
  const css=`<style id="thc-outdoor-applied-v1-style">.oav1{--green:#1f704f;--gold:#a9852e;--cream:#f7f4ea;--paper:#fffdf8;--ink:#143027;--muted:#52665e;--line:#d7e2dc;background:var(--cream);color:var(--ink);padding:58px 0 72px}.oav1 *{box-sizing:border-box}.oav1-wrap{width:min(1120px,calc(100% - 34px));margin:auto}.oav1-kicker{margin:0 0 7px!important;color:#78672f!important;font-size:.7rem!important;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.oav1-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;margin-bottom:28px}.oav1 h2{margin:0;font-size:clamp(2.2rem,4.8vw,4rem);line-height:.98}.oav1 h3,.oav1 h4{margin:0}.oav1 p,.oav1 li{color:var(--muted);line-height:1.6}.oav1-boundary{padding:17px;border-radius:16px;background:#fff9eb;border:1px solid #eadbb8;border-left:4px solid var(--gold)}.oav1-module{background:var(--paper);border:1px solid var(--line);border-radius:20px;margin:12px 0;overflow:hidden}.oav1-module>summary{display:grid;grid-template-columns:95px 1fr;gap:15px;padding:21px;cursor:pointer;list-style:none;background:linear-gradient(135deg,#fffdf8,#f0f5f1)}.oav1-module>summary::-webkit-details-marker{display:none}.oav1-module>summary>span{display:inline-flex;align-items:center;justify-content:center;height:35px;border-radius:999px;background:#e6efe9;color:#3d6553;font-size:.68rem;font-weight:950}.oav1-module-body{padding:0 20px 22px}.oav1-lessons,.oav1-sources{display:grid;gap:10px}.oav1-lesson{padding:17px;border:1px solid #e0e7e3;border-radius:15px;background:#fff}.oav1-lesson-head{display:flex;gap:10px;align-items:center}.oav1-lesson-head>span{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#edf3ef;color:#3d6553;font-size:.68rem;font-weight:950}.oav1-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.oav1-three section,.oav1-bottom>article{padding:12px;border-radius:12px;background:#f3f6f4;border:1px solid #e1e8e4}.oav1-three section:nth-child(3){background:#fff8eb;border-color:#eadfc6}.oav1-bottom{display:grid;grid-template-columns:.8fr 1.2fr;gap:12px;margin-top:13px}.oav1-source{padding:10px;border-radius:10px;background:#fff;border:1px solid #dfe7e2}.oav1-source span{display:block;color:#78672f;font-size:.63rem;font-weight:950;text-transform:uppercase}.oav1-source strong{display:block;margin:4px 0;font-size:.8rem}@media(max-width:860px){.oav1-hero,.oav1-bottom,.oav1-three{grid-template-columns:1fr}}@media(max-width:620px){.oav1-module>summary{grid-template-columns:1fr}.oav1-module-body{padding:0 13px 16px}}</style>`;
  return `${start}${css}<section class="oav1" data-thc-outdoor-applied-v1="true"><div class="oav1-wrap"><div class="oav1-hero"><div><p class="oav1-kicker">THC · Teaching Healthy Cultivation · Applied Outdoor field guide</p><h2>Make outdoor decisions from evidence, not recipes.</h2><p>${esc(data.purpose)}</p></div><div class="oav1-boundary"><strong>Evidence boundary</strong><p>${esc(data.evidenceBoundary)}</p></div></div>${data.modules.map(m=>moduleHtml(data,m)).join('')}</div></section>${end}`;
}
function strip(content){const a=content.indexOf(start);if(a<0)return content.trimEnd();const b=content.indexOf(end,a);if(b<0)fail('Found Outdoor applied start marker without end marker');return `${content.slice(0,a)}${content.slice(b+end.length)}`.trimEnd()}

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt++){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,Accept:'application/json','User-Agent':'THC-Outdoor-Applied-V1/1.2',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1500);continue}
      if(!response.ok)fail(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(e){last=e;if(attempt<8)await sleep(attempt*1500)}
  }
  throw last;
}
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);if(!Array.isArray(rows)||rows.length!==1)fail(`Expected one WordPress page for ${slug}, found ${Array.isArray(rows)?rows.length:'invalid response'}`);return rows[0]}

const data=await loadData();const validation=validateData(data);
if(validateOnly){console.log(JSON.stringify({valid:true,id:data.id,...validation},null,2));process.exit(0)}
if(!apply)fail('Refusing production write: set APPLY_OUTDOOR_APPLIED_V1=true');
if(!user||!pass)fail('WP_API_USERNAME and WP_API_PASSWORD are required');

const page=await pageBySlug('outdoor');const before=rendered(page.content);const next=`${strip(before)}\n\n${block(data)}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');const backupDir=join(backupRoot,`outdoor-applied-v1-${stamp}`);await mkdir(backupDir,{recursive:true});
await writeFile(join(backupDir,'before.html'),before,'utf8');await writeFile(join(backupDir,'after.html'),next,'utf8');
const updated=await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});const stored=rendered(updated.content);
if(!stored.includes('data-thc-outdoor-applied-v1="true"'))fail('WordPress response missing Outdoor applied marker');
for(const m of data.modules)if(!stored.includes(`data-oav1-module="${m.id}"`))fail(`WordPress response missing module ${m.id}`);
const report={ok:true,pageId:page.id,route:data.route,validation,backupDir,publishedAt:new Date().toISOString()};await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');console.log(JSON.stringify(report,null,2));
