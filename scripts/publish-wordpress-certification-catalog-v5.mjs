import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly=process.argv.includes('--validate-only');
const apply=String(process.env.APPLY_CERTIFICATION_CATALOG_V5||'').toLowerCase()==='true';
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const data=JSON.parse(await readFile(process.env.CERTIFICATION_CATALOG_PATH||'site/wordpress/education/course-catalog-v4.json','utf8'));
const routes=JSON.parse(await readFile(process.env.TECH1_PUBLIC_COURSES_PATH||'site/wordpress/education/tech1-courses-public-v1.json','utf8'));
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-certification-catalog-v5';
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const must=(v,m)=>{if(!v)throw new Error(m)};
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

must(data.schemaVersion===4&&data.id==='dtf-courses-catalog-v4','Unexpected base catalog.');
for(const entry of routes.courses){
  const course=data.courses.find(x=>x.id===entry.id); must(course,`Missing catalog course ${entry.id}`);
  course.status='available-academic';
  course.statusLabel='Available academic course';
  course.publicLessonReleaseAvailable=true;
  course.href=`${routes.program.route}${entry.slug}/`;
  course.availabilityNote='Public learner lessons and learning assessments are open now. Professional credential issuance remains separate and restricted.';
}
data.eyebrow='THC Academy';
data.title='Professional Cannabis Cultivation Education';
data.intro='Build practical cultivation knowledge through structured science, applied practice, field references, and progressive training pathways. Start with Technician I, advance through Technician II, then explore specialist and leadership programs.';
if(data.coursesSection) data.coursesSection.intro='All 15 built Technician I and Technician II course packages are listed publicly. All seven Technician I academic training courses now include Open Course links; Technician II pages remain visible as curriculum-built work awaiting public learner release.';
const tech1=data.credentialSections.flatMap(x=>x.offerings||[]).find(x=>x.id==='CREDPROG-CULT-TECH-I-001');
if(tech1?.availableCourse) tech1.availableCourse.label='All 7 Technician I academic courses are open now · start with Course 1';

const offerings=data.credentialSections.flatMap(x=>x.offerings||[]);
must(offerings.length===10,'Expected 10 credential offerings.');
must(offerings.every(x=>x.issuanceAvailable===false),'No credential may be marked issuance-available.');
must(data.courses.length===15,'Expected 15 Technician courses.');
const open=data.courses.filter(x=>x.publicLessonReleaseAvailable===true);
must(open.length===7,`Expected exactly seven public academic courses, found ${open.length}.`);
must(open.every(x=>x.id.startsWith('COURSE-LH-TECH1-')),'Only Technician I courses should be public in Catalog V5.');
must(open.every(x=>x.href),'Every public academic course requires an href.');

const publicCredentialTitle=(item)=>{
  const map={
    'THC Safety & Responsible Practice Certificate':'Cultivation Safety & Professional Practice',
    'THC Cultivation Foundations Certificate':'Cannabis Cultivation Foundations',
    'THC Cultivation Technician I':'Cultivation Technician I',
    'THC Cultivation Technician II':'Cultivation Technician II',
    'THC Plant Health, IPM & Biosecurity Specialist':'Plant Health & IPM Specialist',
    'THC Environmental, Irrigation & Fertigation Systems Specialist':'Environmental & Irrigation Systems',
    'THC Propagation & Clean Stock Specialist':'Propagation & Clean Stock',
    'THC Postharvest Quality Specialist':'Postharvest & Quality',
    'THC Genetics, Breeding & Preservation Specialist':'Genetics & Breeding Specialist',
    'THC Cultivation Lead & Operations Professional':'Cultivation Leadership & Operations'
  };
  return map[item.title]||item.title;
};
const publicCourseTitle=(course)=>{
  const map={
    'Safety, Responsible Practice & Cultivation Workflows':'Cultivation Safety & Professional Practice',
    'Plant Observation, Growth Stages & Crop Records':'Plant Observation & Crop Records',
    'Environmental, Light & Sensor Fundamentals':'Environment, Lighting & Sensors',
    'Water, Root Zone, Nutrition & Irrigation Fundamentals':'Water, Nutrition & Root-Zone Management',
    'Propagation, Canopy, IPM Scouting & Crop Care':'Propagation, Canopy & Crop Health',
    'Harvest, Postharvest, Traceability & Shift Handoff':'Harvest, Postharvest & Traceability',
    'Integrated Cultivation Technician Practice Lab':'Technician I Practical Lab'
  };
  return map[course.title]||course.title;
};
const publicStatus=(item)=>item.status==='planned'?'Coming later':item.status==='in-development'?'In development':item.statusLabel||item.status;
const publicSectionTitle=(section)=>{
  const map={
    foundational:'Foundations',
    technician:'Technician Pathways',
    specialist:'Specialist Training',
    'advanced-professional':'Leadership & Operations'
  };
  return map[section.id]||section.title;
};

