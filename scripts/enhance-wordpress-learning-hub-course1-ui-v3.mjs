import { readFile } from 'node:fs/promises';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_LEARNING_HUB_COURSE1 || '').toLowerCase() === 'true';
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const packagePath = process.env.LEARNING_HUB_COURSE1_PATH || 'site/wordpress/education/learning-hub-course1.json';
const uiPath = process.env.LEARNING_HUB_COURSE1_UI_PATH || 'site/wordpress/education/learning-hub-course1-ui-v3.json';
const local = JSON.parse(await readFile(packagePath, 'utf8'));
const ui = JSON.parse(await readFile(uiPath, 'utf8'));
const rawBase = `https://raw.githubusercontent.com/${local.source.repository}/${encodeURIComponent(local.source.ref || 'main')}`;
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const must = (value, message) => { if (!value) throw new Error(message); };
const esc = (value='') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

must(local.id === 'learning-hub-course1' && local.course.id === 'COURSE-LH-TECH1-001', 'Unexpected Course 1 package.');
must(ui.id === 'learning-hub-course1-ui-v3' && ui.courseId === local.course.id, 'Unexpected Course 1 UI map.');
must(Array.isArray(ui.lessons) && ui.lessons.length === 18, 'Course 1 UI requires 18 lesson definitions.');
for (let i=0;i<ui.lessons.length;i++) {
  const v=ui.lessons[i];
  must(v.id === `LESSON-LH-TECH1-001-${String(i+1).padStart(2,'0')}`, `Unexpected lesson ID at position ${i+1}.`);
  must(v.visual?.purpose && v.visual?.brief && v.visual?.alt, `${v.id}: instructional visual metadata required.`);
  if (v.visual.status === 'approved') must(/^https:\/\//.test(v.visual.src || ''), `${v.id}: approved visual must have an HTTPS source.`);
}
if (validateOnly) {
  console.log(JSON.stringify({result:'success', courseId:local.course.id, lessons:ui.lessons.length, approvedVisuals:ui.lessons.filter(x=>x.visual.status==='approved').length}, null, 2));
  process.exit(0);
}
must(apply, 'APPLY_LEARNING_HUB_COURSE1=true is required.');
must(user && pass, 'WordPress credentials are required.');

async function fetchText(url) {
  let last;
  for (let attempt=1; attempt<=5; attempt++) {
    try {
      const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'DTF-Learning-Hub-Course1-UI/3.0'}});
      if(r.ok) return r.text();
      last=new Error(`${url} returned ${r.status}`);
    } catch(error){ last=error; }
    await sleep(attempt*600);
  }
  throw last;
}
async function fetchJson(rel){ return JSON.parse(await fetchText(`${rawBase}/${rel}`)); }
async function fetchLearner(rel){ return fetchText(`${rawBase}/${local.source.basePath}/${rel}`); }

async function wp(path, options={}) {
  const r=await fetch(`${site}/wp-json/wp/v2/${path}`,{
    ...options,
    signal:AbortSignal.timeout(30000),
    headers:{'Authorization':auth,'Content-Type':'application/json','User-Agent':'DTF-Learning-Hub-Course1-UI/3.0',...(options.headers||{})}
  });
  const text=await r.text();
  if(!r.ok) throw new Error(`WordPress ${path} returned ${r.status}: ${text.slice(0,400)}`);
  return text ? JSON.parse(text) : null;
}
async function findPage(slug,parent){
  const rows=await wp(`pages?slug=${encodeURIComponent(slug)}&parent=${parent}&context=edit&per_page=100`);
  return rows[0] || null;
}
async function upsertPage({slug,title,parent,content}){
  const existing=await findPage(slug,parent);
  const body=JSON.stringify({slug,title,parent,status:'publish',content});
  if(existing) return wp(`pages/${existing.id}`,{method:'POST',body});
  return wp('pages',{method:'POST',body});
}

