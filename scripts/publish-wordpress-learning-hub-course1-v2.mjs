import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-hub-course1';
const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const local = JSON.parse(await readFile(packagePath, 'utf8'));
const sourceRepo = local.source.repository;
const sourceRef = local.source.ref || 'main';
const rawBase = `https://raw.githubusercontent.com/${sourceRepo}/${encodeURIComponent(sourceRef)}`;
const releaseManifestPath = 'content/public-releases/PUBLIC-RELEASE-LH-TECH1-001.json';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

function validateLocalPackage(d) {
  must(d?.schemaVersion === 1 && d?.id === 'learning-hub-course1', 'Invalid Course 1 site package identity.');
  must(d.publicationState === 'publish', 'Course 1 site package must be publish state.');
  must(d.course?.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 ID.');
  must(Array.isArray(d.modules) && d.modules.length === 6, 'Course 1 requires six modules.');
  must(Array.isArray(d.learnerDocuments) && d.learnerDocuments.length === 3, 'Course 1 requires workbook, templates and practical.');
  must(d.finalAssessment === 'ASSESS-LH-TECH1-001-FINAL', 'Unexpected final Course 1 assessment.');
  must(!/\b(draft|preview|tbd|todo|lorem ipsum|not approved)\b/i.test(JSON.stringify(d)), 'Site package contains unfinished public wording.');
}
validateLocalPackage(local);

async function fetchText(url) {
  let last;
  for (let attempt=1; attempt<=6; attempt++) {
    try {
      const r = await fetch(url, { signal:AbortSignal.timeout(30000), headers:{'User-Agent':'DTF-Learning-Hub-Course1/2.0'} });
      if (r.ok) return r.text();
      last = new Error(`${url} returned ${r.status}`);
    } catch (error) { last = error; }
    await sleep(attempt * 800);
  }
  throw last;
}
async function fetchJson(rel) { return JSON.parse(await fetchText(`${rawBase}/${rel}`)); }
async function fetchLearner(rel) { return fetchText(`${rawBase}/${local.source.basePath}/${rel}`); }

function inline(text) {
  return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
}
function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g,'\n').split('\n');
  const out=[]; let paragraph=[]; let list=''; let table=[];
  const flushParagraph=()=>{ if(paragraph.length){ out.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph=[]; } };
  const flushList=()=>{ if(list){ out.push(`</${list}>`); list=''; } };
  const flushTable=()=>{ if(!table.length) return; const rows=table.filter((r,i)=>!(i===1&&r.every(c=>/^:?-{3,}:?$/.test(c.trim())))); if(rows.length){out.push('<div class="lh1-table"><table><thead><tr>'+rows[0].map(c=>`<th scope="col">${inline(c.trim())}</th>`).join('')+'</tr></thead><tbody>'); for(const r of rows.slice(1))out.push('<tr>'+r.map(c=>`<td>${inline(c.trim())}</td>`).join('')+'</tr>'); out.push('</tbody></table></div>');} table=[]; };
  const flush=()=>{flushParagraph();flushList();flushTable();};
  for(const raw of lines){ const line=raw.trim();
    if(line.startsWith('|')&&line.endsWith('|')){flushParagraph();flushList();table.push(line.slice(1,-1).split('|'));continue;}
    if(table.length)flushTable();
    if(!line){flushParagraph();flushList();continue;}
    if(/^---+$/.test(line)){flush();out.push('<hr>');continue;}
    const h=line.match(/^(#{1,6})\s+(.+)$/); if(h){flush();const n=Math.min(5,Math.max(2,h[1].length+1));out.push(`<h${n}>${inline(h[2])}</h${n}>`);continue;}
    const ul=line.match(/^[-*]\s+(.+)$/); if(ul){flushParagraph();if(list!=='ul'){flushList();list='ul';out.push('<ul>');}out.push(`<li>${inline(ul[1])}</li>`);continue;}
    const ol=line.match(/^\d+[.)]\s+(.+)$/); if(ol){flushParagraph();if(list!=='ol'){flushList();list='ol';out.push('<ol>');}out.push(`<li>${inline(ol[1])}</li>`);continue;}
    if(line.startsWith('>')){flush();out.push(`<blockquote>${inline(line.replace(/^>\s?/,''))}</blockquote>`);continue;}
    paragraph.push(line);
  }
  flush(); return out.join('\n');
}

