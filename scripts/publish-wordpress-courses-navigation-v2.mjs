import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_LEARNING_HUB_COURSE1||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-learning-hub-course1';
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const must=(v,m)=>{if(!v)throw new Error(m);};
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`courses-navigation-v2-${stamp}`);
await mkdir(backupDir,{recursive:true});

const coursesRoute='/courses/';
const courseRoute='/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/';

if(process.argv.includes('--validate-only')){
  console.log(JSON.stringify({result:'success',version:2,coursesRoute,courseRoute,headerModes:['inline-style','dtf-shell-nav']},null,2));
  process.exit(0);
}
must(apply,'APPLY_LEARNING_HUB_COURSE1=true is required.');
must(user&&pass,'WordPress credentials are required.');

async function request(path,options={}){
  const r=await fetch(`${site}${path}`,{
    ...options,
    signal:AbortSignal.timeout(30000),
    headers:{Authorization:auth,Accept:'application/json','Content-Type':'application/json','User-Agent':'DTF-Courses-Navigation/2.0',...(options.headers||{})}
  });
  const text=await r.text();
  if(!r.ok) throw new Error(`${path} returned ${r.status}: ${text.slice(0,500)}`);
  return text?JSON.parse(text):null;
}
async function pageBySlug(slug,parent=0){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&parent=${parent}&context=edit&per_page=100`);
  return rows[0]||null;
}
async function upsertPage(slug,title,content,parent=0){
  const existing=await pageBySlug(slug,parent);
  const body=JSON.stringify({slug,title,content,parent,status:'publish'});
  return existing?request(`/wp-json/wp/v2/pages/${existing.id}`,{method:'POST',body}):request('/wp-json/wp/v2/pages',{method:'POST',body});
}

const page=`<style id="dtf-courses-v3-style">
.dtf-courses{--ink:#112a1a;--muted:#607066;--deep:#07190f;--deep2:#0e2d1c;--green:#227246;--line:rgba(17,42,26,.13);--cream:#f6f2e8;--paper:#fffdf8;--gold:#d6b85f;--shadow:0 20px 54px rgba(17,42,26,.10);background:var(--cream);color:var(--ink);overflow:hidden}.dtf-courses *{box-sizing:border-box}.dtf-courses-wrap{width:min(1220px,calc(100% - 40px));margin:auto}.dtf-courses h1,.dtf-courses h2,.dtf-courses h3,.dtf-courses p{margin-top:0}.dtf-courses-k{margin:0 0 12px;color:var(--gold);font-size:.74rem;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.dtf-courses-hero{position:relative;isolation:isolate;padding:clamp(72px,9vw,118px) 0 80px;background:radial-gradient(circle at 82% 14%,rgba(214,184,95,.23),transparent 27%),radial-gradient(circle at 8% 90%,rgba(58,133,78,.18),transparent 31%),linear-gradient(135deg,var(--deep),var(--deep2));color:#fff}.dtf-courses-hero:after{content:"";position:absolute;z-index:-1;width:430px;height:430px;right:-145px;top:-185px;border:1px solid rgba(255,255,255,.13);border-radius:50%;box-shadow:0 0 0 70px rgba(255,255,255,.024),0 0 0 140px rgba(255,255,255,.014)}.dtf-courses-hero-grid{display:grid;grid-template-columns:minmax(0,1.16fr) minmax(310px,.84fr);gap:clamp(34px,6vw,72px);align-items:center}.dtf-courses-hero h1{max-width:860px;margin:.12em 0 .28em;font-size:clamp(3rem,6.3vw,6rem);line-height:.91;letter-spacing:-.057em;text-wrap:balance}.dtf-courses-hero .lede{max-width:760px;margin:0;color:#d8e5dc;font-size:clamp(1.04rem,1.5vw,1.2rem);line-height:1.75}.dtf-courses-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.dtf-courses-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 18px;border:1px solid rgba(255,255,255,.22);border-radius:13px;background:rgba(255,255,255,.065);color:#fff!important;text-decoration:none!important;font-weight:900}.dtf-courses-btn.primary{background:var(--gold);border-color:var(--gold);color:var(--deep)!important}.dtf-courses-btn.light{background:var(--deep);border-color:var(--deep);color:#fff!important}.dtf-courses-hero-panel{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:25px;background:rgba(255,255,255,.055);backdrop-filter:blur(10px);box-shadow:0 30px 60px rgba(0,0,0,.18)}.dtf-courses-stat{min-height:125px;padding:18px;border-radius:16px;background:rgba(5,20,12,.46);border:1px solid rgba(255,255,255,.08)}.dtf-courses-stat strong{display:block;color:#f0d986;font-size:clamp(1.8rem,3vw,2.7rem);line-height:1}.dtf-courses-stat span{display:block;margin-top:8px;color:#bed0c3;font-size:.88rem;line-height:1.45}.dtf-courses-section{padding:clamp(62px,8vw,100px) 0;border-top:1px solid var(--line)}.dtf-courses-section.soft{background:linear-gradient(180deg,#edf3ec 0%,var(--cream) 100%)}.dtf-courses-heading{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:30px;align-items:end;margin-bottom:32px}.dtf-courses-heading h2{margin:0;font-size:clamp(2.3rem,4.6vw,4.25rem);line-height:.97;letter-spacing:-.052em;text-wrap:balance}.dtf-courses-heading>p{margin:0;color:var(--muted);line-height:1.75}.dtf-courses-program{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:18px}.dtf-courses-feature{position:relative;overflow:hidden;min-height:440px;padding:clamp(28px,4vw,42px);border:1px solid var(--line);border-radius:26px;background:var(--paper);box-shadow:var(--shadow);display:flex;flex-direction:column}.dtf-courses-feature:before{content:"";position:absolute;inset:0 0 auto;height:7px;background:linear-gradient(90deg,var(--green),var(--gold))}.dtf-courses-feature h2{max-width:800px;margin:8px 0 14px;font-size:clamp(2rem,3.3vw,3.25rem);line-height:1.03;letter-spacing:-.04em}.dtf-courses-feature>p{max-width:760px;color:var(--muted);font-size:1.02rem;line-height:1.72}.dtf-courses-meta{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0 6px}.dtf-courses-meta span{padding:8px 11px;border-radius:999px;background:#edf4ee;color:#315841;font-size:.78rem;font-weight:850}.dtf-courses-feature .dtf-courses-actions{margin-top:auto;padding-top:24px}.dtf-courses-route{padding:28px;border-radius:25px;background:linear-gradient(145deg,var(--deep),#153a26);color:#fff}.dtf-courses-route h2{margin-bottom:20px;font-size:1.5rem;letter-spacing:-.03em}.dtf-courses-surface{display:grid;grid-template-columns:42px 1fr;gap:13px;padding:15px 0;border-top:1px solid rgba(255,255,255,.1)}.dtf-courses-surface:first-of-type{border-top:0}.dtf-courses-surface b{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:rgba(214,184,95,.13);color:#ebd27c}.dtf-courses-surface strong{display:block;margin-bottom:3px}.dtf-courses-surface span{display:block;color:#bfd0c4;font-size:.9rem;line-height:1.5}.dtf-courses-map{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;counter-reset:path}.dtf-courses-step{counter-increment:path;min-height:230px;padding:25px;border:1px solid var(--line);border-radius:21px;background:var(--paper);box-shadow:0 9px 28px rgba(17,42,26,.055)}.dtf-courses-step:before{content:counter(path,decimal-leading-zero);display:grid;place-items:center;width:42px;height:42px;margin-bottom:38px;border-radius:12px;background:linear-gradient(180deg,#153f28,var(--deep));color:#efd986;font-weight:950}.dtf-courses-step strong{display:block;margin-bottom:7px;font-size:1.17rem}.dtf-courses-step span{display:block;color:var(--muted);line-height:1.62}.dtf-courses-boundary{display:grid;grid-template-columns:.8fr 1.2fr;gap:26px;align-items:start;padding:32px;border-radius:25px;background:#fff8e6;border:1px solid rgba(196,155,48,.22)}.dtf-courses-boundary h2{margin:0;font-size:clamp(1.8rem,3vw,2.65rem);line-height:1.05;letter-spacing:-.035em}.dtf-courses-boundary p{margin:0;color:#6b613f;line-height:1.72}.dtf-courses :focus-visible{outline:3px solid #1765a1;outline-offset:3px}@media(max-width:900px){.dtf-courses-hero-grid,.dtf-courses-heading,.dtf-courses-program,.dtf-courses-boundary{grid-template-columns:1fr}.dtf-courses-map{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.dtf-courses-wrap{width:min(100% - 28px,1220px)}.dtf-courses-hero{padding:56px 0 62px}.dtf-courses-hero h1{font-size:clamp(2.65rem,14vw,4.2rem)}.dtf-courses-hero-panel,.dtf-courses-map{grid-template-columns:1fr}.dtf-courses-stat{min-height:0}.dtf-courses-feature{min-height:0}.dtf-courses-actions{display:grid;grid-template-columns:1fr}.dtf-courses-btn{width:100%}.dtf-courses-step{min-height:0}.dtf-courses-step:before{margin-bottom:20px}}
</style><main class="dtf-courses" data-dtf-layout="courses-visual-v3"><section class="dtf-courses-hero"><div class="dtf-courses-wrap dtf-courses-hero-grid"><div><p class="dtf-courses-k">THC Learning Hub</p><h1>Professional cultivation courses</h1><p class="lede">Structured certification learning paths built from researched instruction, guided practice, job tasks, course tests, and applied practical work. Use Learn for the comprehensive resource library; use Courses when you want a step-by-step credential pathway.</p><div class="dtf-courses-actions"><a class="dtf-courses-btn primary" href="${courseRoute}">Start Course 1</a><a class="dtf-courses-btn" href="/learn/learning-hub/">Open Learning Hub</a></div></div><aside class="dtf-courses-hero-panel" aria-label="Course 1 overview"><div class="dtf-courses-stat"><strong>6</strong><span>modules organized around real technician decisions</span></div><div class="dtf-courses-stat"><strong>18</strong><span>focused lessons in the first public course</span></div><div class="dtf-courses-stat"><strong>6</strong><span>module tests supporting retrieval and review</span></div><div class="dtf-courses-stat"><strong>36</strong><span>items in the final Course 1 learning assessment</span></div></aside></div></section><section class="dtf-courses-section"><div class="dtf-courses-wrap"><div class="dtf-courses-heading"><div><p class="dtf-courses-k" style="color:#39734f">Available pathway</p><h2>Start with the work habits that protect people, plants, records, and decisions.</h2></div><p>Course 1 is the current public entry point. It teaches the controlled-work habits a cultivation technician needs before later technical subjects become useful.</p></div><div class="dtf-courses-program"><article class="dtf-courses-feature"><p class="dtf-courses-k" style="color:#47755a">Course 1 · Technician I</p><h2>Safety, Responsible Practice &amp; Cultivation Workflows</h2><p>Build the workplace decision habits expected of a cultivation technician: hazard recognition, biosecurity, controlled instructions, traceability, equipment boundaries, trustworthy records, and professional shift handoff.</p><div class="dtf-courses-meta"><span>6 modules</span><span>18 focused lessons</span><span>6 module tests</span><span>36-item final course test</span><span>Workbook + integrated practical</span></div><div class="dtf-courses-actions"><a class="dtf-courses-btn light" href="${courseRoute}">Open Course 1 →</a></div></article><aside class="dtf-courses-route"><p class="dtf-courses-k">Choose the right surface</p><h2>Library, course, and credential are different layers.</h2><div class="dtf-courses-surface"><b>01</b><span><strong>Learn</strong>Broad education library and 420-resource system.</span></div><div class="dtf-courses-surface"><b>02</b><span><strong>Courses</strong>Sequenced professional learning with practice and assessment.</span></div><div class="dtf-courses-surface"><b>03</b><span><strong>Certification</strong>Separate secure assessment and credential-governance controls.</span></div></aside></div></div></section><section class="dtf-courses-section soft"><div class="dtf-courses-wrap"><div class="dtf-courses-heading"><div><p class="dtf-courses-k" style="color:#39734f">Learning rhythm</p><h2>Every course follows a repeatable path.</h2></div><p>Orientation, instruction, practice, and assessment are visually separated so learners always know what kind of work they are doing next.</p></div><div class="dtf-courses-map"><div class="dtf-courses-step"><strong>Orient</strong><span>Know the objective, relevance, prerequisites, and position in the course.</span></div><div class="dtf-courses-step"><strong>Learn</strong><span>Use researched explanations, controlled terminology, and approved teaching visuals.</span></div><div class="dtf-courses-step"><strong>Practice</strong><span>Work cases, retrieval checks, workbook tasks, and practical decisions.</span></div><div class="dtf-courses-step"><strong>Assess</strong><span>Use module tests and the final course test before progressing.</span></div></div></div></section><section class="dtf-courses-section"><div class="dtf-courses-wrap"><div class="dtf-courses-boundary"><h2>Learning assessment is not credential issuance.</h2><p><strong>Course tests are learning assessments.</strong> They are separate from the secure professional certification examination. Public course access does not by itself issue a professional credential; certification remains governed by its own validation, assessment, and credential controls.</p></div></div></section></main>`;

const courses=await upsertPage('courses','Courses',page,0);
await writeFile(join(backupDir,'courses-page.json'),`${JSON.stringify(courses,null,2)}\n`);

const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const header=(parts||[]).find(p=>p.theme==='hostinger-ai-theme'&&p.slug==='header');
must(header?.id,'Active Hostinger header template part is missing.');
let content=rendered(header.content);
await writeFile(join(backupDir,'header-before.html'),content);

if(!/href=["']\/courses\/["']/.test(content)){
  const learnAnchor=/<a\b([^>]*?)href=["']\/learn\/["']([^>]*)>\s*Learn\s*<\/a>/i;
  const match=content.match(learnAnchor);
  must(match,'Primary Learn header link not found in either supported header shell.');
  const anchor=match[0];
  let courseAnchor;
  const styleMatch=anchor.match(/style=["']([^"']*)["']/i);
  if(styleMatch){
    courseAnchor=`<a class="dtf-courses-nav-link" href="/courses/" style="${styleMatch[1]}">Courses</a>`;
  }else{
    courseAnchor='<a class="dtf-courses-nav-link" href="/courses/">Courses</a>';
  }
  content=content.replace(learnAnchor,`${anchor}${courseAnchor}`);
}

const markerStart='<!-- dtf-courses-nav-v2:start -->';
const markerEnd='<!-- dtf-courses-nav-v2:end -->';
content=content.replace(/<!-- dtf-courses-nav-v1:start -->[\s\S]*?<!-- dtf-courses-nav-v1:end -->/g,'');
content=content.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`,'g'),'').trim();
const behavior=`${markerStart}<!-- wp:html --><style id="dtf-courses-nav-v2-style">header nav[aria-label="Primary navigation"] a.dtf-courses-nav-link.is-active,.dtf-shell-nav a.dtf-courses-nav-link.is-active{background:rgba(214,183,92,.14)!important;color:#f0d57a!important;box-shadow:inset 0 0 0 1px rgba(214,183,92,.28);border-radius:10px}</style><script id="dtf-courses-nav-v2-script">(function(){function sync(){var p=location.pathname||'/';document.querySelectorAll('header nav[aria-label="Primary navigation"] a,.dtf-shell-nav a').forEach(function(a){var href=a.getAttribute('href')||'';if(href==='/courses/'){var on=p==='/courses/'||p.indexOf('/learn/learning-hub/')===0;a.classList.toggle('is-active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}if(href==='/learn/'&&p.indexOf('/learn/learning-hub/')===0){a.classList.remove('is-active');a.removeAttribute('aria-current');}});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();})();</script><!-- /wp:html -->${markerEnd}`;
content=`${content}\n${behavior}`;
await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(header.id)}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
await writeFile(join(backupDir,'header-after.html'),content);

const afterParts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const headerAfter=rendered((afterParts||[]).find(p=>p.theme==='hostinger-ai-theme'&&p.slug==='header')?.content);
must(/href=["']\/courses\/["']/.test(headerAfter),'Courses link missing from shared header after write.');
must(headerAfter.includes('dtf-courses-nav-v2-script'),'Courses navigation behavior missing after write.');
const coursesAfter=await pageBySlug('courses',0);
must(coursesAfter?.status==='publish','Courses page not published.');
console.log(JSON.stringify({result:'success',version:2,coursesPageId:coursesAfter.id,coursesRoute,headerLink:true,targetCourse:courseRoute},null,2));