const css=`<style id="dtf-courses-v5-style">
.dc5{--ink:#14271b;--muted:#637066;--deep:#0d291b;--green:#2f7149;--paper:#fbfcf9;--soft:#f2f6f1;--line:#dbe3dc;--gold:#b89443;background:linear-gradient(180deg,#fbfcf9 0%,#f5f8f3 100%);color:var(--ink);padding:22px 0 72px}
.dc5 *{box-sizing:border-box}.dc5-wrap{width:min(1180px,calc(100% - 28px));margin:auto}.dc5 a{text-underline-offset:3px}
.dc5-hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:22px;padding:clamp(28px,5vw,54px);border-radius:22px;background:linear-gradient(135deg,#0d291b,#1b4930);color:#fff;box-shadow:0 18px 48px rgba(17,47,31,.12)}
.dc5-k{font-size:.76rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#bfe0c7}.dc5 h1{font-size:clamp(2.25rem,5vw,4.6rem);letter-spacing:-.045em;line-height:1.02;margin:.18em 0}.dc5 h2{font-size:clamp(1.55rem,3vw,2.25rem);letter-spacing:-.025em;margin-bottom:.35rem}.dc5 h3{letter-spacing:-.015em}.dc5 p,.dc5 li{line-height:1.55}.dc5-hero p{max-width:64ch;color:#e0ebe4;font-size:clamp(1rem,1.5vw,1.12rem)}
.dc5-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.dc5-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border-radius:9px;background:#3b8558;color:#fff!important;font-weight:850;text-decoration:none!important}.dc5-btn.secondary{background:transparent;border:1px solid rgba(255,255,255,.34)}
.dc5-guide{padding:20px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.07)}.dc5-guide strong{font-size:1.05rem}.dc5-guide p{margin-bottom:0;color:#d9e6de;font-size:.94rem}
.dc5-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:18px}.dc5-flow span{display:block;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:.82rem;font-weight:800}.dc5-flow b{display:block;color:var(--green);font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px}
.dc5-section{margin-top:34px}.dc5-section-lede{max-width:72ch;color:var(--muted);margin-top:0}.dc5-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dc5-card,.dc5-course,.dc5-surface{border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(24,55,36,.04)}
.dc5-card{padding:18px;display:flex;flex-direction:column;min-height:190px}.dc5-card h3{margin:9px 0 6px;font-size:1.25rem;line-height:1.2}.dc5-card p{margin:.35rem 0;color:var(--muted)}.dc5-meta{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.dc5-type{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.065em;color:#50675a}.dc5-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#eef4ef;color:#2b5b3c;font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.03em}.dc5-card[data-status="planned"]{background:#fcfdfb}.dc5-card[data-status="planned"] .dc5-status{background:#f2f2ee;color:#687067}.dc5-card-link{margin-top:auto;padding-top:10px}
.dc5-program{margin-top:22px}.dc5-program-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:12px}.dc5-program-head p{max-width:66ch;color:var(--muted);margin:0}
.dc5-course-list{display:grid;gap:11px}.dc5-course{display:grid;grid-template-columns:112px 1fr;overflow:hidden}.dc5-rail{padding:18px 14px;background:#153824;color:#fff}.dc5-rail .dc5-status{background:rgba(255,255,255,.12);color:#fff}.dc5-rail strong{display:block;margin-top:10px;font-size:.82rem;line-height:1.35}.dc5-body{padding:20px}.dc5-body h3{margin:0;font-size:1.35rem;line-height:1.2}.dc5-body p{color:var(--muted);margin:.55rem 0}.dc5-metrics{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.dc5-metric{padding:7px 9px;border-radius:8px;background:var(--soft);font-size:.78rem}.dc5-metric strong{color:#185f36;margin-right:4px}
.dc5-note{margin-top:20px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--muted);font-size:.9rem}.dc5-note strong{color:var(--ink)}
.dc5-surfaces{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.dc5-surface{padding:18px}.dc5-surface h3{margin-top:0}.dc5-surface p{color:var(--muted)}
.dc5 :focus-visible{outline:3px solid #1763ae;outline-offset:3px}
@media(max-width:850px){.dc5-hero,.dc5-grid,.dc5-surfaces{grid-template-columns:1fr}.dc5-flow{grid-template-columns:repeat(2,1fr)}.dc5-course{grid-template-columns:104px 1fr}}
@media(max-width:620px){.dc5{padding-top:10px}.dc5-wrap{width:min(100% - 18px,1180px)}.dc5-hero{grid-template-columns:1fr;padding:24px 18px;border-radius:15px}.dc5 h1{font-size:clamp(2.1rem,11vw,3rem)}.dc5-actions{display:grid}.dc5-btn{width:100%}.dc5-flow{grid-template-columns:1fr 1fr}.dc5-grid{grid-template-columns:1fr}.dc5-card{min-height:0}.dc5-course{grid-template-columns:1fr}.dc5-rail{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px}.dc5-rail strong{margin-top:0;text-align:right}.dc5-body{padding:17px}.dc5-body h3{font-size:1.22rem}.dc5-program-head{display:block}.dc5-program-head p{margin-top:4px}.dc5-section{margin-top:28px}.dc5-metrics{gap:6px}}
</style>`;

