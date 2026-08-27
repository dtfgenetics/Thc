import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_WATER_ROOT_ZONE_MISSING_V6||'').toLowerCase()==='true';
const sourcePath=process.env.WATER_ROOT_ZONE_MISSING_V6_PATH||'site/wordpress/education/water-root-zone-missing-material-v6.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-water-root-zone-missing-v6';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`water-root-zone-missing-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt++){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Water-Root-Zone-Missing-V6/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null;}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<8) await sleep(attempt*1500);}
  }
  throw last;
}
async function pageBySlug(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);return rows[0];}

const pack=JSON.parse(await readFile(sourcePath,'utf8'));
if(pack?.schemaVersion!==1||pack?.id!=='water-root-zone-missing-material-v6') throw new Error('Invalid Water & Root Zone missing-material pack.');
if(!Array.isArray(pack.modules)||pack.modules.length!==7) throw new Error(`Expected seven missing-material modules, found ${pack.modules?.length||0}.`);
const ids=pack.modules.map(x=>x.id);if(new Set(ids).size!==7) throw new Error('Missing-material IDs are not unique.');
for(const m of pack.modules){
  if(!m.title||!m.learningOutcome||!m.fieldExercise||!m.visualBrief) throw new Error(`${m.id}: incomplete module.`);
  for(const key of ['mechanism','measureFirst','interpretationLimits','commonMistakes']) if(!Array.isArray(m[key])||m[key].length<3) throw new Error(`${m.id}: ${key} is incomplete.`);
  if(!Array.isArray(m.encyclopediaIds)||!m.encyclopediaIds.length) throw new Error(`${m.id}: missing encyclopedia references.`);
}

const moduleHtml=m=>`<article class="wr6m-module" id="wr6m-${esc(m.id)}" data-wr6m-module="${esc(m.id)}"><div class="wr6m-head"><div><p class="wr6m-kicker">Deep diagnostic & measurement lab</p><h3>${esc(m.title)}</h3><p>${esc(m.learningOutcome)}</p></div><a href="#wr6m-top">Back to labs ↑</a></div><div class="wr6m-grid"><section><h4>Mechanism</h4><ul>${m.mechanism.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h4>Measure first</h4><ol>${m.measureFirst.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><section><h4>Interpretation limits</h4><ul>${m.interpretationLimits.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h4>Common mistakes</h4><ul>${m.commonMistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section></div><div class="wr6m-practice"><section><p class="wr6m-kicker">Field exercise</p><p>${esc(m.fieldExercise)}</p></section><section><p class="wr6m-kicker">Purpose-built visual still needed</p><p>${esc(m.visualBrief)}</p></section></div><div class="wr6m-refs"><strong>Controlled references:</strong> ${m.encyclopediaIds.map(id=>`<a href="/learn/encyclopedia/${esc(id.toLowerCase())}/">${esc(id)}</a>`).join(' · ')}</div></article>`;

function block(){return `<!-- dtf-water-root-zone-missing-v6:start --><style id="dtf-water-root-zone-missing-v6-style">
.wr6m{--deep:#0b251d;--green:#236b52;--gold:#8b7637;--cream:#f8f4e8;--paper:#fffefa;--ink:#17362d;--muted:#53675f;--line:#d8e2dc;background:#f8f4e8;color:var(--ink);padding:68px 0 76px}.wr6m *{box-sizing:border-box}.wr6m-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.wr6m-kicker{margin:0 0 7px;color:var(--gold);font-size:.69rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.wr6m-intro{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:start;margin-bottom:30px}.wr6m h2{margin:0;font-size:clamp(2.2rem,4.5vw,4rem);line-height:.97;letter-spacing:-.045em}.wr6m h3{margin:0;font-size:clamp(1.6rem,3vw,2.45rem);letter-spacing:-.03em}.wr6m h4{margin:0 0 9px}.wr6m p,.wr6m li{color:var(--muted);line-height:1.6}.wr6m-summary{padding:20px;border-radius:18px;background:linear-gradient(145deg,#0a211a,#174936);color:#fff}.wr6m-summary strong{display:block;color:#d8bd70;font-size:2.5rem}.wr6m-summary p{color:#d4e0da;margin:4px 0 0}.wr6m-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:32px}.wr6m-nav a{padding:11px;border-radius:12px;background:#fff;border:1px solid var(--line);color:var(--ink)!important;text-decoration:none!important;font-size:.82rem;font-weight:850}.wr6m-module{padding:34px 0;border-top:1px solid var(--line);scroll-margin-top:90px}.wr6m-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:16px}.wr6m-head>div{max-width:830px}.wr6m-head>a{color:var(--green)!important;text-decoration:none!important;font-weight:900;white-space:nowrap}.wr6m-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wr6m-grid>section{padding:16px;border:1px solid var(--line);border-radius:15px;background:var(--paper)}.wr6m-grid ul,.wr6m-grid ol{margin:0;padding-left:1.2rem}.wr6m-grid li{margin:7px 0}.wr6m-practice{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.wr6m-practice section{padding:16px;border-radius:15px;background:#edf4f0;border:1px solid #d4e2da}.wr6m-practice section:last-child{background:#fff8e8;border-color:#e5d4a8}.wr6m-practice p:last-child{margin-bottom:0}.wr6m-refs{margin-top:11px;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid var(--line);font-size:.88rem}.wr6m-refs a{color:var(--green)!important;font-weight:850;text-decoration:none!important}
@media(max-width:900px){.wr6m-intro,.wr6m-grid,.wr6m-practice{grid-template-columns:1fr}.wr6m-nav{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.wr6m{padding:50px 0 58px}.wr6m-wrap{width:min(100% - 26px,1180px)}.wr6m-nav{grid-template-columns:1fr}.wr6m-head{align-items:flex-start;flex-direction:column}}
</style><section class="wr6m" data-dtf-water-root-zone-missing-v6="true" id="wr6m-top"><div class="wr6m-wrap"><div class="wr6m-intro"><div><p class="wr6m-kicker">Teaching Healthy Cultivation · Missing material closure</p><h2>Seven root-zone concepts that deserve full measurement labs.</h2><p>These labs close the instructional gaps that were previously represented only as visual-production targets. They extend the 32-lesson Water & Root Zone curriculum without replacing it.</p></div><aside class="wr6m-summary"><strong>7</strong><p>new deep-dive labs with field exercises, evidence limits and purpose-built visual briefs</p></aside></div><nav class="wr6m-nav" aria-label="Water and Root Zone deep labs">${pack.modules.map(m=>`<a href="#wr6m-${esc(m.id)}">${esc(m.title)}</a>`).join('')}</nav>${pack.modules.map(moduleHtml).join('')}</div></section><!-- dtf-water-root-zone-missing-v6:end -->`}

const page=await pageBySlug('water-ph-ec');
const before=rendered(page.content);
for(const marker of ['data-dtf-water-root-zone-v6="true"','data-dtf-water-root-zone-visuals-v6="true"','data-dtf-topic="water-root-zone"','data-dtf-learning-v4="topic-water-root-zone"']) if(!before.includes(marker)) throw new Error(`Required live owner marker missing: ${marker}`);
const clean=before.replace(/<!-- dtf-water-root-zone-missing-v6:start -->[\s\S]*?<!-- dtf-water-root-zone-missing-v6:end -->/g,'').trim();
const next=`${clean}\n${block()}`;
await writeFile(join(backupDir,'before.json'),`${JSON.stringify(page,null,2)}\n`);
await writeFile(join(backupDir,'next.html'),next);
let wrote=false;
try{
  if(apply){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});wrote=true;}
  const edit=rendered((await pageBySlug('water-ph-ec')).content);
  if(!edit.includes('data-dtf-water-root-zone-missing-v6="true"')) throw new Error('Edit-context missing-material marker missing.');
  if((edit.match(/data-wr6m-module=/g)||[]).length!==7) throw new Error('Edit-context module count is not seven.');
  for(const marker of ['data-dtf-water-root-zone-v6="true"','data-dtf-water-root-zone-visuals-v6="true"']) if(!edit.includes(marker)) throw new Error(`Existing Water Root Zone layer was lost: ${marker}`);

  let visitor='';let ok=false;
  for(let attempt=1;attempt<=8;attempt++){
    try{const response=await fetch(`${site}/learn/water-ph-ec/?dtf_wr6m=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Water-Root-Zone-Missing-V6-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache'}});visitor=await response.text();if(response.ok&&visitor.includes('data-dtf-water-root-zone-missing-v6="true"')){ok=true;break;}}catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!ok) throw new Error('Visitor missing-material marker missing.');
  if((visitor.match(/data-wr6m-module=/g)||[]).length!==7) throw new Error('Visitor module count is not seven.');
  for(const marker of ['data-dtf-water-root-zone-v6="true"','data-dtf-water-root-zone-visuals-v6="true"','data-dtf-topic="water-root-zone"','data-dtf-learning-v4="topic-water-root-zone"']) if(!visitor.includes(marker)) throw new Error(`Visitor page lost required owner marker: ${marker}`);

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/water-ph-ec/',modules:7,curriculumPreserved:true,visualAtlasPreserved:true,visitorVerified:true,backupDir};
  await writeFile('water-root-zone-missing-material-v6-report.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){try{await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:'publish'})});}catch(rollbackError){throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`);}}
  throw error;
}
