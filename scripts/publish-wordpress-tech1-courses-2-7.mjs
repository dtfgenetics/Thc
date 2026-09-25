import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_TECH1_PUBLIC_COURSES || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const configPath = process.env.TECH1_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech1-courses-public-v1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-tech1-public-courses';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const rawBase = `https://raw.githubusercontent.com/${config.source.repository}/${encodeURIComponent(config.source.ref || 'main')}`;
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const slugify = value => String(value).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72);

must(config.schemaVersion === 1 && config.id === 'tech1-courses-public-v1', 'Unexpected Technician I public-course config.');
must(Array.isArray(config.courses) && config.courses.length === 6, 'Expected Courses 2-7 in public-course config.');
must(new Set(config.courses.map(x=>x.id)).size === 6, 'Technician I public-course IDs must be unique.');

async function fetchText(url){
  let last;
  for(let attempt=1; attempt<=6; attempt++){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'DTF-Tech1-Public-Courses/1.0'}});
      if(r.ok) return r.text();
      last=new Error(`${url} returned ${r.status}`);
    }catch(e){last=e;}
    if(attempt<6) await sleep(attempt*700);
  }
  throw last;
}
async function fetchJson(rel){ return JSON.parse(await fetchText(`${rawBase}/${rel}`)); }

async function loadCourse(entry){
  const course=await fetchJson(`content/courses/${entry.id}.json`);
  const release=await fetchJson(`content/public-releases/${entry.releaseId}.json`);
  must(release.courseId===entry.id && release.publicationState==='published', `${entry.id}: public release missing or not published.`);
  must(release.publicationBoundary?.credentialExam==='restricted', `${entry.id}: credential exam must remain restricted.`);
  must(Array.isArray(release.publicScope?.modules) && release.publicScope.modules.length===1, `${entry.id}: expected one dedicated public module.`);
  const module=await fetchJson(`content/modules/${release.publicScope.modules[0]}.json`);
  const lessons=[];
  for(const lessonId of module.lessons||[]){
    must(release.publicScope.studentSources.includes(`content/lessons/${lessonId}.json`), `${entry.id}: ${lessonId} not authorized by public release.`);
    const lesson=await fetchJson(`content/lessons/${lessonId}.json`);
    must(lesson.id===lessonId && lesson.content?.overview && lesson.content?.summary, `${lessonId}: incomplete learner lesson source.`);
    lessons.push(lesson);
  }
  const assessments=[];
  let itemCount=0;
  for(const assessmentId of release.publicScope.assessments||[]){
    const assessment=await fetchJson(`content/assessments/${assessmentId}.json`);
    must(['formative','summative'].includes(assessment.purpose), `${assessmentId}: credential-purpose assessment blocked.`);
    const items=[];
    for(const itemId of assessment.items||[]){
      const q=await fetchJson(`content/questions/${itemId}.json`);
      must(['formative','summative'].includes(q.purpose), `${itemId}: credential-purpose item blocked.`);
      must(Array.isArray(q.choices) && Number.isInteger(q.correct), `${itemId}: unsupported public question format.`);
      items.push(q); itemCount++;
    }
    assessments.push({...assessment,items});
  }
  must(itemCount===release.publicScope.publicCourseItems, `${entry.id}: public item count ${itemCount} differs from release ${release.publicScope.publicCourseItems}.`);
  return {...entry,course,release,module,lessons,assessments,itemCount,route:`${config.program.route}${entry.slug}/`};
}