const unfinished = /\b(tbd|todo|lorem ipsum|not approved for public release|draft production package|preview only)\b/i;
function validateLearnerSource(text,label){must(text.trim().length>=900,`${label}: learner source is too short.`);must(!unfinished.test(text),`${label}: unfinished release wording found in public source.`);}

const css=`<style id="dtf-learning-hub-course1-style">.lh1{--f:#102a19;--g:#1f6a3b;--lime:#d6ec77;--gold:#d9be74;--ink:#193422;--muted:#586d60;--line:#d9e5db;background:linear-gradient(180deg,#fafbf7,#eef5ef);color:var(--ink);padding:54px 0 76px}.lh1 *{box-sizing:border-box}.lh1-wrap{width:min(1120px,calc(100% - 32px));margin:auto}.lh1-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:24px}.lh1 h1{font-size:clamp(2.5rem,6vw,5rem);letter-spacing:-.05em;line-height:1;margin:.18em 0}.lh1 h2{font-size:clamp(1.7rem,3vw,2.6rem);line-height:1.1;margin-top:1.45em}.lh1 h3{line-height:1.18}.lh1 p,.lh1 li{line-height:1.72}.lh1 p{color:var(--muted)}.lh1 a{color:#176739;font-weight:850}.lh1-k{font-size:.76rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#6e5d27}.lh1-card,.lh1-content,.lh1-test,.lh1 details{background:#fff;border:1px solid var(--line);border-radius:16px}.lh1-card{padding:18px}.lh1-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.lh1-content{padding:clamp(20px,4vw,42px);margin-top:20px}.lh1-summary{padding:22px;background:#fff;border:1px solid var(--line);border-radius:16px}.lh1-summary strong{display:block;font-size:2rem;color:var(--g)}.lh1-nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.lh1-nav a{background:#fff;border:1px solid var(--line);border-radius:999px;padding:9px 13px;text-decoration:none}.lh1-boundary{padding:16px 18px;border-left:5px solid var(--gold);background:#fff8e7;border-radius:10px;margin:20px 0}.lh1-test{padding:18px;margin:12px 0}.lh1-answer{margin-top:10px;padding:0 14px}.lh1-answer summary{cursor:pointer;font-weight:900;padding:12px 0}.lh1-table{overflow-x:auto}.lh1 table{border-collapse:collapse;width:100%;min-width:620px}.lh1 th,.lh1 td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.lh1 th{background:#eef5ef}.lh1 blockquote{border-left:4px solid var(--gold);margin:18px 0;padding:10px 18px;background:#fff9e9}.lh1-footer{margin-top:34px;padding:24px;border-radius:18px;background:linear-gradient(145deg,var(--f),#2b4d31);color:#fff}.lh1-footer p{color:#dce8df}.lh1-footer a{color:var(--lime)}.lh1 :focus-visible{outline:3px solid #0b64c0;outline-offset:3px}@media(max-width:850px){.lh1-hero,.lh1-grid{grid-template-columns:1fr}}@media print{.lh1-nav,.lh1-footer{display:none}.lh1{background:#fff;padding:0}}</style>`;
const shell=body=>`${css}<main class="lh1"><div class="lh1-wrap">${body}<footer class="lh1-footer"><h2>Continue in the Learning Hub</h2><p>Course learning assessments are separate from the secure certification examination.</p><p><a href="/learn/learning-hub/">Learning Hub</a> · <a href="/learn/">Teaching Healthy Cultivation</a> · <a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">THC Community</a></p></footer></div></main>`;
const crumb=extra=>`<nav class="lh1-nav" aria-label="Learning Hub breadcrumb"><a href="/learn/">Learn</a><a href="/learn/learning-hub/">Learning Hub</a><a href="${esc(local.program.route)}">${esc(local.program.title)}</a>${extra||''}</nav>`;

