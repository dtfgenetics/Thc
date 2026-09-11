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
const backupDir=join(backupRoot,`courses-navigation-v1-${stamp}`);
await mkdir(backupDir,{recursive:true});

if(process.argv.includes('--validate-only')){
  console.log(JSON.stringify({result:'success',route:'/courses/',headerLabel:'Courses',target:'/learn/learning-hub/'},null,2));
  process.exit(0);
}
must(apply,'APPLY_LEARNING_HUB_COURSE1=true is required.');
must(user&&pass,'WordPress credentials are required.');

async function request(path,options={}){
  const r=await fetch(`${site}${path}`,{...options,signal:AbortSignal.timeout(30000),headers:{Authorization:auth,Accept:'application/json','Content-Type':'application/json','User-Agent':'DTF-Courses-Navigation/1.0',...(options.headers||{})}});
  const text=await r.text();if(!r.ok)throw new Error(`${path} returned ${r.status}: ${text.slice(0,400)}`);return text?JSON.parse(text):null;
}
async function pageBySlug(slug,parent=0){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&parent=${parent}&context=edit&per_page=100`);return rows[0]||null;}
async function upsertPage(slug,title,content,parent=0){const existing=await pageBySlug(slug,parent);const body=JSON.stringify({slug,title,content,parent,status:'publish'});return existing?request(`/wp-json/wp/v2/pages/${existing.id}`,{method:'POST',body}):request('/wp-json/wp/v2/pages',{method:'POST',body});}

const page=`<style id="dtf-courses-v1-style">
.dtf-courses{--ink:#17271c;--muted:#5a6a5f;--deep:#0b2818;--green:#1d6639;--line:#d8e2da;--cream:#f7f5ee;--gold:#cfad54;background:var(--cream);color:var(--ink);padding:38px 0 78px}.dtf-courses *{box-sizing:border-box}.dtf-courses-wrap{width:min(1180px,calc(100% - 30px));margin:auto}.dtf-courses-hero{padding:clamp(28px,6vw,64px);border-radius:24px;background:linear-gradient(135deg,#0b2818,#17432b);color:#fff}.dtf-courses-hero h1{font-size:clamp(2.5rem,6vw,5rem);line-height:.98;letter-spacing:-.05em;margin:.15em 0}.dtf-courses-hero p{max-width:780px;color:#dbe8df;line-height:1.72}.dtf-courses-k{font-size:.78rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase;color:#d7c06d}.dtf-courses-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:18px;margin-top:20px}.dtf-courses-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px}.dtf-courses-card h2,.dtf-courses-card h3{margin-top:0}.dtf-courses-card p,.dtf-courses-card li{line-height:1.7;color:var(--muted)}.dtf-courses-map{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.dtf-courses-step{padding:16px;background:#fff;border:1px solid var(--line);border-radius:16px}.dtf-courses-step strong{display:block;color:#195e35;margin-bottom:5px}.dtf-courses-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.dtf-courses-btn{display:inline-block;padding:12px 16px;border-radius:12px;background:#176237;color:white!important;text-decoration:none!important;font-weight:900}.dtf-courses-btn.secondary{background:white;color:#176237!important;border:1px solid #a9c7b2}.dtf-courses-note{border-left:5px solid var(--gold);background:#fff8e6;padding:16px 18px;border-radius:10px;margin-top:18px}.dtf-courses :focus-visible{outline:3px solid #1765a1;outline-offset:3px}@media(max-width:820px){.dtf-courses-grid,.dtf-courses-map{grid-template-columns:1fr}}
</style><main class="dtf-courses"><div class="dtf-courses-wrap"><section class="dtf-courses-hero"><span class="dtf-courses-k">THC Learning Hub</span><h1>Professional cultivation courses</h1><p>Structured certification learning paths built from researched instruction, guided practice, job tasks, course tests, and applied practical work. Use Learn for the comprehensive resource library; use Courses when you want a step-by-step credential pathway.</p><div class="dtf-courses-actions"><a class="dtf-courses-btn" href="/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/">Start Course 1</a><a class="dtf-courses-btn secondary" href="/learn/learning-hub/">Open Learning Hub</a></div></section><div class="dtf-courses-grid"><article class="dtf-courses-card"><span class="dtf-courses-k" style="color:#50785f">Available course</span><h2>Course 1 — Safety, Responsible Practice &amp; Cultivation Workflows</h2><p>Build the workplace decision habits expected of a cultivation technician: hazard recognition, biosecurity, controlled instructions, traceability, equipment boundaries, trustworthy records, and professional shift handoff.</p><ul><li>6 modules</li><li>18 focused lessons</li><li>6 module tests</li><li>36-item final course test</li><li>student workbook and integrated practical</li></ul><div class="dtf-courses-actions"><a class="dtf-courses-btn" href="/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/">Open Course 1</a></div></article><aside class="dtf-courses-card"><h2>Use the right learning surface</h2><p><strong>Learn</strong> is the broad education library and 420-resource system.</p><p><strong>Courses</strong> are structured professional learning sequences.</p><p><strong>Certification</strong> uses separate secure assessment and credential-governance controls.</p></aside></div><h2 style="margin-top:38px">How a course is structured</h2><div class="dtf-courses-map"><div class="dtf-courses-step"><strong>1. Orient</strong>Know the objective, relevance, and position in the course.</div><div class="dtf-courses-step"><strong>2. Learn</strong>Use researched explanations and teaching visuals.</div><div class="dtf-courses-step"><strong>3. Practice</strong>Work cases, retrieval checks, workbook tasks, and practical decisions.</div><div class="dtf-courses-step"><strong>4. Assess</strong>Use module tests and the final course test before progressing.</div></div><div class="dtf-courses-note"><strong>Course tests are learning assessments.</strong> They are separate from the secure professional certification examination.</div></div></main>`;
const courses=await upsertPage('courses','Courses',page,0);
await writeFile(join(backupDir,'courses-page.json'),`${JSON.stringify(courses,null,2)}\n`);

const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const header=(parts||[]).find(p=>p.theme==='hostinger-ai-theme'&&p.slug==='header');
must(header?.id,'Active Hostinger header template part is missing.');
let content=rendered(header.content);
await writeFile(join(backupDir,'header-before.html'),content);
if(!content.includes('href="/courses/"')){
  const learn='<a href="/learn/">Learn</a>';
  must(content.includes(learn),'Canonical Learn header link not found.');
  content=content.replace(learn,`${learn}<a class="dtf-courses-nav-link" href="/courses/">Courses</a>`);
}
const markerStart='<!-- dtf-courses-nav-v1:start -->';
const markerEnd='<!-- dtf-courses-nav-v1:end -->';
content=content.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`,'g'),'').trim();
const behavior=`${markerStart}<!-- wp:html --><style id="dtf-courses-nav-v1-style">.dtf-shell-nav a.dtf-courses-nav-link.is-active{background:rgba(214,183,92,.14)!important;color:#f0d57a!important;box-shadow:inset 0 0 0 1px rgba(214,183,92,.28)}</style><script id="dtf-courses-nav-v1-script">(function(){function sync(){var p=location.pathname||'/';document.querySelectorAll('.dtf-shell-nav a').forEach(function(a){if(a.getAttribute('href')==='/courses/'){var on=p==='/courses/'||p.indexOf('/learn/learning-hub/')===0;a.classList.toggle('is-active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}if(a.getAttribute('href')==='/learn/'&&p.indexOf('/learn/learning-hub/')===0){a.classList.remove('is-active');a.removeAttribute('aria-current');}});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();})();</script><!-- /wp:html -->${markerEnd}`;
content=`${content}\n${behavior}`;
await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(header.id)}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
await writeFile(join(backupDir,'header-after.html'),content);

const headerAfter=rendered((await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100')).find(p=>p.theme==='hostinger-ai-theme'&&p.slug==='header')?.content);
must(headerAfter.includes('href="/courses/"'),'Courses link missing from shared header after write.');
must(headerAfter.includes('dtf-courses-nav-v1-script'),'Courses active-navigation behavior missing.');
const courseReadback=await pageBySlug('courses',0);must(courseReadback?.status==='publish','Courses page not published.');
console.log(JSON.stringify({result:'success',coursesPageId:courseReadback.id,coursesRoute:'/courses/',headerLink:true,targetCourse:'/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/'},null,2));