const css=`<style id="dtf-tech1-public-courses-v1">.t1c{--ink:#183223;--muted:#5a6b60;--deep:#0b281a;--green:#227244;--soft:#f4f8f4;--line:#d8e4da;--gold:#c9a74f;background:linear-gradient(180deg,#fafbf7,#f1f6f1);color:var(--ink);padding:32px 0 72px}.t1c *{box-sizing:border-box}.t1c-wrap{width:min(1120px,calc(100% - 28px));margin:auto}.t1c-hero{padding:clamp(26px,5vw,54px);border-radius:22px;background:linear-gradient(135deg,var(--deep),#1b4a2f);color:#fff}.t1c-k{font-size:.75rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#b8e3be}.t1c h1{font-size:clamp(2.2rem,5vw,4.6rem);line-height:1;letter-spacing:-.045em;margin:.2em 0}.t1c h2{font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.12}.t1c p,.t1c li{line-height:1.7}.t1c-hero p{color:#dfece2;max-width:820px}.t1c-nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.t1c-nav a,.t1c-btn{display:inline-flex;align-items:center;min-height:42px;padding:9px 13px;border:1px solid var(--line);border-radius:10px;background:#fff;color:#175f36!important;font-weight:850;text-decoration:none!important}.t1c-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.t1c-card,.t1c-panel,.t1c-q{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px}.t1c-card h3,.t1c-panel h2{margin-top:0}.t1c-meta{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.t1c-pill{padding:6px 9px;border-radius:999px;background:#eaf3eb;color:#285d3a;font-size:.78rem;font-weight:850}.t1c-boundary{margin:18px 0;padding:15px 17px;border-left:5px solid var(--gold);background:#fff7df;border-radius:10px;color:#554b2c}.t1c-section{margin-top:28px}.t1c-vocab{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.t1c-vocab div{padding:14px;background:var(--soft);border-radius:12px}.t1c-step{padding:14px 16px;border-left:4px solid #4a9a61;background:#f7faf7;margin:10px 0}.t1c-scenario{padding:18px;background:#f8f5e9;border:1px solid #e6dcc1;border-radius:14px}.t1c details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:0 14px}.t1c summary{cursor:pointer;font-weight:900;padding:12px 0}.t1c-q{margin:12px 0}.t1c-q ol{padding-left:24px}.t1c-table{overflow:auto}.t1c table{width:100%;border-collapse:collapse;min-width:620px}.t1c th,.t1c td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.t1c th{background:var(--soft)}.t1c :focus-visible{outline:3px solid #155fbd;outline-offset:3px}@media(max-width:760px){.t1c-grid,.t1c-vocab{grid-template-columns:1fr}.t1c-hero{border-radius:16px;padding:24px 18px}.t1c-wrap{width:min(100% - 18px,1120px)}}@media print{.t1c{background:#fff;padding:0}.t1c-nav{display:none}}</style>`;
const shell=body=>`${css}<main class="t1c"><div class="t1c-wrap">${body}</div></main>`;
const crumbs=(course,title='')=>`<nav class="t1c-nav" aria-label="Learning Hub breadcrumb"><a href="/courses/">Courses</a><a href="${esc(config.program.route)}">${esc(config.program.title)}</a><a href="${esc(course.route)}">Course ${course.number}</a>${title?`<span class="t1c-pill">${esc(title)}</span>`:''}</nav>`;

