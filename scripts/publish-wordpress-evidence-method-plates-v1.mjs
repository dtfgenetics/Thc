import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_EVIDENCE_METHOD_PLATES_V1||'').toLowerCase()==='true';
const dataPath=process.env.EVIDENCE_METHOD_PLATES_PATH||'site/wordpress/education/evidence-measurement-method-plates-v1.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-evidence-method-plates-v1';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const slugify=v=>String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`evidence-method-plates-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Evidence-Method-Plates-V1/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1500);}
  }
  throw last;
}
async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);
  return rows[0];
}

const data=JSON.parse(await readFile(dataPath,'utf8'));
if(data?.schemaVersion!==1||data?.id!=='evidence-measurement-method-plates-v1'||data?.route!=='/learn/research-methods/') throw new Error('Invalid Evidence method-plates package.');
if(!Array.isArray(data.plates)||data.plates.length!==6) throw new Error(`Expected exactly 6 method plates, found ${data.plates?.length||0}.`);
const ids=data.plates.map(x=>x.id);
if(new Set(ids).size!==6) throw new Error('Method plate IDs must be unique.');
for(const plate of data.plates){
  for(const field of ['id','chapterId','title','coreIdea','interpretationLimit','knowledgeCheck']) if(!plate[field]) throw new Error(`${plate.id||'unknown'} missing ${field}.`);
  if(!Array.isArray(plate.methodSteps)||plate.methodSteps.length<5) throw new Error(`${plate.id}: insufficient method steps.`);
  if(!Array.isArray(plate.failureModes)||plate.failureModes.length<4) throw new Error(`${plate.id}: insufficient failure modes.`);
  if(!Array.isArray(plate.recordFields)||plate.recordFields.length<9) throw new Error(`${plate.id}: insufficient record fields.`);
}

function accuracyVisual(model){
  const states=model.states||[];
  return `<div class="empv-targets">${states.map((s,i)=>`<article class="empv-target empv-target-${i+1}"><div class="empv-bull"><i></i><i></i><i></i><span class="p p1"></span><span class="p p2"></span><span class="p p3"></span><span class="p p4"></span><span class="p p5"></span></div><strong>${esc(s.label)}</strong><p>${esc(s.meaning)}</p></article>`).join('')}</div>`;
}
function chainVisual(model){
  const stages=model.stages||model.chain||[];
  return `<div class="empv-chain">${stages.map((x,i)=>`<div class="empv-node"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(x)}</strong></div>`).join('')}</div>`;
}
function gridVisual(model){
  const grid=model.grid||[];
  return `<div class="empv-gridviz"><div class="empv-gridtable">${grid.flatMap((row,r)=>row.map((cell,c)=>`<div data-r="${r}" data-c="${c}"><strong>${esc(cell)}</strong><small>${82+r*3+c*2}</small></div>`)).join('')}</div><aside><strong>Placement metadata</strong><p>Coordinate · height · canopy stage · timestamp · nearby equipment</p></aside></div>`;
}
function timelineVisual(model){
  const stages=model.stages||[];
  return `<div class="empv-timeline">${stages.map((x,i)=>`<div><span>${i+1}</span><strong>${esc(x)}</strong></div>`).join('')}</div><div class="empv-mini-note"><strong>Position matters.</strong><p>Randomize or block when light, airflow, pressure, access or bench edge can change the outcome.</p></div>`;
}
function imagingVisual(model){
  const frames=model.frames||[];
  const anchors=model.scoreAnchors||[];
  return `<div class="empv-photo-seq">${frames.map((x,i)=>`<div><span>${i+1}</span><strong>${esc(x)}</strong><em>${i===0?'distribution':i===1?'location':'scale + detail'}</em></div>`).join('')}</div><div class="empv-score">${anchors.map(a=>`<div><strong>${esc(a.score)}</strong><span>${esc(a.anchor)}</span></div>`).join('')}</div>`;
}
function evidenceVisual(model){
  const reps=model.replicationExamples||[];
  return `<div class="empv-reps">${reps.map((x,i)=>`<article><span>${i===0?'SUBSAMPLES':'BIOLOGICAL REPLICATION'}</span><strong>${esc(x)}</strong></article>`).join('')}</div>${chainVisual(model)}`;
}
function visualFor(plate){
  switch(plate.visualModel?.type){
    case 'four-state-target': return accuracyVisual(plate.visualModel);
    case 'quality-control-chain': return chainVisual(plate.visualModel);
    case 'canopy-grid': return gridVisual(plate.visualModel);
    case 'trial-timeline': return timelineVisual(plate.visualModel);
    case 'three-frame-capture': return imagingVisual(plate.visualModel);
    case 'evidence-chain': return evidenceVisual(plate.visualModel);
    default: return '';
  }
}
function plateHtml(plate,index){
  return `<section class="empv-plate" id="empv-${esc(plate.id)}" data-empv-plate="${esc(plate.id)}"><div class="empv-plate-head"><div><p class="empv-kicker">Method plate ${String(index+1).padStart(2,'0')} · ${esc(plate.chapterId)}</p><h3>${esc(plate.title)}</h3><p class="empv-core">${esc(plate.coreIdea)}</p></div><a href="#empv-top">Back to method plates ↑</a></div><div class="empv-visual">${visualFor(plate)}</div><div class="empv-columns"><article><p class="empv-kicker">Protocol</p><h4>Use this method</h4><ol>${plate.methodSteps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></article><article><p class="empv-kicker">Common failure modes</p><h4>What weakens the evidence</h4><ul>${plate.failureModes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article></div><div class="empv-record"><div><p class="empv-kicker">Record these fields</p><h4>Keep the method reconstructable</h4><div class="empv-chips">${plate.recordFields.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><aside><p class="empv-kicker">Interpretation boundary</p><p>${esc(plate.interpretationLimit)}</p></aside></div><div class="empv-check"><strong>Knowledge check</strong><p>${esc(plate.knowledgeCheck)}</p></div></section>`;
}

function block(){
  const nav=data.plates.map((p,i)=>`<a href="#empv-${esc(p.id)}"><span>${String(i+1).padStart(2,'0')}</span>${esc(p.title)}</a>`).join('');
  return `<!-- dtf-evidence-method-plates-v1:start --><style id="dtf-evidence-method-plates-v1-style">
.empv{--deep:#071812;--ink:#163228;--green:#175c40;--gold:#8a7531;--cream:#f8f5ea;--paper:#fffef9;--muted:#53665e;--line:#d7e2dc;background:var(--cream);color:var(--ink);padding:72px 0 80px}.empv *{box-sizing:border-box}.empv-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.empv-kicker{margin:0 0 7px;color:var(--gold);font-size:.69rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.empv-intro{display:grid;grid-template-columns:1.08fr .92fr;gap:26px;align-items:start}.empv h2{margin:0;font-size:clamp(2.3rem,4.8vw,4.35rem);line-height:.98;letter-spacing:-.045em}.empv h3{margin:0;font-size:clamp(1.8rem,3.3vw,2.8rem);line-height:1.02;letter-spacing:-.035em}.empv h4{margin:0 0 9px}.empv p,.empv li{color:var(--muted);line-height:1.62}.empv-lede{font-size:1.05rem}.empv-callout{padding:22px;border-radius:20px;background:linear-gradient(145deg,#081a13,#143b2b);color:#fff;border:1px solid #2d5545}.empv-callout strong{display:block;color:#d7bd6a;font-size:2.3rem}.empv-callout p{color:#d0ddd7;margin:6px 0 0}.empv-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:30px 0 55px}.empv-nav a{padding:12px 13px;border-radius:13px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-weight:850;line-height:1.3}.empv-nav span{display:block;color:var(--gold);font-size:.65rem;margin-bottom:3px}.empv-plate{padding:43px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.empv-plate-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:18px}.empv-plate-head>div{max-width:830px}.empv-plate-head>a{white-space:nowrap;color:var(--green)!important;text-decoration:none!important;font-weight:900}.empv-core{font-size:1.02rem}.empv-visual{padding:22px;border-radius:20px;background:#fff;border:1px solid var(--line);box-shadow:0 10px 28px rgba(15,48,35,.05)}.empv-targets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.empv-target{padding:12px;border:1px solid var(--line);border-radius:14px;background:#fbfcfa}.empv-target p{font-size:.84rem;margin:7px 0 0}.empv-bull{width:120px;height:120px;border:1px solid #8ea69a;border-radius:50%;position:relative;margin:0 auto 11px;background:radial-gradient(circle,#fff 0 14%,#edf2ef 15% 31%,#fff 32% 49%,#edf2ef 50% 66%,#fff 67%)}.empv-bull i{position:absolute;background:#9aaea4}.empv-bull i:nth-child(1){width:1px;height:100%;left:50%;top:0}.empv-bull i:nth-child(2){height:1px;width:100%;top:50%;left:0}.empv-bull .p{position:absolute;width:7px;height:7px;border-radius:50%;background:#174f39}.empv-target-1 .p1{left:58px;top:55px}.empv-target-1 .p2{left:53px;top:60px}.empv-target-1 .p3{left:62px;top:62px}.empv-target-1 .p4{left:57px;top:66px}.empv-target-1 .p5{left:64px;top:56px}.empv-target-2 .p1{left:36px;top:33px}.empv-target-2 .p2{left:75px;top:37px}.empv-target-2 .p3{left:52px;top:69px}.empv-target-2 .p4{left:80px;top:78px}.empv-target-2 .p5{left:32px;top:72px}.empv-target-3 .p1{left:82px;top:29px}.empv-target-3 .p2{left:87px;top:34px}.empv-target-3 .p3{left:78px;top:36px}.empv-target-3 .p4{left:84px;top:41px}.empv-target-3 .p5{left:89px;top:28px}.empv-target-4 .p1{left:78px;top:28px}.empv-target-4 .p2{left:92px;top:55px}.empv-target-4 .p3{left:69px;top:72px}.empv-target-4 .p4{left:99px;top:80px}.empv-target-4 .p5{left:66px;top:43px}.empv-chain{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.empv-node{padding:13px 10px;border-radius:12px;background:#edf3ef;border:1px solid #dbe5df;min-height:86px}.empv-node span{display:block;color:var(--gold);font-size:.64rem;font-weight:950}.empv-node strong{display:block;margin-top:5px;font-size:.82rem;line-height:1.3}.empv-gridviz{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.empv-gridtable{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.empv-gridtable>div{min-height:72px;border-radius:9px;background:#edf3ef;border:1px solid #d7e2dc;display:grid;place-items:center}.empv-gridtable small{color:#597067}.empv-gridviz aside,.empv-mini-note{padding:16px;border-radius:13px;background:#fff9ed;border:1px solid #ead9b3}.empv-gridviz aside p,.empv-mini-note p{margin-bottom:0}.empv-timeline{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.empv-timeline>div{padding:14px 9px;border-radius:12px;background:#edf3ef;border:1px solid #d9e4dd;text-align:center}.empv-timeline span{display:grid;place-items:center;width:28px;height:28px;margin:0 auto 7px;border-radius:50%;background:#174f39;color:#fff;font-size:.72rem;font-weight:950}.empv-mini-note{margin-top:10px}.empv-photo-seq{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.empv-photo-seq>div{aspect-ratio:4/3;border-radius:14px;border:1px solid var(--line);background:linear-gradient(160deg,#e8efea,#f9fbf9);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px}.empv-photo-seq span{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#174f39;color:#fff;font-weight:950}.empv-photo-seq em{margin-top:5px;color:#73847d;font-size:.76rem}.empv-score{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px}.empv-score>div{padding:10px;border-radius:10px;background:#fff9ed;border:1px solid #ead9b3}.empv-score strong{display:block;font-size:1.4rem}.empv-score span{font-size:.76rem;color:#5d6c65}.empv-reps{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.empv-reps article{padding:16px;border-radius:13px;background:#edf3ef;border:1px solid #d9e4dd}.empv-reps span{display:block;color:var(--gold);font-size:.65rem;font-weight:950;letter-spacing:.07em}.empv-reps strong{display:block;margin-top:6px}.empv-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.empv-columns article{padding:17px;border-radius:15px;background:#fff;border:1px solid var(--line)}.empv-columns article:last-child{background:#fff9ed;border-color:#ead9b3}.empv-columns ol,.empv-columns ul{margin:7px 0 0;padding-left:1.2rem}.empv-columns li{margin:7px 0}.empv-record{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;margin-top:12px}.empv-record>div,.empv-record aside{padding:17px;border-radius:15px;background:#f0f5f1;border:1px solid #d9e4dd}.empv-record aside{background:#0b241a;color:#fff}.empv-record aside p{color:#d1ded7;margin-bottom:0}.empv-chips{display:flex;flex-wrap:wrap;gap:6px}.empv-chips span{padding:5px 8px;border-radius:999px;background:#fff;border:1px solid #d7e2dc;color:#496157;font-size:.72rem;font-weight:800}.empv-check{margin-top:12px;padding:14px 16px;border-radius:13px;background:#fff;border-left:4px solid #887432}.empv-check p{margin:4px 0 0}
@media(max-width:940px){.empv-intro,.empv-record{grid-template-columns:1fr}.empv-targets{grid-template-columns:repeat(2,1fr)}.empv-chain{grid-template-columns:repeat(4,1fr)}.empv-nav{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.empv{padding:52px 0 60px}.empv-wrap{width:min(100% - 26px,1180px)}.empv-nav,.empv-targets,.empv-chain,.empv-gridviz,.empv-timeline,.empv-photo-seq,.empv-score,.empv-reps,.empv-columns{grid-template-columns:1fr}.empv-plate-head{align-items:flex-start;flex-direction:column}.empv-bull{width:110px;height:110px}}
</style><section class="empv" data-dtf-evidence-method-plates-v1="true" id="empv-top"><div class="empv-wrap"><div class="empv-intro"><div><p class="empv-kicker">Teaching Healthy Cultivation · Evidence & Measurement Method Lab</p><h2>Make the method visible before trusting the number.</h2><p class="empv-lede">Six live method plates close the most important measurement-teaching gaps in the Evidence curriculum: instrument quality, calibration, spatial sampling, controls, standardized imaging and uncertainty-aware replication.</p></div><aside class="empv-callout"><strong>6</strong><p>full instructional plates · each includes a model, protocol, failure modes, record fields, an interpretation boundary and a knowledge check.</p></aside></div><nav class="empv-nav" aria-label="Evidence method plates">${nav}</nav>${data.plates.map(plateHtml).join('')}</div></section><!-- dtf-evidence-method-plates-v1:end -->`;
}

const page=await pageBySlug('research-methods');
const before=rendered(page.content);
if(!before.includes('data-dtf-evidence-measurement-v6="true"')) throw new Error('Evidence & Measurement V6 curriculum is not live; refusing to attach Method Lab to an older page.');
const clean=before.replace(/<!-- dtf-evidence-method-plates-v1:start -->[\s\S]*?<!-- dtf-evidence-method-plates-v1:end -->/g,'').trim();
const next=`${clean}\n${block()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('research-methods')).content);
  if(!edit.includes('data-dtf-evidence-method-plates-v1="true"')) throw new Error('Edit-context Evidence Method Lab marker missing.');
  if((edit.match(/data-empv-plate=/g)||[]).length!==6) throw new Error('Edit-context method plate count is not 6.');
  if((edit.match(/class="empv-check"/g)||[]).length!==6) throw new Error('Edit-context knowledge-check count is not 6.');
  if((edit.match(/class="empv-record"/g)||[]).length!==6) throw new Error('Edit-context record-field section count is not 6.');

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/research-methods/?dtf_empv=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Evidence-Method-Plates-V1-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();
      if(response.ok&&visitor.includes('data-dtf-evidence-method-plates-v1="true"')){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor Evidence Method Lab marker missing.');
  if((visitor.match(/data-empv-plate=/g)||[]).length!==6) throw new Error('Visitor method plate count is not 6.');
  if((visitor.match(/class="empv-check"/g)||[]).length!==6) throw new Error('Visitor knowledge-check count is not 6.');
  if(!visitor.includes('data-dtf-evidence-measurement-v6="true"')) throw new Error('Visitor page lost Evidence V6 curriculum marker.');

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,plates:6,knowledgeChecks:6,visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});}
    catch(rollbackError){throw new Error(`${error.message}; rollback also failed: ${rollbackError.message}`);}
  }
  throw error;
}