function inline(text=''){
  return esc(text)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>');
}
function markdownToHtml(markdown){
  const lines=String(markdown).replace(/\r\n/g,'\n').split('\n');
  const out=[]; let paragraph=[]; let list=''; let table=[];
  const flushP=()=>{if(paragraph.length){out.push(`<p>${inline(paragraph.join(' '))}</p>`);paragraph=[];}};
  const flushL=()=>{if(list){out.push(`</${list}>`);list='';}};
  const flushT=()=>{if(!table.length)return;const rows=table.filter((r,i)=>!(i===1&&r.every(c=>/^:?-{3,}:?$/.test(c.trim()))));if(rows.length){out.push('<div class="lhv3-table"><table><thead><tr>'+rows[0].map(c=>`<th scope="col">${inline(c.trim())}</th>`).join('')+'</tr></thead><tbody>');for(const r of rows.slice(1))out.push('<tr>'+r.map(c=>`<td>${inline(c.trim())}</td>`).join('')+'</tr>');out.push('</tbody></table></div>');}table=[];};
  const flush=()=>{flushP();flushL();flushT();};
  for(const raw of lines){
    const line=raw.trim();
    if(line.startsWith('|')&&line.endsWith('|')){flushP();flushL();table.push(line.slice(1,-1).split('|'));continue;}
    if(table.length)flushT();
    if(!line){flushP();flushL();continue;}
    if(/^---+$/.test(line)){flush();out.push('<hr>');continue;}
    const h=line.match(/^(#{1,6})\s+(.+)$/);if(h){flush();const n=Math.min(5,Math.max(2,h[1].length));const id=h[2].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');out.push(`<h${n} id="${esc(id)}">${inline(h[2])}</h${n}>`);continue;}
    const ul=line.match(/^[-*]\s+(.+)$/);if(ul){flushP();if(list!=='ul'){flushL();list='ul';out.push('<ul>');}out.push(`<li>${inline(ul[1])}</li>`);continue;}
    const ol=line.match(/^\d+[.)]\s+(.+)$/);if(ol){flushP();if(list!=='ol'){flushL();list='ol';out.push('<ol>');}out.push(`<li>${inline(ol[1])}</li>`);continue;}
    if(line.startsWith('>')){flush();out.push(`<blockquote>${inline(line.replace(/^>\s?/,''))}</blockquote>`);continue;}
    paragraph.push(line);
  }
  flush();return out.join('\n');
}
function parseModule(markdown,moduleNumber){
  const text=String(markdown).replace(/\r\n/g,'\n');
  const re=/^## Lesson\s+(\d+\.\d+)\s+—\s+(.+)$/gm;
  const matches=[...text.matchAll(re)];
  must(matches.length===3,`Module ${moduleNumber} must contain exactly three lesson headings.`);
  let intro=text.slice(0,matches[0].index).replace(/^# .+\n?/,'').replace(/^---+$/gm,'').trim();
  let disclosure='';
  const disclosureMatch=text.match(/\n## Source disclosure\n([\s\S]*)$/);
  const contentEnd=disclosureMatch ? disclosureMatch.index : text.length;
  if(disclosureMatch) disclosure=disclosureMatch[1].trim();
  const lessons=matches.map((m,i)=>{
    const start=m.index+m[0].length;
    const next=matches[i+1]?.index ?? contentEnd;
    const body=text.slice(start,next).replace(/^---+$/gm,'').trim();
    return {number:m[1],title:m[2].trim(),body};
  });
  return {intro,disclosure,lessons};
}
function sectionLinks(body){
  return [...String(body).matchAll(/^###\s+(.+)$/gm)].map(m=>({title:m[1].trim(),id:m[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}));
}

const css=`<style id="dtf-learning-hub-course1-ui-v3">
.lhv3{--ink:#17251c;--muted:#5b6b60;--green:#1e6339;--deep:#0d2a19;--cream:#f6f3e8;--paper:#fff;--gold:#b88b37;--line:#d8e1d9;--soft:#eef4ef;background:#f7f8f4;color:var(--ink);padding:24px 0 72px;font-family:inherit}.lhv3 *{box-sizing:border-box}.lhv3 a{color:#145f34;font-weight:800}.lhv3-wrap{width:min(1280px,calc(100% - 28px));margin:auto}.lhv3-crumb{display:flex;gap:8px;flex-wrap:wrap;font-size:.9rem;margin:4px 0 18px}.lhv3-crumb a{text-decoration:none}.lhv3-hero{background:linear-gradient(135deg,#102b1b,#193d28);color:#fff;border-radius:22px;padding:clamp(24px,5vw,52px);margin-bottom:20px}.lhv3-hero p{color:#dce7df;max-width:800px}.lhv3-kicker{font-size:.76rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase;color:#9fd3ad}.lhv3-hero h1{font-size:clamp(2rem,5vw,4rem);line-height:1.03;letter-spacing:-.04em;margin:.25em 0}.lhv3-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.lhv3-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);font-weight:750;font-size:.9rem}.lhv3-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:24px;align-items:start}.lhv3-main{min-width:0}.lhv3-sidebar{position:sticky;top:18px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px}.lhv3-sidebar h2{font-size:1rem;margin:0 0 10px}.lhv3-outline{list-style:none;padding:0;margin:0}.lhv3-outline li{margin:4px 0}.lhv3-outline a{display:block;padding:8px 10px;border-radius:10px;text-decoration:none;font-size:.92rem;color:#294033}.lhv3-outline a[aria-current="page"]{background:#e3efe6;color:#0c532b}.lhv3-outline .module{font-weight:900;margin-top:8px}.lhv3-outline .lesson{padding-left:20px}.lhv3-progress{height:8px;background:#dfe8e1;border-radius:999px;overflow:hidden;margin:12px 0}.lhv3-progress>span{display:block;height:100%;background:linear-gradient(90deg,#1b6c3b,#8cb76d)}.lhv3-card,.lhv3-content,.lhv3-objective,.lhv3-toc,.lhv3-callout{background:#fff;border:1px solid var(--line);border-radius:18px}.lhv3-content{padding:clamp(22px,4vw,46px)}.lhv3-content h2{font-size:1.75rem;margin-top:1.7em}.lhv3-content h3{font-size:1.28rem;margin-top:1.65em;color:#153d25}.lhv3-content p,.lhv3-content li{line-height:1.76}.lhv3-content p{color:#3e5145}.lhv3-content li+li{margin-top:5px}.lhv3-content hr{border:0;border-top:1px solid var(--line);margin:30px 0}.lhv3-content blockquote{margin:22px 0;padding:16px 18px;border-left:5px solid var(--gold);background:#fff8e6;border-radius:10px}.lhv3-objective{padding:18px 20px;margin-bottom:16px;border-left:5px solid #2a7947}.lhv3-objective strong{display:block;color:#145d33;margin-bottom:5px}.lhv3-toc{padding:16px 20px;margin:0 0 16px}.lhv3-toc ul{margin:8px 0 0;padding-left:20px}.lhv3-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.lhv3-card{padding:20px}.lhv3-card h3{margin:.25em 0 .5em}.lhv3-card p{color:var(--muted);line-height:1.6}.lhv3-lesson-list{display:grid;gap:12px}.lhv3-lesson-row{display:grid;grid-template-columns:72px 1fr auto;gap:14px;align-items:center;padding:16px;background:#fff;border:1px solid var(--line);border-radius:16px}.lhv3-lesson-num{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;background:#e6f0e8;color:#185c34;font-weight:950}.lhv3-lesson-row h3{margin:0}.lhv3-lesson-row p{margin:4px 0;color:var(--muted)}.lhv3-visual{margin:20px 0;background:#0f1f16;border-radius:18px;overflow:hidden;color:white}.lhv3-visual img{display:block;width:100%;height:auto;max-height:620px;object-fit:cover}.lhv3-visual figcaption{padding:14px 16px;color:#e5ece7;line-height:1.55}.lhv3-callout{padding:18px 20px;margin:18px 0;background:#f8fbf8}.lhv3-actions{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.lhv3-button{display:inline-block;padding:11px 15px;border-radius:12px;text-decoration:none;background:#155f35!important;color:#fff!important}.lhv3-button.secondary{background:#fff!important;color:#155f35!important;border:1px solid #aac4b2}.lhv3-nextprev{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}.lhv3-nextprev a{padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;text-decoration:none}.lhv3-nextprev a:last-child{text-align:right}.lhv3-complete{border:0;background:#183d29;color:#fff;font-weight:900;padding:11px 15px;border-radius:12px;cursor:pointer}.lhv3-complete[data-complete="true"]{background:#dfece2;color:#145830}.lhv3-table{overflow-x:auto}.lhv3 table{width:100%;border-collapse:collapse;min-width:620px}.lhv3 th,.lhv3 td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}.lhv3 th{background:#eff5f0}.lhv3-mobile-outline{display:none}.lhv3-footer{margin-top:28px;padding:24px;background:#102b1b;color:white;border-radius:18px}.lhv3-footer p{color:#d9e5dc}.lhv3 :focus-visible{outline:3px solid #155f9b;outline-offset:3px}
@media(max-width:950px){.lhv3-layout{grid-template-columns:1fr}.lhv3-sidebar{display:none}.lhv3-mobile-outline{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:16px}.lhv3-grid{grid-template-columns:1fr}.lhv3-lesson-row{grid-template-columns:58px 1fr}.lhv3-lesson-row>a{grid-column:2}.lhv3-nextprev{grid-template-columns:1fr}.lhv3-nextprev a:last-child{text-align:left}}
@media print{.lhv3-sidebar,.lhv3-mobile-outline,.lhv3-complete,.lhv3-nextprev{display:none}.lhv3{background:#fff;padding:0}.lhv3-layout{display:block}}
</style>`;
const script=`<script id="dtf-learning-hub-course1-progress">(()=>{const course='COURSE-LH-TECH1-001';const key='dtf-course-progress-'+course;const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return{}}};const write=v=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{}};const state=read();document.querySelectorAll('[data-lesson-complete]').forEach(btn=>{const id=btn.getAttribute('data-lesson-complete');const sync=()=>{const done=!!state[id];btn.dataset.complete=String(done);btn.textContent=done?'✓ Lesson completed':'Mark lesson complete';};sync();btn.addEventListener('click',()=>{state[id]=!state[id];write(state);sync();update();});});function update(){const done=Object.values(state).filter(Boolean).length;document.querySelectorAll('[data-course-progress]').forEach(el=>{const p=Math.min(100,Math.round(done/18*100));el.setAttribute('aria-valuenow',String(p));const fill=el.querySelector('span');if(fill)fill.style.width=p+'%';});document.querySelectorAll('[data-course-progress-text]').forEach(el=>el.textContent=done+' of 18 lessons marked complete');}update();})();</script>`;
function shell(body){return `${css}<main class="lhv3"><div class="lhv3-wrap">${body}<footer class="lhv3-footer"><strong>THC Learning Hub</strong><p>Use the course sequence, workbook activities, practical, and course tests together. Course learning assessments are separate from the secure certification examination.</p><p><a style="color:#cce7d3" href="${esc(local.course.route)}">Course 1 home</a> · <a style="color:#cce7d3" href="${esc(local.program.route)}">Technician I path</a> · <a style="color:#cce7d3" href="/learn/learning-hub/">Learning Hub</a></p></footer></div></main>${script}`;}
function crumb(extra=''){return `<nav class="lhv3-crumb" aria-label="Breadcrumb"><a href="/learn/">Learn</a><span>›</span><a href="/learn/learning-hub/">Learning Hub</a><span>›</span><a href="${esc(local.program.route)}">Technician I</a>${extra}</nav>`;}
function outline(currentId,lessonRows){
  const modules=local.modules.map(m=>{const ls=lessonRows.filter(x=>x.module===m.number);return `<li class="module"><a href="${esc(local.course.route+m.slug+'/')}">${m.number}. ${esc(m.title)}</a></li>${ls.map(l=>`<li class="lesson"><a ${l.id===currentId?'aria-current="page"':''} href="${esc(l.route)}">${esc(l.lesson)} ${esc(l.title)}</a></li>`).join('')}`;}).join('');
  return `<h2>Course outline</h2><div class="lhv3-progress" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-course-progress><span style="width:0%"></span></div><p style="font-size:.85rem;color:#5b6b60" data-course-progress-text>0 of 18 lessons marked complete</p><ol class="lhv3-outline">${modules}</ol>`;
}
function mobileOutline(currentId,lessonRows){return `<details class="lhv3-mobile-outline"><summary><strong>Course outline & progress</strong></summary>${outline(currentId,lessonRows)}</details>`;}
function renderVisual(v){if(v?.status!=='approved'||!v.src)return'';return `<figure class="lhv3-visual"><img src="${esc(v.src)}" alt="${esc(v.alt)}" loading="lazy" decoding="async"><figcaption>${esc(v.caption||v.purpose)}</figcaption></figure>`;}

const moduleSources=[];
for(const m of local.modules){const md=await fetchLearner(m.source);moduleSources.push({...m,...parseModule(md,m.number)});}
const lessonRows=[];
for(let i=0;i<ui.lessons.length;i++){
  const def=ui.lessons[i];const mod=moduleSources.find(m=>m.number===def.module);const parsed=mod.lessons[(i)%3];
  must(parsed && parsed.number===def.lesson,`${def.id}: lesson heading mismatch.`);
  const obj=await fetchJson(`content/lessons/${def.id}.json`);
  const objectives=[];for(const oid of obj.learningObjectives||[]){const o=await fetchJson(`content/learning-objectives/${oid}.json`);objectives.push(o.statement);}
  lessonRows.push({...def,title:parsed.title,body:parsed.body,html:markdownToHtml(parsed.body),estimatedMinutes:obj.estimatedMinutes||30,objectives,sections:sectionLinks(parsed.body),route:`${local.course.route}${mod.slug}/${def.slug}/`});
}

const hub=await findPage('learning-hub',869);must(hub,'Learning Hub page not found.');
const program=await findPage(local.program.slug,hub.id);must(program,'Technician I page not found.');
const course=await findPage(local.course.slug,program.id);must(course,'Course 1 page not found.');

function coursePage(){
  const moduleCards=moduleSources.map(m=>{const rows=lessonRows.filter(l=>l.module===m.number);const minutes=rows.reduce((a,b)=>a+b.estimatedMinutes,0);return `<article class="lhv3-card"><span class="lhv3-kicker" style="color:#39724d">Module ${m.number}</span><h3>${esc(m.title)}</h3><p>${rows.length} lessons · about ${minutes} minutes of core reading and practice</p><ul>${rows.map(l=>`<li><a href="${esc(l.route)}">${esc(l.lesson)} ${esc(l.title)}</a></li>`).join('')}</ul><div class="lhv3-actions"><a class="lhv3-button" href="${esc(local.course.route+m.slug+'/')}">Open module</a><a class="lhv3-button secondary" href="${esc(local.course.route+'test-module-'+m.number+'/')}">Module test</a></div></article>`;}).join('');
  return shell(`${crumb()}<section class="lhv3-hero"><span class="lhv3-kicker">THC Cultivation Technician I · Course 1</span><h1>${esc(local.course.title)}</h1><p>${esc(local.course.purpose)}</p><div class="lhv3-meta"><span class="lhv3-pill">18 lessons</span><span class="lhv3-pill">6 modules</span><span class="lhv3-pill">108 course-test items</span><span class="lhv3-pill">Integrated practical</span></div></section><section class="lhv3-callout"><h2 style="margin-top:0">How to use this course</h2><p>Work through one lesson at a time. Each lesson states what you should be able to do, teaches the decision model, gives examples and practice, and links forward to the next lesson. Complete the module test after all three lessons in a module.</p></section><h2>Course map</h2><div class="lhv3-grid">${moduleCards}</div><section class="lhv3-content" style="margin-top:18px"><h2>Applied work</h2><p>The course is not complete as reading alone. Use the workbook and templates while you move through the lessons, then complete the integrated practical before the final course test.</p><div class="lhv3-actions"><a class="lhv3-button" href="${esc(local.course.route+'workbook/')}">Student workbook</a><a class="lhv3-button secondary" href="${esc(local.course.route+'workbook-templates/')}">Workbook templates</a><a class="lhv3-button secondary" href="${esc(local.course.route+'integrated-practical/')}">Integrated practical</a></div><h2>Final course test</h2><p>After Modules 1–6, complete the 36-item final course test and review every missed rationale before moving forward in the Technician I pathway.</p><a class="lhv3-button" href="${esc(local.course.route+'final-course-test/')}">Open final course test</a></section>`);
}
await wp(`pages/${course.id}`,{method:'POST',body:JSON.stringify({content:coursePage(),title:local.course.title,status:'publish'})});

const created=[];
for(const mod of moduleSources){
  const modulePage=await findPage(mod.slug,course.id);must(modulePage,`Module page missing: ${mod.slug}`);
  const rows=lessonRows.filter(l=>l.module===mod.number);
  const cards=rows.map(l=>`<article class="lhv3-lesson-row"><div class="lhv3-lesson-num">${esc(l.lesson)}</div><div><h3>${esc(l.title)}</h3><p>${esc(l.objectives[0]||'Apply the lesson decision model in routine cultivation work.')}</p><p><strong>${l.estimatedMinutes} min</strong></p></div><a class="lhv3-button" href="${esc(l.route)}">Start lesson</a></article>`).join('');
  const intro=markdownToHtml(mod.intro);
  const content=shell(`${crumb(`<span>›</span><a href="${esc(local.course.route)}">Course 1</a>`)}${mobileOutline('',lessonRows)}<section class="lhv3-hero"><span class="lhv3-kicker">Course 1 · Module ${mod.number} of 6</span><h1>${esc(mod.title)}</h1><p>Three focused lessons move from the underlying decision model into worked examples, guided practice, and the module learning test.</p></section><div class="lhv3-layout"><section class="lhv3-main"><article class="lhv3-content">${intro}</article><h2>Lessons in this module</h2><div class="lhv3-lesson-list">${cards}</div><section class="lhv3-callout"><h2 style="margin-top:0">After the three lessons</h2><p>Complete the module test, review missed rationales, and record the related workbook activity before continuing.</p><a class="lhv3-button" href="${esc(local.course.route+'test-module-'+mod.number+'/')}">Take Module ${mod.number} test</a></section></section><aside class="lhv3-sidebar">${outline('',lessonRows)}</aside></div>`);
  await wp(`pages/${modulePage.id}`,{method:'POST',body:JSON.stringify({content,title:mod.title,status:'publish'})});

  for(const row of rows){
    const globalIndex=lessonRows.findIndex(x=>x.id===row.id);
    const prev=lessonRows[globalIndex-1];const next=lessonRows[globalIndex+1];
    const toc=row.sections.length?`<nav class="lhv3-toc" aria-label="On this page"><strong>On this page</strong><ul>${row.sections.map(s=>`<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`).join('')}</ul></nav>`:'';
    const objective=row.objectives.length?`<section class="lhv3-objective"><strong>Learning objective</strong>${row.objectives.map(o=>`<p>${esc(o)}</p>`).join('')}</section>`:'';
    const visual=renderVisual(row.visual);
    const nextPrev=`<nav class="lhv3-nextprev" aria-label="Lesson navigation">${prev?`<a href="${esc(prev.route)}"><small>Previous</small><br><strong>${esc(prev.lesson)} ${esc(prev.title)}</strong></a>`:'<span></span>'}${next?`<a href="${esc(next.route)}"><small>Next</small><br><strong>${esc(next.lesson)} ${esc(next.title)}</strong></a>`:`<a href="${esc(local.course.route+'test-module-'+mod.number+'/')}"><small>Next</small><br><strong>Module ${mod.number} test</strong></a>`}</nav>`;
    const lessonContent=shell(`${crumb(`<span>›</span><a href="${esc(local.course.route)}">Course 1</a><span>›</span><a href="${esc(local.course.route+mod.slug+'/')}">Module ${mod.number}</a>`)}${mobileOutline(row.id,lessonRows)}<section class="lhv3-hero"><span class="lhv3-kicker">Module ${mod.number} · Lesson ${row.lesson} · ${globalIndex+1} of 18</span><h1>${esc(row.title)}</h1><p>${esc(row.objectives[0]||'Build a reliable cultivation decision habit from evidence, procedure, and role boundaries.')}</p><div class="lhv3-meta"><span class="lhv3-pill">${row.estimatedMinutes} min</span><span class="lhv3-pill">Worked examples</span><span class="lhv3-pill">Guided practice</span><span class="lhv3-pill">Retrieval check</span></div></section><div class="lhv3-layout"><section class="lhv3-main">${objective}${toc}${visual}<article class="lhv3-content">${row.html}</article><div class="lhv3-actions"><button class="lhv3-complete" type="button" data-lesson-complete="${esc(row.id)}">Mark lesson complete</button><a class="lhv3-button secondary" href="${esc(local.course.route+'workbook/')}">Open workbook</a></div>${nextPrev}</section><aside class="lhv3-sidebar">${outline(row.id,lessonRows)}</aside></div>`);
    const page=await upsertPage({slug:row.slug,title:`Lesson ${row.lesson} — ${row.title}`,parent:modulePage.id,content:lessonContent});
    created.push({id:page.id,slug:row.slug,module:mod.number,lesson:row.lesson});
  }
}

console.log(JSON.stringify({result:'success',coursePageId:course.id,lessonPages:created.length,created,approvedVisuals:ui.lessons.filter(x=>x.visual.status==='approved').length},null,2));