function renderBlock(block){
  if(!block||typeof block!=='object') return '';
  if(block.type==='steps') return `<section class="t1c-section"><h2>${esc(block.title||'Steps')}</h2>${(block.items||[]).map((x,i)=>`<div class="t1c-step"><strong>${i+1}. ${esc(x.title||'Step')}</strong><p>${esc(x.body||'')}</p></div>`).join('')}</section>`;
  if(block.type==='scenario') return `<section class="t1c-section t1c-scenario"><h2>${esc(block.title||'Scenario')}</h2>${block.setting?`<p><strong>Setting:</strong> ${esc(block.setting)}</p>`:''}<p><strong>Prompt:</strong> ${esc(block.prompt||'')}</p>${Array.isArray(block.options)?`<ol type="A">${block.options.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}${block.answer?`<details><summary>Check response</summary><p><strong>Answer:</strong> ${esc(block.answer)}</p>${block.feedback?`<p>${esc(block.feedback)}</p>`:''}</details>`:''}</section>`;
  if(block.type==='comparison') return `<section class="t1c-section"><h2>${esc(block.title||'Comparison')}</h2><div class="t1c-grid">${(block.items||[]).map(x=>`<article class="t1c-card"><h3>${esc(x.title||x.label||'')}</h3><p>${esc(x.body||x.description||'')}</p></article>`).join('')}</div></section>`;
  if(block.type==='table'){
    const headers=block.headers||block.columns||[]; const rows=block.rows||[];
    return `<section class="t1c-section"><h2>${esc(block.title||'Reference table')}</h2><div class="t1c-table"><table>${headers.length?`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map(r=>`<tr>${(Array.isArray(r)?r:Object.values(r)).map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }
  if(block.type==='activity') return `<section class="t1c-section t1c-card"><h2>${esc(block.title||'Practice')}</h2><p>${esc(block.prompt||block.body||block.instructions||'')}</p></section>`;
  if(block.type==='document') return `<section class="t1c-section t1c-card"><h2>${esc(block.title||'Document practice')}</h2><p>${esc(block.body||block.prompt||'')}</p></section>`;
  if(block.type==='image' && (block.src||block.url)) return `<figure class="t1c-section"><img src="${esc(block.src||block.url)}" alt="${esc(block.alt||'')}" loading="lazy" style="max-width:100%;height:auto;border-radius:14px"><figcaption>${esc(block.caption||'')}</figcaption></figure>`;
  return '';
}
function renderLesson(course,lesson,index){
  const c=lesson.content||{};
  const vocab=(c.vocabulary||[]).map(v=>`<div><strong>${esc(v.term)}</strong><p>${esc(v.definition)}</p></div>`).join('');
  const sections=(c.sections||[]).map(s=>`<section class="t1c-section"><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join('');
  const examples=(c.workedExamples||[]).length?`<section class="t1c-section t1c-panel"><h2>Worked examples</h2><ul>${c.workedExamples.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:'';
  const mistakes=(c.commonMistakes||[]).length?`<section class="t1c-section t1c-panel"><h2>Common mistakes</h2><ul>${c.commonMistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:'';
  const blocks=(c.blocks||[]).map(renderBlock).join('');
  const nav=[];
  if(index>0) nav.push(`<a class="t1c-btn" href="${course.route}lesson-${String(index).padStart(2,'0')}/">← Previous lesson</a>`);
  if(index<course.lessons.length-1) nav.push(`<a class="t1c-btn" href="${course.route}lesson-${String(index+2).padStart(2,'0')}/">Next lesson →</a>`);
  return shell(`${crumbs(course,`Lesson ${index+1}`)}<header class="t1c-hero"><span class="t1c-k">Course ${course.number} · Lesson ${index+1}</span><h1>${esc(lesson.title)}</h1><p>${esc(c.overview)}</p><div class="t1c-meta"><span class="t1c-pill">${esc(lesson.estimatedMinutes||'')} min</span><span class="t1c-pill">${esc((lesson.learningObjectives||[]).length)} objectives</span></div></header>${vocab?`<section class="t1c-section"><h2>Key vocabulary</h2><div class="t1c-vocab">${vocab}</div></section>`:''}${sections}${examples}${mistakes}${blocks}${c.practicalApplication?`<section class="t1c-section t1c-panel"><h2>Practical application</h2><p>${esc(c.practicalApplication)}</p></section>`:''}<section class="t1c-section t1c-panel"><h2>Lesson summary</h2><p>${esc(c.summary)}</p></section><div class="t1c-nav">${nav.join('')}</div><div class="t1c-boundary"><strong>Training boundary:</strong> Public lesson completion is academic learning evidence only. It does not issue the THC Cultivation Technician I professional certification.</div>`);
}
function renderAssessment(course,assessment,label){
  if(assessment.purpose==='summative'){
    return shell(`${crumbs(course,label)}<header class="t1c-hero"><span class="t1c-k">Course ${course.number} · ${esc(label)}</span><h1>${esc(assessment.title)}</h1><p>This final is graded by the authenticated assessment system after submission. Public answer keys and self-verification are disabled.</p></header><div class="t1c-boundary"><strong>Graded assessment:</strong> responses are saved to the learner attempt, the server enforces the timer, and the result is written to the learner record. <a href="/learn/academy/">Open the Academy assessment portal →</a></div>`);
  }
  const qs=assessment.items.map((q,i)=>`<article class="t1c-q"><h3>${i+1}. ${esc(q.stem)}</h3><ol type="A">${q.choices.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><details><summary>Check answer and rationale</summary><p><strong>Answer:</strong> ${String.fromCharCode(65+q.correct)}. ${esc(q.choices[q.correct])}</p>${q.rationale?`<p>${esc(q.rationale)}</p>`:''}</details></article>`).join('');
  return shell(`${crumbs(course,label)}<header class="t1c-hero"><span class="t1c-k">Course ${course.number} · ${esc(label)}</span><h1>${esc(assessment.title)}</h1><p>Complete each item before opening the answer panel. Use missed rationales to return to the matching lesson.</p></header><div class="t1c-boundary"><strong>Formative learning check:</strong> this self-check is for study only and does not create a graded certification record.</div><section class="t1c-section">${qs}</section>`);
}
function renderIndex(course){
  const lessonCards=course.lessons.map((l,i)=>`<article class="t1c-card"><span class="t1c-k" style="color:#47755a">Lesson ${i+1}</span><h3>${esc(l.title)}</h3><p>${esc(l.content?.overview||'')}</p><a class="t1c-btn" href="${course.route}lesson-${String(i+1).padStart(2,'0')}/">Open lesson →</a></article>`).join('');
  const assessmentCards=course.assessments.map(a=>{const label=a.purpose==='summative'?'Course assessment':(course.number===7?'Readiness check':'Knowledge check');const slug=a.purpose==='summative'?'course-assessment':(course.number===7?'readiness-check':'knowledge-check');return `<article class="t1c-card"><span class="t1c-k" style="color:#47755a">${esc(label)}</span><h3>${esc(a.title)}</h3><p>${a.items.length} public learning items.</p><a class="t1c-btn" href="${course.route}${slug}/">Open assessment →</a></article>`;}).join('');
  return shell(`${crumbs(course)}<header class="t1c-hero"><span class="t1c-k">THC Cultivation Technician I · Course ${course.number}</span><h1>${esc(course.course.title)}</h1><p>${esc(course.course.description)}</p><div class="t1c-meta"><span class="t1c-pill">${course.lessons.length} lessons</span><span class="t1c-pill">${course.itemCount} public learning items</span></div></header><section class="t1c-section t1c-panel"><h2>What you will learn</h2><ul>${(course.course.learningOutcomes||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="t1c-section"><h2>Lessons</h2><div class="t1c-grid">${lessonCards}</div></section><section class="t1c-section"><h2>Learning assessments</h2><div class="t1c-grid">${assessmentCards}</div></section><div class="t1c-boundary"><strong>Public professional training:</strong> this course is open for study and academic learning assessment. Professional certification issuance remains a separate, restricted validation process.</div>`);
}

async function wp(endpoint,options={}){
  must(auth,'WordPress credentials are required.');
  const r=await fetch(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//,'')}`,{...options,headers:{Authorization:auth,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(30000)});
  const text=await r.text();
  if(!r.ok) throw new Error(`${endpoint} returned ${r.status}: ${text.slice(0,500)}`);
  return text?JSON.parse(text):null;
}
async function findPage(slug,parent=null){
  const parentQuery=parent===null?'':`&parent=${parent}`;
  const rows=await wp(`pages?slug=${encodeURIComponent(slug)}${parentQuery}&context=edit&per_page=100`);
  return rows[0]||null;
}
async function upsertPage({slug,title,parent,content,excerpt=''}){
  const existing=await findPage(slug,parent);
  if(existing){
    await mkdir(backupRoot,{recursive:true});
    await writeFile(join(backupRoot,`${existing.id}-${slug}.json`),JSON.stringify(existing,null,2));
  }
  const body=JSON.stringify({slug,title,parent,status:'publish',content,excerpt,comment_status:'closed'});
  return existing?wp(`pages/${existing.id}`,{method:'POST',body}):wp('pages',{method:'POST',body});
}

const courses=[];
for(const entry of config.courses) courses.push(await loadCourse(entry));

if(validateOnly){
  must(courses.every(c=>c.lessons.length===4),'Every Technician I Course 2-7 public package must resolve four dedicated lessons.');
  must(courses.filter(c=>c.number<7).every(c=>c.assessments.length===2),'Courses 2-6 require formative and summative public learning assessments.');
  must(courses.find(c=>c.number===7)?.assessments.length===1,'Course 7 requires one public readiness assessment.');
  console.log(JSON.stringify({result:'success',courses:courses.map(c=>({id:c.id,route:c.route,lessons:c.lessons.length,assessments:c.assessments.length,items:c.itemCount}))},null,2));
  process.exit(0);
}
if(!apply){ console.log('Validation passed. Set APPLY_TECH1_PUBLIC_COURSES=true to publish.'); process.exit(0); }

let program=await findPage(config.program.slug,null);
if(!program){
  const hub=await findPage('learning-hub',null); must(hub,'Learning Hub parent page not found.');
  program=await upsertPage({slug:config.program.slug,title:config.program.title,parent:hub.id,content:shell(`<header class="t1c-hero"><span class="t1c-k">Professional training pathway</span><h1>${esc(config.program.title)}</h1><p>Seven-course public academic training pathway. Professional credential issuance remains separate and restricted.</p></header>`)});
}
const published=[];
for(const course of courses){
  const root=await upsertPage({slug:course.slug,title:`Course ${course.number} — ${course.course.title}`,parent:program.id,content:renderIndex(course),excerpt:course.course.description});
  for(let i=0;i<course.lessons.length;i++) await upsertPage({slug:`lesson-${String(i+1).padStart(2,'0')}`,title:`Course ${course.number} Lesson ${i+1} — ${course.lessons[i].title}`,parent:root.id,content:renderLesson(course,course.lessons[i],i)});
  for(const assessment of course.assessments){
    const isFinal=assessment.purpose==='summative';
    const slug=isFinal?'course-assessment':(course.number===7?'readiness-check':'knowledge-check');
    const label=isFinal?'Course assessment':(course.number===7?'Readiness check':'Knowledge check');
    await upsertPage({slug,title:`Course ${course.number} ${label} — ${assessment.title}`,parent:root.id,content:renderAssessment(course,assessment,label)});
  }
  published.push({courseId:course.id,pageId:root.id,route:course.route,lessons:course.lessons.length,assessments:course.assessments.length,items:course.itemCount});
}
await mkdir(backupRoot,{recursive:true});
await writeFile(join(backupRoot,'publication-result.json'),JSON.stringify({publishedAt:new Date().toISOString(),published},null,2));
console.log(JSON.stringify({result:'success',published},null,2));
