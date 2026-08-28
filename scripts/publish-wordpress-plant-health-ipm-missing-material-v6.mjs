import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PLANT_HEALTH_IPM_MISSING_V6||'').toLowerCase()==='true';
const sourcePath=process.env.PLANT_HEALTH_IPM_MISSING_V6_PATH||'site/wordpress/education/plant-health-ipm-missing-material-v6.json';
const curriculumPath=process.env.PLANT_HEALTH_IPM_V6_PATH||'site/wordpress/education/plant-health-ipm-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-plant-health-ipm-missing-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`plant-health-ipm-missing-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt++){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Plant-Health-IPM-Missing-V6/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text(); let body=text; try{body=text?JSON.parse(text):null;}catch{}
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

const pack=JSON.parse(await readFile(sourcePath,'utf8'));
const curriculum=JSON.parse(await readFile(curriculumPath,'utf8'));
if(pack?.schemaVersion!==1||pack?.id!=='plant-health-ipm-missing-material-v6') throw new Error('Invalid Plant Health & IPM missing-material pack.');
if(curriculum?.id!=='plant-health-ipm-v6'||curriculum?.slug!=='ipm') throw new Error('Unexpected Plant Health V6 curriculum owner.');
if(!Array.isArray(pack.modules)||pack.modules.length!==5) throw new Error(`Expected five missing-material modules, found ${pack.modules?.length||0}.`);
const sourceMap=new Map((curriculum.sourceRefs||[]).map(s=>[s.id,s]));
const ids=pack.modules.map(x=>x.id); if(new Set(ids).size!==5) throw new Error('Missing-material IDs are not unique.');
for(const m of pack.modules){
  if(!m.title||!m.learningOutcome||!m.fieldExercise||!m.visualBrief) throw new Error(`${m.id}: incomplete module.`);
  for(const key of ['mechanism','measureFirst','interpretationLimits','commonMistakes']) if(!Array.isArray(m[key])||m[key].length<3) throw new Error(`${m.id}: ${key} is incomplete.`);
  if(!Array.isArray(m.sourceIds)||!m.sourceIds.length) throw new Error(`${m.id}: missing source mapping.`);
  for(const id of m.sourceIds) if(!sourceMap.has(id)) throw new Error(`${m.id}: unknown source ${id}.`);
}

const refs=m=>m.sourceIds.map(id=>{const s=sourceMap.get(id);return `<article><span>${esc(id)}</span><strong>${esc(s.citation)}</strong><p>${esc(s.supports)}</p>${s.pmcid?`<a href="https://pmc.ncbi.nlm.nih.gov/articles/${esc(s.pmcid)}/" target="_blank" rel="noopener noreferrer">Open reference ↗</a>`:''}</article>`;}).join('');
const moduleHtml=m=>`<article class="phi6m-module" id="phi6m-${esc(m.id)}" data-phi6m-module="${esc(m.id)}"><div class="phi6m-head"><div><p class="phi6m-kicker">Deep plant-health lab</p><h3>${esc(m.title)}</h3><p>${esc(m.learningOutcome)}</p></div><a href="#phi6m-top">Back to labs ↑</a></div><div class="phi6m-grid"><section><h4>Mechanism</h4><ul>${m.mechanism.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h4>Measure first</h4><ol>${m.measureFirst.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><section><h4>Interpretation limits</h4><ul>${m.interpretationLimits.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h4>Common mistakes</h4><ul>${m.commonMistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div><div class="phi6m-practice"><section><p class="phi6m-kicker">Field exercise</p><p>${esc(m.fieldExercise)}</p></section><section><p class="phi6m-kicker">Purpose-built visual still needed</p><p>${esc(m.visualBrief)}</p></section></div><div class="phi6m-refs">${refs(m)}</div></article>`;