async function loadSources(){
  const release=await fetchJson(releaseManifestPath);
  must(release.id==='PUBLIC-RELEASE-LH-TECH1-001'&&release.courseId===local.course.id&&release.publicationState==='published','Canonical Course 1 public-release manifest is missing or not published.');
  const expectedAssessments=[...local.modules.map(m=>m.assessment),local.finalAssessment];
  must(JSON.stringify(release.publicScope.assessments)===JSON.stringify(expectedAssessments),'Site assessment scope differs from canonical public-release manifest.');
  must(release.publicScope.publicCourseItems===108,'Canonical public release must authorize exactly 108 course items.');
  const expectedSources=[...local.modules.map(m=>`${local.source.basePath}/${m.source}`),...local.learnerDocuments.map(d=>`${local.source.basePath}/${d.source}`)];
  for(const src of expectedSources)must(release.publicScope.studentSources.includes(src),`Public source not authorized by release manifest: ${src}`);
  const modules=[]; for(const m of local.modules){const md=await fetchLearner(m.source);validateLearnerSource(md,m.title);modules.push({...m,html:markdownToHtml(md)});}
  const docs=[]; for(const d of local.learnerDocuments){const md=await fetchLearner(d.source);validateLearnerSource(md,d.title);docs.push({...d,html:markdownToHtml(md)});}
  const assessments=[]; let itemCount=0;
  for(const id of expectedAssessments){const a=await fetchJson(`content/assessments/${id}.json`);must(['formative','summative'].includes(a.purpose),`${id}: credential assessment blocked from public release.`);const items=[];for(const itemId of a.items||[]){const q=await fetchJson(`content/questions/${itemId}.json`);must(['formative','summative'].includes(q.purpose),`${itemId}: credential-purpose item blocked.`);must(Array.isArray(q.choices)&&q.choices.length>=2&&Number.isInteger(q.correct),`${itemId}: unsupported public item format.`);items.push(q);itemCount++;}assessments.push({...a,items});}
  must(itemCount===108,'Public Course 1 item count must equal 108.');
  return {release,modules,docs,assessments};
}