const actions=(data.primaryActions||[]).map(a=>`<a class="dc5-btn${a.style==='secondary'?' secondary':''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('');
const credentialSections=data.credentialSections.map(section=>`<section class="dc5-program" data-credential-section="${esc(section.id)}"><div class="dc5-program-head"><div><h2>${esc(publicSectionTitle(section))}</h2><p>${esc(section.description)}</p></div></div><div class="dc5-grid">${(section.offerings||[]).map(item=>`<article class="dc5-card" data-credential-offering="${esc(item.title)}" data-status="${esc(item.status)}" data-issuance-available="${item.issuanceAvailable?'true':'false'}"><div class="dc5-meta"><span class="dc5-type">${esc(item.type)}${item.plannedCourses?` · ${esc(item.plannedCourses)} courses`:''}</span><span class="dc5-status">${esc(publicStatus(item))}</span></div><h3>${esc(publicCredentialTitle(item))}</h3><p>${esc(item.summary)}</p>${item.availableCourse?`<p class="dc5-card-link"><a href="${esc(item.availableCourse.href)}"><strong>Start Technician I →</strong></a></p>`:''}</article>`).join('')}</div></section>`).join('');
const courses=data.courses.map(course=>`<article class="dc5-course" data-course-id="${esc(course.id)}" data-course-release="${course.publicLessonReleaseAvailable?'available':'pending'}"><aside class="dc5-rail"><span class="dc5-status">${course.publicLessonReleaseAvailable?'Open':'In development'}</span><strong>${esc((course.pathLabel||'').replace(/^THC\s+/,'') )}</strong></aside><div class="dc5-body"><h3>Course ${esc(course.number)} · ${esc(publicCourseTitle(course))}</h3><p>${esc(course.summary)}</p><div class="dc5-metrics">${(course.metrics||[]).slice(0,3).map(m=>`<span class="dc5-metric"><strong>${esc(m.value)}</strong>${esc(m.label)}</span>`).join('')}</div>${course.publicLessonReleaseAvailable&&course.href?`<a class="dc5-btn" data-course-open="true" href="${esc(course.href)}">Open Course ${esc(course.number)} →</a>`:`<p><strong>Course status:</strong> Public learner release is being prepared.</p>`}</div></article>`).join('');
const surfaces=(data.learningSurfaces||[]).map(x=>`<article class="dc5-surface"><h3>${esc(x.title)}</h3><p>${esc(x.copy)}</p><a href="${esc(x.href)}"><strong>Open ${esc(x.title)} →</strong></a></article>`).join('');
const content=`${css}<main class="dc5" data-dtf-courses-catalog="v5"><div class="dc5-wrap">
<section class="dc5-hero"><div><span class="dc5-k">${esc(data.eyebrow)}</span><h1>${esc(data.title)}</h1><p>${esc(data.intro)}</p><div class="dc5-actions">${actions}</div></div><aside class="dc5-guide"><strong>How the Academy works</strong><div class="dc5-flow"><span><b>1</b>Learn</span><span><b>2</b>Practice</span><span><b>3</b>Assess</span><span><b>4</b>Certify</span></div><p>Course assessments build and verify learning. Professional certification uses its own final eligibility and credential process.</p></aside></section>
<section class="dc5-section"><h2>Choose your learning pathway</h2><p class="dc5-section-lede">Start with core cultivation training, build advanced technician skills, or explore focused specialist and leadership programs.</p>${credentialSections}<div class="dc5-note"><strong>Certification:</strong> Course completion and professional credential issuance are separate stages. <a href="/certification/">Learn how certification works →</a></div></section>
<section class="dc5-section"><h2>Technician courses</h2><p class="dc5-section-lede">Follow the courses in order for a guided progression from safe cultivation practice through advanced systems and diagnostic reasoning.</p><div class="dc5-course-list">${courses}</div></section>
<section class="dc5-section"><h2>Learning tools & references</h2><div class="dc5-surfaces">${surfaces}</div></section>
</div></main>`;

must((content.match(/data-credential-offering=/g)||[]).length===10,'Rendered V5 catalog requires 10 credential offerings.');
must((content.match(/data-course-id=/g)||[]).length===15,'Rendered V5 catalog requires 15 courses.');
must((content.match(/data-course-open="true"/g)||[]).length===7,'Rendered V5 catalog requires seven open Technician I courses.');
must(!content.includes('data-issuance-available="true"'),'Rendered V5 catalog cannot advertise credential issuance.');
if(validateOnly){console.log(JSON.stringify({result:'success',version:5,openCourses:open.map(x=>x.id)},null,2));process.exit(0)}
if(!apply){console.log('Validation passed. Set APPLY_CERTIFICATION_CATALOG_V5=true to publish.');process.exit(0)}
must(auth,'WordPress credentials required.');
async function wp(endpoint,options={}){const r=await fetch(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//,'')}`,{...options,headers:{Authorization:auth,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(30000)});const text=await r.text();if(!r.ok)throw new Error(`${endpoint} returned ${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null}
const rows=await wp('pages?slug=courses&context=edit&per_page=100');must(rows.length,'/courses/ WordPress page not found.');const page=rows[0];await mkdir(backupRoot,{recursive:true});await writeFile(join(backupRoot,`courses-${page.id}.json`),JSON.stringify(page,null,2));const updated=await wp(`pages/${page.id}`,{method:'POST',body:JSON.stringify({status:'publish',content,title:'Courses'})});
console.log(JSON.stringify({result:'success',version:5,pageId:updated.id,openCourses:open.map(x=>({id:x.id,href:x.href}))},null,2));