function block(){return `<!-- dtf-plant-health-ipm-missing-v6:start --><style id="dtf-plant-health-ipm-missing-v6-style">
.phi6m{--green:#447b4f;--gold:#806d32;--ink:#213629;--muted:#5d6b60;--line:#dbe3db;--paper:#fffdf8;background:#f7f4e9;color:var(--ink);padding:68px 0 76px}.phi6m *{box-sizing:border-box}.phi6m-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.phi6m-kicker{margin:0 0 7px;color:var(--gold);font-size:.69rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.phi6m-intro{display:grid;grid-template-columns:1.08fr .92fr;gap:24px;align-items:start;margin-bottom:30px}.phi6m h2{margin:0;font-size:clamp(2.2rem,4.5vw,4rem);line-height:.97;letter-spacing:-.045em}.phi6m h3{margin:0;font-size:clamp(1.55rem,3vw,2.4rem);letter-spacing:-.03em}.phi6m h4{margin:0 0 9px}.phi6m p,.phi6m li{color:var(--muted);line-height:1.6}.phi6m-summary{padding:20px;border-radius:18px;background:linear-gradient(145deg,#102116,#234b2f);color:#fff}.phi6m-summary strong{display:block;color:#d4b765;font-size:2.5rem}.phi6m-summary p{color:#d7e2d8;margin:4px 0 0}.phi6m-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:32px}.phi6m-nav a{padding:11px;border-radius:12px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-size:.8rem;font-weight:850}.phi6m-module{padding:34px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.phi6m-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:16px}.phi6m-head>div{max-width:830px}.phi6m-head>a{color:var(--green)!important;text-decoration:none!important;font-weight:900;white-space:nowrap}.phi6m-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.phi6m-grid>section{padding:16px;border:1px solid var(--line);border-radius:15px;background:var(--paper)}.phi6m-grid ul,.phi6m-grid ol{margin:0;padding-left:1.2rem}.phi6m-grid li{margin:7px 0}.phi6m-practice{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.phi6m-practice section{padding:16px;border-radius:15px;background:#eef4ea;border:1px solid #d9e4d4}.phi6m-practice section:last-child{background:#fff8e8;border-color:#e5d4a8}.phi6m-refs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.phi6m-refs article{padding:13px;border:1px solid var(--line);border-radius:13px;background:#fff}.phi6m-refs span{display:block;color:var(--gold);font-size:.67rem;font-weight:950}.phi6m-refs strong{display:block;margin:4px 0;font-size:.88rem}.phi6m-refs p{margin:0 0 6px;font-size:.84rem}.phi6m-refs a{color:var(--green)!important;font-weight:900;text-decoration:none!important}
@media(max-width:980px){.phi6m-nav{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.phi6m-intro,.phi6m-grid,.phi6m-practice{grid-template-columns:1fr}}@media(max-width:650px){.phi6m{padding:50px 0 58px}.phi6m-wrap{width:min(100% - 26px,1180px)}.phi6m-nav,.phi6m-refs{grid-template-columns:1fr}.phi6m-head{align-items:flex-start;flex-direction:column}}
</style><section class="phi6m" data-dtf-plant-health-ipm-missing-v6="true" id="phi6m-top"><div class="phi6m-wrap"><div class="phi6m-intro"><div><p class="phi6m-kicker">Teaching Healthy Cultivation · Missing material closure</p><h2>Five plant-health problems that require direct evidence, not symptom guessing.</h2><p>These labs extend the approved Plant Health & IPM V6 system with repeatable scouting, high-risk identification, systemic-pathogen traceback and post-intervention verification.</p></div><aside class="phi6m-summary"><strong>5</strong><p>deep diagnostic labs tied to reviewed plant-health sources</p></aside></div><nav class="phi6m-nav" aria-label="Plant Health and IPM deep labs">${pack.modules.map(m=>`<a href="#phi6m-${esc(m.id)}">${esc(m.title)}</a>`).join('')}</nav>${pack.modules.map(moduleHtml).join('')}</div></section><!-- dtf-plant-health-ipm-missing-v6:end -->`;}

const page=await pageBySlug('ipm');
const before=rendered(page.content);
for(const marker of ['data-dtf-plant-health-ipm-v6="true"','data-dtf-subject-visuals-v6="plant-health-ipm-v6"','data-dtf-topic="plant-health-ipm"','data-dtf-learning-v4="topic-plant-health-ipm"']) if(!before.includes(marker)) throw new Error(`Required live owner marker missing: ${marker}`);
const clean=before.replace(/<!-- dtf-plant-health-ipm-missing-v6:start -->[\s\S]*?<!-- dtf-plant-health-ipm-missing-v6:end -->/g,'').trim();
const next=`${clean}\n${block()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('ipm')).content);
  if(!edit.includes('data-dtf-plant-health-ipm-missing-v6="true"')) throw new Error('Edit-context missing-material marker missing.');
  if((edit.match(/data-phi6m-module=/g)||[]).length!==5) throw new Error('Edit-context module count is not five.');
  if((edit.match(/data-phi6-chapter=/g)||[]).length!==8) throw new Error('Plant Health chapter count changed.');
  if((edit.match(/class="phi6-lesson"/g)||[]).length!==32) throw new Error('Plant Health lesson count changed.');
  for(const marker of ['data-dtf-plant-health-ipm-v6="true"','data-dtf-subject-visuals-v6="plant-health-ipm-v6"']) if(!edit.includes(marker)) throw new Error(`Existing Plant Health layer was lost: ${marker}`);

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt++){
    try{
      const response=await fetch(`${site}/learn/ipm/?dtf_phi6m=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Plant-Health-IPM-Missing-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache'}});
      visitor=await response.text();
      if(response.ok&&visitor.includes('data-dtf-plant-health-ipm-missing-v6="true"')){ok=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor missing-material marker missing.');
  if((visitor.match(/data-phi6m-module=/g)||[]).length!==5) throw new Error('Visitor module count is not five.');
  if((visitor.match(/data-phi6-chapter=/g)||[]).length!==8) throw new Error('Visitor chapter count is not eight.');
  if((visitor.match(/class="phi6-lesson"/g)||[]).length!==32) throw new Error('Visitor lesson count is not thirty-two.');
  if((visitor.match(/class="sv6v-card"/g)||[]).length!==14) throw new Error('Visitor visual-card count changed.');
  for(const marker of ['data-dtf-plant-health-ipm-v6="true"','data-dtf-subject-visuals-v6="plant-health-ipm-v6"','data-dtf-topic="plant-health-ipm"','data-dtf-learning-v4="topic-plant-health-ipm"']) if(!visitor.includes(marker)) throw new Error(`Visitor page lost required owner marker: ${marker}`);

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/ipm/',modules:5,curriculumPreserved:true,visualAtlasPreserved:true,visitorVerified:true,backupDir};
  await writeFile('plant-health-ipm-missing-material-v6-report.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){
    try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});}
    catch(rollbackError){throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`);}
  }
  throw error;
}