function renderTest(a,label){const target=Number(a.passingScorePercent||local.course.masteryTarget||80);const questions=a.items.map((q,i)=>`<article class="lh1-test"><h3>${i+1}. ${esc(q.stem)}</h3><ol type="A">${q.choices.map(c=>`<li>${esc(c)}</li>`).join('')}</ol><details class="lh1-answer"><summary>Check answer and rationale</summary><p><strong>Answer:</strong> ${String.fromCharCode(65+q.correct)}. ${esc(q.choices[q.correct])}</p><p>${esc(q.rationale)}</p></details></article>`).join('');return shell(`${crumb(`<a href="${esc(local.course.route)}">Course 1</a>`)}<p class="lh1-k">${esc(label)}</p><h1>${esc(a.title)}</h1><p>Complete the questions before opening the answer panels. Then review every missed rationale.</p><div class="lh1-boundary"><strong>Course mastery target: ${target}%.</strong> This is a learning target for Course 1, not the passing standard for the separate secure certification examination.</div>${questions}`);}
function courseIndex(s){const cards=s.modules.map(m=>`<article class="lh1-card"><p class="lh1-k">Module ${m.number}</p><h3>${esc(m.title)}</h3><p><a href="${local.course.route}${m.slug}/">Open module →</a></p><p><a href="${local.course.route}test-module-${m.number}/">Take module test →</a></p></article>`).join('');const docs=s.docs.map(d=>`<li><a href="${local.course.route}${d.slug}/">${esc(d.title)}</a></li>`).join('');return shell(`${crumb()}<section class="lh1-hero"><div><p class="lh1-k">THC Cultivation Technician I · Course 1</p><h1>${esc(local.course.title)}</h1><p>${esc(local.course.purpose)}</p></div><aside class="lh1-summary"><strong>6</strong> researched modules<br><strong>108</strong> public course-test items<br><strong>1</strong> integrated practical<p>${esc(local.course.estimatedLearningTime)}</p></aside></section><div class="lh1-boundary"><strong>Finished public learner course.</strong> This page contains the released Course 1 instruction, workbook, practical, module tests, and final course test. The secure certification examination is separate.</div><h2>Course modules</h2><div class="lh1-grid">${cards}</div><section class="lh1-content"><h2>Learner documents</h2><ul>${docs}</ul><h2>Final course test</h2><p><a href="${local.course.route}final-course-test/">Take the 36-item final course test →</a></p><h2>Completion sequence</h2><ol><li>Study Modules 1–6 in order.</li><li>Complete each module test and review missed rationales.</li><li>Complete workbook activities and the integrated practical.</li><li>Complete the final course test and remediate weak domains.</li><li>Continue through the Cultivation Technician I learning path before the separate certification assessment.</li></ol></section>`);}
function modulePage(m){return shell(`${crumb(`<a href="${local.course.route}">Course 1</a>`)}<p class="lh1-k">Course 1 · Module ${m.number}</p><h1>${esc(m.title)}</h1><p><a href="${local.course.route}test-module-${m.number}/">Take the Module ${m.number} learning test →</a></p><article class="lh1-content">${m.html}</article>`);}
function docPage(d){return shell(`${crumb(`<a href="${local.course.route}">Course 1</a>`)}<p class="lh1-k">Course 1 learner document</p><h1>${esc(d.title)}</h1><article class="lh1-content">${d.html}</article>`);}

