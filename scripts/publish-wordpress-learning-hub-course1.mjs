import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const sourcePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-hub-course1';
const manifest = JSON.parse(await readFile(sourcePath, 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const esc = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const must = (condition, message) => { if (!condition) throw new Error(message); };

function validateManifest(data) {
  must(data?.schemaVersion === 1 && data?.id === 'learning-hub-course1', 'Invalid Course 1 public manifest identity.');
  must(data.publicationState === 'publish', 'Course 1 public manifest must be publish state.');
  must(data.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 ID.');
  must(Array.isArray(data.modules) && data.modules.length === 6, 'Course 1 requires six public modules.');
  must(Array.isArray(data.learnerDocuments) && data.learnerDocuments.length === 3, 'Course 1 requires workbook, templates and integrated practical.');
  must(data.finalAssessment === 'ASSESS-LH-TECH1-001-FINAL', 'Unexpected final course assessment.');
  const forbidden = /\b(draft|preview|tbd|todo|lorem ipsum|not approved)\b/i;
  must(!forbidden.test(JSON.stringify(data)), 'Public manifest contains unfinished/public-preview wording.');
  return { modules:data.modules.length, learnerDocuments:data.learnerDocuments.length };
}
const totals = validateManifest(manifest);

const rawBase = `https://raw.githubusercontent.com/${manifest.source.repository}/${encodeURIComponent(manifest.source.ref)}`;
async function fetchSource(relativePath) {
  const url = `${rawBase}/${manifest.source.basePath}/${relativePath}`;
  const response = await fetch(url, { signal:AbortSignal.timeout(30000), headers:{'User-Agent':'DTF-Learning-Hub-Course1-Publisher/1.0'} });
  if (!response.ok) throw new Error(`Source fetch failed ${response.status}: ${url}`);
  return response.text();
}
async function fetchRepoJson(relativePath) {
  const url = `${rawBase}/${relativePath}`;
  const response = await fetch(url, { signal:AbortSignal.timeout(30000), headers:{'User-Agent':'DTF-Learning-Hub-Course1-Publisher/1.0'} });
  if (!response.ok) throw new Error(`JSON source fetch failed ${response.status}: ${url}`);
  return response.json();
}

function inline(text) {
  let value = esc(text);
  value = value.replace(/`([^`]+)`/g, '<code>$1</code>');
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return value;
}
function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g,'\n').split('\n');
  const out=[];
  let list=null;
  let paragraph=[];
  let tableRows=[];
  const flushParagraph=()=>{ if(paragraph.length){ out.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph=[]; } };
  const flushList=()=>{ if(list){ out.push(`</${list}>`); list=null; } };
  const flushTable=()=>{
    if(!tableRows.length) return;
    const rows=tableRows.filter((row,i)=>!(i===1 && row.every(cell=>/^:?-{3,}:?$/.test(cell.trim()))));
    if(rows.length){
      const head=rows[0];
      out.push('<div class="lh-table-wrap"><table><thead><tr>'+head.map(c=>`<th scope="col">${inline(c.trim())}</th>`).join('')+'</tr></thead><tbody>');
      for(const row of rows.slice(1)) out.push('<tr>'+row.map(c=>`<td>${inline(c.trim())}</td>`).join('')+'</tr>');
      out.push('</tbody></table></div>');
    }
    tableRows=[];
  };
  const flushAll=()=>{ flushParagraph(); flushList(); flushTable(); };
  for (let i=0;i<lines.length;i++) {
    const line=lines[i];
    const trimmed=line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph(); flushList();
      tableRows.push(trimmed.slice(1,-1).split('|'));
      continue;
    }
    if(tableRows.length) flushTable();
    if(!trimmed){ flushParagraph(); flushList(); continue; }
    if(/^---+$/.test(trimmed)){ flushAll(); out.push('<hr>'); continue; }
    const heading=trimmed.match(/^(#{1,6})\s+(.+)$/);
    if(heading){ flushAll(); const level=Math.min(5,Math.max(2,heading[1].length+1)); out.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const unordered=trimmed.match(/^[-*]\s+(.+)$/);
    if(unordered){ flushParagraph(); if(list!=='ul'){ flushList(); list='ul'; out.push('<ul>'); } out.push(`<li>${inline(unordered[1])}</li>`); continue; }
    const ordered=trimmed.match(/^\d+[.)]\s+(.+)$/);
    if(ordered){ flushParagraph(); if(list!=='ol'){ flushList(); list='ol'; out.push('<ol>'); } out.push(`<li>${inline(ordered[1])}</li>`); continue; }
    if(trimmed.startsWith('>')){ flushAll(); out.push(`<blockquote>${inline(trimmed.replace(/^>\s?/,''))}</blockquote>`); continue; }
    paragraph.push(trimmed);
  }
  flushAll();
  return out.join('\n');
}

const forbiddenPublicSource = /\b(draft|preview|tbd|todo|lorem ipsum|pilot\/calibration only until approved|not approved for public release)\b/i;
function validatePublicMarkdown(markdown, label) {
  must(String(markdown).trim().length >= 900, `${label}: learner source is too short.`);
  must(!forbiddenPublicSource.test(markdown), `${label}: unfinished/internal release wording found in learner source.`);
}

const css = `<style id="dtf-learning-hub-course1-style">
.lh1{--forest:#102a19;--green:#1f6a3b;--lime:#d6ec77;--gold:#d9be74;--ink:#193422;--muted:#586d60;--line:#d9e5db;--soft:#f4f8f4;--paper:#fff;background:linear-gradient(180deg,#f9faf5,#eef5ef);color:var(--ink);padding:58px 0 78px}.lh1 *{box-sizing:border-box}.lh1-wrap{width:min(1120px,calc(100% - 32px));margin:auto}.lh1-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;align-items:start}.lh1-kicker{font-size:.76rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#6e5d27}.lh1 h1,.lh1 h2,.lh1 h3,.lh1 h4{color:var(--ink);line-height:1.08}.lh1 h1{font-size:clamp(2.5rem,6vw,5rem);letter-spacing:-.05em;margin:.2em 0}.lh1 h2{font-size:clamp(1.8rem,3.5vw,2.8rem);margin-top:1.5em}.lh1 p,.lh1 li{line-height:1.72}.lh1 p{color:var(--muted)}.lh1-card,.lh1 article,.lh1 details{background:#fff;border:1px solid var(--line);border-radius:16px}.lh1-summary{padding:22px}.lh1-summary strong{display:block;font-size:2rem;color:var(--green)}.lh1-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.lh1-card{padding:18px}.lh1 a{color:#176739;font-weight:800}.lh1-nav{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.lh1-nav a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:9px 13px;text-decoration:none}.lh1-content{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(20px,4vw,42px);margin-top:20px}.lh1-content code{background:#edf2ed;padding:.1em .35em;border-radius:5px}.lh1-content blockquote{border-left:4px solid var(--gold);margin:18px 0;padding:10px 18px;background:#fff9e9}.lh1-table-wrap{overflow-x:auto}.lh1 table{border-collapse:collapse;width:100%;min-width:620px}.lh1 th,.lh1 td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.lh1 th{background:#eef5ef}.lh1-boundary{padding:16px 18px;border-left:5px solid var(--gold);background:#fff8e7;border-radius:10px;margin:20px 0}.lh1-test-item{padding:18px;margin:12px 0}.lh1-test-item ol{margin-top:8px}.lh1-answer{margin:10px 0;padding:0 15px}.lh1-answer summary{cursor:pointer;font-weight:900;padding:12px 0}.lh1-answer p{margin:.4em 0 1em}.lh1-footer{margin-top:34px;padding:24px;border-radius:18px;background:linear-gradient(145deg,var(--forest),#2b4d31);color:white}.lh1-footer p{color:#dce8df}.lh1-footer a{color:var(--lime)}.lh1 :focus-visible{outline:3px solid #0b64c0;outline-offset:3px}@media(max-width:850px){.lh1-hero,.lh1-grid{grid-template-columns:1fr}}@media print{.lh1-nav,.lh1-footer{display:none}.lh1{background:#fff;padding:0}.lh1-content,.lh1-card,.lh1-test-item{border-color:#bbb;box-shadow:none}}
</style>`;
const shell = (body) => `${css}<main class="lh1"><div class="lh1-wrap">${body}<footer class="lh1-footer"><h2>Continue in the Learning Hub</h2><p>Course learning assessments are separate from the secure certification examination. Use the course material, workbook, practical, and tests to build competence before credential assessment.</p><p><a href="/learn/learning-hub/">Learning Hub</a> · <a href="/learn/">Teaching Healthy Cultivation</a> · <a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">THC Community</a></p></footer></div></main>`;
const breadcrumb = (extra='') => `<nav class="lh1-nav" aria-label="Learning Hub breadcrumb"><a href="/learn/">Learn</a><a href="/learn/learning-hub/">Learning Hub</a><a href="${esc(manifest.program.route)}">${esc(manifest.program.title)}</a>${extra}</nav>`;

async function loadPublicSources({ requirePublished=false }={}) {
  const modules=[];
  for(const module of manifest.modules){
    const md=await fetchSource(module.source); validatePublicMarkdown(md, module.title); modules.push({...module,markdown:md,html:markdownToHtml(md)});
  }
  const docs=[];
  for(const doc of manifest.learnerDocuments){
    const md=await fetchSource(doc.source); validatePublicMarkdown(md, doc.title); docs.push({...doc,markdown:md,html:markdownToHtml(md)});
  }
  const assessments=[];
  for(const assessmentId of [...manifest.modules.map(m=>m.assessment),manifest.finalAssessment]){
    const a=await fetchRepoJson(`content/assessments/${assessmentId}.json`);
    must(['formative','summative'].includes(a.purpose), `${assessmentId}: only course assessments may be public.`);
    if(requirePublished) must(a.status==='published', `${assessmentId}: source assessment is not published.`);
    const items=[];
    for(const itemId of a.items){
      const item=await fetchRepoJson(`content/questions/${itemId}.json`);
      must(['formative','summative'].includes(item.purpose), `${itemId}: credential-purpose item blocked.`);
      if(requirePublished) must(item.status==='active', `${itemId}: source item is not active.`);
      must(Array.isArray(item.choices)&&item.choices.length>=2&&Number.isInteger(item.correct), `${itemId}: unsupported public course-test item format.`);
      items.push(item);
    }
    assessments.push({...a,items});
  }
  must(assessments.reduce((sum,a)=>sum+a.items.length,0)===108,'Expected exactly 108 public Course 1 items.');
  return {modules,docs,assessments};
}

function renderCourseTest(assessment, label) {
  const target=Number(assessment.passingScorePercent || manifest.course.masteryTarget || 80);
  const items=assessment.items.map((item,index)=>`<article class="lh1-test-item"><h3>${index+1}. ${esc(item.stem)}</h3><ol type="A">${item.choices.map(choice=>`<li>${esc(choice)}</li>`).join('')}</ol><details class="lh1-answer"><summary>Check answer and rationale</summary><p><strong>Answer:</strong> ${String.fromCharCode(65+item.correct)}. ${esc(item.choices[item.correct])}</p><p>${esc(item.rationale)}</p></details></article>`).join('');
  return shell(`${breadcrumb(`<a href="${esc(manifest.course.route)}">Course 1</a>`)}<header><p class="lh1-kicker">${esc(label)}</p><h1>${esc(assessment.title)}</h1><p>Complete the questions without opening the answer panels. Then self-score and review every missed rationale.</p><div class="lh1-boundary"><strong>Course mastery target: ${target}%.</strong> This target governs course learning and practice. It is not the passing standard for the separate secure Cultivation Technician I certification examination.</div></header><section aria-label="Course assessment questions">${items}</section>`);
}

function courseIndex(modules, docs, assessments){
  const moduleCards=modules.map(m=>`<article class="lh1-card"><p class="lh1-kicker">Module ${m.number}</p><h3>${esc(m.title)}</h3><p><a href="${esc(manifest.course.route)}${esc(m.slug)}/">Open module →</a></p><p><a href="${esc(manifest.course.route)}test-module-${m.number}/">Take Module ${m.number} test →</a></p></article>`).join('');
  const docLinks=docs.map(d=>`<li><a href="${esc(manifest.course.route)}${esc(d.slug)}/">${esc(d.title)}</a></li>`).join('');
  return shell(`${breadcrumb()}<section class="lh1-hero"><div><p class="lh1-kicker">THC Cultivation Technician I · Course 1</p><h1>${esc(manifest.course.title)}</h1><p>${esc(manifest.course.purpose)}</p></div><aside class="lh1-summary"><strong>6</strong> researched modules<br><strong>108</strong> public course-test items<br><strong>1</strong> integrated practical<p>${esc(manifest.course.estimatedLearningTime)}</p></aside></section><div class="lh1-boundary"><strong>Published learner course.</strong> The instruction, workbook, practical, module tests, and final course test on these pages are the public Course 1 learning package. The secure certification examination is a separate controlled assessment.</div><section><h2>Course modules</h2><div class="lh1-grid">${moduleCards}</div></section><section class="lh1-content"><h2>Learner documents</h2><ul>${docLinks}</ul><h2>Final course test</h2><p><a href="${esc(manifest.course.route)}final-course-test/">Take the 36-item final course test →</a></p><h2>Course completion sequence</h2><ol><li>Study Modules 1–6 in order.</li><li>Complete each module learning test and review missed rationales.</li><li>Complete the workbook activities and integrated practical.</li><li>Complete the 36-item final course test and remediate weak domains.</li><li>Continue through the Cultivation Technician I course sequence before the separate certification assessment.</li></ol></section>`);
}
function modulePage(module){return shell(`${breadcrumb(`<a href="${esc(manifest.course.route)}">Course 1</a>`)}<header><p class="lh1-kicker">Course 1 · Module ${module.number}</p><h1>${esc(module.title)}</h1><p><a href="${esc(manifest.course.route)}test-module-${module.number}/">Take the Module ${module.number} learning test →</a></p></header><article class="lh1-content">${module.html}</article>`);}
function docPage(doc){return shell(`${breadcrumb(`<a href="${esc(manifest.course.route)}">Course 1</a>`)}<header><p class="lh1-kicker">Course 1 learner document</p><h1>${esc(doc.title)}</h1></header><article class="lh1-content">${doc.html}</article>`);}

if(validateOnly){
  console.log(JSON.stringify({valid:true,id:manifest.id,...totals,route:manifest.course.route},null,2));
  process.exit(0);
}
if(!apply) throw new Error('Set APPLY_LEARNING_HUB_COURSE1=true for production publication.');
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sourceData=await loadPublicSources({requirePublished:true});

async function request(apiPath,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt++){
    try{
      const response=await fetch(`${site}${apiPath}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTF-Learning-Hub-Course1-Publisher/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text(); let body=text; try{body=text?JSON.parse(text):null}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${apiPath} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<8)await sleep(attempt*1500);}
  }
  throw last;
}
async function findChildren(slug,parent){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  return Array.isArray(rows)?rows.filter(p=>Number(p.parent)===Number(parent)):[];
}
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`course1-${stamp}`); await mkdir(backupDir,{recursive:true});
async function upsertPage({slug,title,parent,content}){
  const rows=await findChildren(slug,parent);
  must(rows.length<=1,`Duplicate page slug '${slug}' under parent ${parent}`);
  if(rows.length===1){
    await writeFile(join(backupDir,`page-${rows[0].id}-${slug}-before.json`),`${JSON.stringify(rows[0],null,2)}\n`);
    return request(`/wp-json/wp/v2/pages/${rows[0].id}`,{method:'POST',body:JSON.stringify({title,slug,parent,status:'publish',content})});
  }
  return request('/wp-json/wp/v2/pages',{method:'POST',body:JSON.stringify({title,slug,parent,status:'publish',content})});
}

const learnRows=await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=20');
must(Array.isArray(learnRows)&&learnRows.length===1,'Expected one canonical /learn/ page.');
const learn=learnRows[0];
await writeFile(join(backupDir,`page-${learn.id}-learn-before.json`),`${JSON.stringify(learn,null,2)}\n`);

const hubContent=shell(`<nav class="lh1-nav"><a href="/learn/">← Learn</a></nav><section class="lh1-hero"><div><p class="lh1-kicker">Teaching Healthy Cultivation</p><h1>THC Learning Hub</h1><p>Purpose-built professional learning paths connect the 420 Comprehensive Educational Resources to applied coursework, practicals, course tests, and the separate THC Academy credential system.</p></div><aside class="lh1-summary"><strong>8</strong> professional certification pathways<p>The Learning Hub contains the dedicated coursework used to prepare for those credentials.</p></aside></section><section class="lh1-content"><h2>Available professional path</h2><h3><a href="${esc(manifest.program.route)}">${esc(manifest.program.title)}</a></h3><p>Begin with workplace safety, biosecurity, controlled workflows, traceability, equipment boundaries, records, and handoff practice.</p></section>`);
const hub=await upsertPage({slug:'learning-hub',title:'THC Learning Hub',parent:learn.id,content:hubContent});
const programContent=shell(`<nav class="lh1-nav"><a href="/learn/">Learn</a><a href="/learn/learning-hub/">Learning Hub</a></nav><section class="lh1-hero"><div><p class="lh1-kicker">Professional learning path</p><h1>${esc(manifest.program.title)}</h1><p>Dedicated courses build the routine execution, observation, records, troubleshooting boundaries, and applied judgment expected of an entry cultivation technician.</p></div><aside class="lh1-summary"><strong>Course 1</strong><p><a href="${esc(manifest.course.route)}">${esc(manifest.course.title)}</a></p></aside></section><section class="lh1-content"><h2>Start the sequence</h2><p><a href="${esc(manifest.course.route)}"><strong>Open Course 1 →</strong></a></p><p>Additional Technician I courses are published one at a time after their full learner package and course assessments are finished.</p></section>`);
const program=await upsertPage({slug:manifest.program.slug,title:manifest.program.title,parent:hub.id,content:programContent});
const course=await upsertPage({slug:manifest.course.slug,title:manifest.course.title,parent:program.id,content:courseIndex(sourceData.modules,sourceData.docs,sourceData.assessments)});
const results=[{type:'hub',id:hub.id},{type:'program',id:program.id},{type:'course',id:course.id}];
for(const module of sourceData.modules){const page=await upsertPage({slug:module.slug,title:`Module ${module.number}: ${module.title}`,parent:course.id,content:modulePage(module)});results.push({type:'module',number:module.number,id:page.id});}
for(const doc of sourceData.docs){const page=await upsertPage({slug:doc.slug,title:doc.title,parent:course.id,content:docPage(doc)});results.push({type:'document',slug:doc.slug,id:page.id});}
for(let i=0;i<6;i++){const a=sourceData.assessments[i];const page=await upsertPage({slug:`test-module-${i+1}`,title:`Module ${i+1} Learning Test`,parent:course.id,content:renderCourseTest(a,`Course 1 · Module ${i+1} learning test`)});results.push({type:'module-test',number:i+1,id:page.id});}
const finalAssessment=sourceData.assessments.find(a=>a.id===manifest.finalAssessment);must(finalAssessment,'Final course assessment source not found.');
const finalPage=await upsertPage({slug:'final-course-test',title:'Course 1 Final Course Test',parent:course.id,content:renderCourseTest(finalAssessment,'Course 1 · Final course test')});results.push({type:'final-test',id:finalPage.id});

const markerStart='<!-- DTF_LEARNING_HUB_COURSE1_START -->';
const markerEnd='<!-- DTF_LEARNING_HUB_COURSE1_END -->';
const learnBlock=`${markerStart}<section id="thc-learning-hub-course1"><h2>Professional certification learning paths</h2><p>The THC Learning Hub contains purpose-built professional courses, practicals, and course tests. Start with <a href="/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/"><strong>Cultivation Technician I — Course 1: Safety, Responsible Practice & Cultivation Workflows</strong></a>.</p></section>${markerEnd}`;
let learnContent=rendered(learn.content);
const markerRe=new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);
learnContent=markerRe.test(learnContent)?learnContent.replace(markerRe,learnBlock):`${learnContent}\n${learnBlock}`;
await request(`/wp-json/wp/v2/pages/${learn.id}`,{method:'POST',body:JSON.stringify({status:'publish',content:learnContent})});

const report={generatedAt:new Date().toISOString(),sourceCourse:manifest.course.id,publicItems:108,pages:results,backupDir};
await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