if(validateOnly){console.log(JSON.stringify({valid:true,id:local.id,course:local.course.id,modules:local.modules.length,learnerDocuments:local.learnerDocuments.length},null,2));process.exit(0);}
must(apply,'Set APPLY_LEARNING_HUB_COURSE1=true to publish.');must(user&&pass,'WordPress application credentials are required.');
const sources=await loadSources();
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
async function wp(path,options={}){let last;for(let attempt=1;attempt<=8;attempt++){try{const r=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTF-Learning-Hub-Course1/2.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});const text=await r.text();let body=text;try{body=text?JSON.parse(text):null}catch{}if((r.status===429||r.status>=500)&&attempt<8){await sleep(attempt*1200);continue;}if(!r.ok)throw new Error(`${options.method||'GET'} ${path} failed (${r.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);return body;}catch(error){last=error;if(attempt<8)await sleep(attempt*1200);}}throw last;}
async function children(slug,parent){const rows=await wp(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);return Array.isArray(rows)?rows.filter(p=>Number(p.parent)===Number(parent)):[];}
const stamp=new Date().toISOString().replace(/[-:.]/g,'');const backupDir=join(backupRoot,`course1-${stamp}`);await mkdir(backupDir,{recursive:true});
async function upsert({slug,title,parent,content}){const rows=await children(slug,parent);must(rows.length<=1,`Duplicate page '${slug}' under parent ${parent}`);if(rows.length){await writeFile(join(backupDir,`page-${rows[0].id}-${slug}-before.json`),`${JSON.stringify(rows[0],null,2)}\n`);return wp(`/wp-json/wp/v2/pages/${rows[0].id}`,{method:'POST',body:JSON.stringify({title,slug,parent,status:'publish',content})});}return wp('/wp-json/wp/v2/pages',{method:'POST',body:JSON.stringify({title,slug,parent,status:'publish',content})});}

const learnRows=await wp('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=20');must(Array.isArray(learnRows)&&learnRows.length===1,'Expected one canonical /learn/ page.');const learn=learnRows[0];await writeFile(join(backupDir,`page-${learn.id}-learn-before.json`),`${JSON.stringify(learn,null,2)}\n`);
const hub=await upsert({slug:'learning-hub',title:'THC Learning Hub',parent:learn.id,content:shell(`<nav class="lh1-nav"><a href="/learn/">← Learn</a></nav><section class="lh1-hero"><div><p class="lh1-k">Teaching Healthy Cultivation</p><h1>THC Learning Hub</h1><p>Purpose-built professional learning paths connect the 420 Comprehensive Educational Resources to applied coursework, practicals, course tests, and the separate THC Academy credential system.</p></div><aside class="lh1-summary"><strong>8</strong> professional certification pathways<p>The Learning Hub contains the dedicated coursework used to prepare for those credentials.</p></aside></section><section class="lh1-content"><h2>Available professional path</h2><h3><a href="${local.program.route}">${esc(local.program.title)}</a></h3><p>Begin with workplace safety, biosecurity, controlled workflows, traceability, equipment boundaries, records, and handoff practice.</p></section>`)});
const program=await upsert({slug:local.program.slug,title:local.program.title,parent:hub.id,content:shell(`<nav class="lh1-nav"><a href="/learn/">Learn</a><a href="/learn/learning-hub/">Learning Hub</a></nav><p class="lh1-k">Professional learning path</p><h1>${esc(local.program.title)}</h1><section class="lh1-content"><h2>Start the sequence</h2><p><a href="${local.course.route}"><strong>Course 1: ${esc(local.course.title)} →</strong></a></p><p>Additional Technician I courses are published one at a time after their complete learner packages and course assessments are finished.</p></section>`)});
const course=await upsert({slug:local.course.slug,title:local.course.title,parent:program.id,content:courseIndex(sources)});const pages=[{type:'hub',id:hub.id},{type:'program',id:program.id},{type:'course',id:course.id}];
for(const m of sources.modules){const p=await upsert({slug:m.slug,title:`Module ${m.number}: ${m.title}`,parent:course.id,content:modulePage(m)});pages.push({type:'module',number:m.number,id:p.id});}
for(const d of sources.docs){const p=await upsert({slug:d.slug,title:d.title,parent:course.id,content:docPage(d)});pages.push({type:'document',slug:d.slug,id:p.id});}
for(let i=0;i<6;i++){const a=sources.assessments[i];const p=await upsert({slug:`test-module-${i+1}`,title:`Module ${i+1} Learning Test`,parent:course.id,content:renderTest(a,`Course 1 · Module ${i+1} learning test`)});pages.push({type:'module-test',number:i+1,id:p.id});}
const finalA=sources.assessments.find(a=>a.id===local.finalAssessment);must(finalA,'Final assessment missing.');const final=await upsert({slug:'final-course-test',title:'Course 1 Final Course Test',parent:course.id,content:renderTest(finalA,'Course 1 · Final course test')});pages.push({type:'final-test',id:final.id});
const start='<!-- DTF_LEARNING_HUB_COURSE1_START -->',end='<!-- DTF_LEARNING_HUB_COURSE1_END -->';const block=`${start}<section id="thc-learning-hub-course1"><h2>Professional certification learning paths</h2><p>The THC Learning Hub contains purpose-built professional courses, practicals, and course tests. Start with <a href="${local.course.route}"><strong>Cultivation Technician I — Course 1: ${esc(local.course.title)}</strong></a>.</p></section>${end}`;let learnContent=rendered(learn.content);const re=new RegExp(`${start}[\\s\\S]*?${end}`);learnContent=re.test(learnContent)?learnContent.replace(re,block):`${learnContent}\n${block}`;await wp(`/wp-json/wp/v2/pages/${learn.id}`,{method:'POST',body:JSON.stringify({status:'publish',content:learnContent})});
const report={generatedAt:new Date().toISOString(),sourceRelease:sources.release.id,sourceCourse:local.course.id,publicItems:108,pages,backupDir};await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
