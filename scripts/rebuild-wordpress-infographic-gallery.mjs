import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_INFOGRAPHIC_GALLERY||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-visual-rebuild';
const policyPath=process.env.VISUAL_QUALITY_POLICY||'site/wordpress/visual-quality-policy.json';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Approved-Visual-Library/2.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`infographic-gallery-${stamp}`);
await mkdir(backupDir,{recursive:true});

function rendered(v){if(typeof v==='string')return v;if(v&&typeof v==='object')return v.rendered||v.raw||'';return'';}
function strip(v=''){return String(v).replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
async function request(path,options={}){const r=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60000)});const t=await r.text();let b=null;try{b=t?JSON.parse(t):null}catch{b=t}if(!r.ok)throw new Error(`${options.method||'GET'} ${path} failed (${r.status}): ${typeof b==='string'?b.slice(0,400):JSON.stringify(b).slice(0,400)}`);return b;}
async function allMedia(){const out=[];for(let p=1;p<=8;p++){try{const rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${p}`);if(!Array.isArray(rows)||!rows.length)break;out.push(...rows);if(rows.length<100)break;}catch(e){if(/invalid_page|400/i.test(e.message))break;throw e;}}return out;}
async function getPage(){const rows=await request('/wp-json/wp/v2/pages?slug=infographics&context=edit&per_page=10');if(!Array.isArray(rows)||rows.length!==1)throw new Error(`Expected one infographics page, found ${Array.isArray(rows)?rows.length:'invalid'}`);return rows[0];}
function mediaText(m){return `${m.slug||''} ${strip(rendered(m.title))} ${strip(rendered(m.caption))} ${strip(rendered(m.description))} ${strip(m.alt_text||'')} ${m.source_url||''}`.toLowerCase();}

const policy=JSON.parse(await readFile(policyPath,'utf8'));
const approvedPrefixes=Array.isArray(policy.approvedMediaSlugPrefixes)?policy.approvedMediaSlugPrefixes.map(v=>String(v).toLowerCase()):[];
const bannedPrefixes=Array.isArray(policy?.bannedMedia?.slugPrefixes)?policy.bannedMedia.slugPrefixes.map(v=>String(v).toLowerCase()):[];
const bannedUrls=Array.isArray(policy?.bannedMedia?.urlContains)?policy.bannedMedia.urlContains.map(v=>String(v).toLowerCase()):[];
if(policy.mode!=='quarantine'||!approvedPrefixes.includes('dtf-approved-visual-'))throw new Error('Visual quality policy is missing the approved-learning quarantine contract');
function isApproved(m){const slug=String(m.slug||'').toLowerCase();const url=String(m.source_url||'').toLowerCase();if(!m.source_url)return false;if(bannedPrefixes.some(prefix=>slug.startsWith(prefix)))return false;if(bannedUrls.some(part=>url.includes(part)))return false;return approvedPrefixes.some(prefix=>slug.startsWith(prefix));}

const categories=[
 {id:'anatomy',title:'Plant Anatomy & Physiology',match:['anatom','cell','root','stem','leaf','flower','trichome','photosynth','gas exchange','transpir','whole plant']},
 {id:'lifecycle',title:'Lifecycle & Propagation',match:['germin','seedling','clone','cloning','propagat','vegetative','flowering stage','life cycle','seed to harvest','hardening']},
 {id:'environment',title:'Environment, VPD & Lighting',match:['vpd','temperature','humidity','environment','airflow','air flow','ppfd','dli','lighting','light intensity','photoperiod','spectrum']},
 {id:'nutrition',title:'Nutrition, Water & Root Zone',match:['nutrient','nutrition','macronutrient','micronutrient','root zone','ph ',' ph','ec ','ppm','water quality','irrigation','soil','media','hydropon','cec','cation','amino acid','humic','fulvic']},
 {id:'health',title:'IPM & Plant Health',match:['ipm','pest','mite','insect','pathogen','disease','biosecurity','sanitation','deficien','toxicity','beneficial','virus','viroid','fung','mold']},
 {id:'training',title:'Training & Canopy',match:['training','topping','lst','hst','scrog','mainline','pruning','canopy','branching']},
 {id:'harvest',title:'Harvest & Post-Harvest',match:['harvest','drying','dry ','curing','cure','storage','water activity','post harvest','post-harvest']},
 {id:'genetics',title:'Genetics & Breeding',match:['genetic','breeding','phenotype','genotype','sex expression','chromosome','inherit','filial','selection','polyploid','reproduction']},
 {id:'evidence',title:'Evidence, Measurement & Reference',match:['evidence','measurement','claim','observation','replication','classification','audit','framework','mops']},
 {id:'general',title:'General Cultivation Reference',match:[]}
];
function categoryFor(m){const v=mediaText(m);return categories.find(c=>c.id!=='general'&&c.match.some(k=>v.includes(k)))||categories.at(-1);}
function cleanTitle(v=''){return strip(v)
 .replace(/\bDTF\s+Approved\s+(?:Public\s+)?Visual\b/gi,' ')
 .replace(/\b(?:THC|DTF)[\s_-]*(?:ENC|C)?[\s_-]*\d{2,4}\b/gi,' ')
 .replace(/\bEVID[\s_-]*\d{1,3}\b/gi,' ')
 .replace(/\b(?:infographic|full[\s-]*sheet|production[\s-]*visual)\b/gi,' ')
 .replace(/\s+/g,' ').trim();}
function titleFor(m){const candidates=[rendered(m.caption),rendered(m.title),m.alt_text,m.slug];for(const candidate of candidates){const cleaned=cleanTitle(candidate);if(cleaned&&cleaned.length>=4)return cleaned;}return'Teaching Healthy Cultivation visual';}
function titleKey(m){return titleFor(m).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function dedupeApproved(items){const urls=new Set();const titles=new Set();const out=[];for(const m of items){const url=String(m.source_url||'').toLowerCase();const key=titleKey(m);if(!url||urls.has(url)||(key&&titles.has(key)))continue;urls.add(url);if(key)titles.add(key);out.push(m);}return out;}
function card(m){const url=esc(m.source_url||m.guid?.rendered||'');const title=esc(titleFor(m));const alt=esc(cleanTitle(m.alt_text)||titleFor(m));return `<figure class="dtf-vlib-card"><a class="dtf-vlib-image" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${alt}" loading="lazy" decoding="async"></a><figcaption><strong>${title}</strong><a href="${url}" target="_blank" rel="noopener">Open full size <span aria-hidden="true">→</span></a></figcaption></figure>`;}

const all=await allMedia();
const approved=dedupeApproved(all.filter(isApproved));
approved.sort((a,b)=>titleFor(a).localeCompare(titleFor(b)));
const grouped=new Map(categories.map(c=>[c.id,[]]));for(const m of approved)grouped.get(categoryFor(m).id).push(m);
const page=await getPage();await writeFile(join(backupDir,'page-before.json'),`${JSON.stringify(page,null,2)}\n`);

const populated=categories.filter(c=>grouped.get(c.id).length);
const nav=populated.map(c=>`<a href="#${c.id}">${esc(c.title)} <span>${grouped.get(c.id).length}</span></a>`).join('');
const sections=populated.map(c=>`<section class="dtf-vlib-section" id="${c.id}"><div class="dtf-vlib-heading"><div><p>Teaching Healthy Cultivation</p><h2>${esc(c.title)}</h2></div><a href="#top">Back to top ↑</a></div><div class="dtf-vlib-grid">${grouped.get(c.id).map(card).join('')}</div></section>`).join('');
const emptyState=approved.length?sections:`<section class="dtf-vlib-empty"><p class="dtf-vlib-kicker">Quality gate active</p><h2>Approved replacement visuals are being rebuilt.</h2><p>The legacy educational image set is intentionally withheld from the public library. New visuals will appear here only after they are explicitly approved for public educational use and responsive review.</p><a class="dtf-vlib-button" href="/learn/">Continue learning without the legacy graphics</a></section>`;
const style=`<style id="dtf-approved-visual-library-v2">
.dtf-vlib{--ink:#14331f;--muted:#526357;--green:#216c3d;--deep:#071b11;--gold:#d6b75c;--cream:#f8f5ec;--soft:#eef2e9;--line:rgba(20,51,31,.14);background:var(--cream);color:var(--ink)}
.dtf-vlib *{box-sizing:border-box}.dtf-vlib a{text-underline-offset:3px}.dtf-vlib-wrap{width:min(1240px,calc(100% - clamp(28px,6vw,72px)));margin-inline:auto}.dtf-vlib-hero{padding:clamp(60px,8vw,96px) 0 38px;background:linear-gradient(150deg,#071b11,#123824);color:#fff}.dtf-vlib-kicker,.dtf-vlib-heading p{margin:0;color:#8fd38c;font-weight:900;text-transform:uppercase;letter-spacing:.13em;font-size:.78rem}.dtf-vlib h1{max-width:13ch;margin:10px 0 20px;font-size:clamp(2.8rem,6vw,5.4rem);line-height:.94;letter-spacing:-.05em;text-wrap:balance}.dtf-vlib-hero .lead{max-width:720px;margin:0;color:#d7e3da;font-size:clamp(1.02rem,1.4vw,1.18rem);line-height:1.7}.dtf-vlib-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.dtf-vlib-button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 17px;border-radius:12px;background:#fff;color:var(--deep);font-weight:900;text-decoration:none}.dtf-vlib-button.primary{background:#87d178}.dtf-vlib-index{padding:26px 0;border-bottom:1px solid var(--line);background:#fff}.dtf-vlib-index .dtf-vlib-wrap{display:flex;gap:9px;flex-wrap:wrap}.dtf-vlib-index a{display:inline-flex;gap:7px;align-items:center;min-height:42px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;color:var(--ink);font-weight:800;text-decoration:none;background:#fbfcf8}.dtf-vlib-index a span{color:var(--muted);font-size:.82rem}.dtf-vlib-main{padding:20px 0 clamp(64px,8vw,92px)}.dtf-vlib-section{padding:clamp(44px,6vw,72px) 0;border-bottom:1px solid var(--line)}.dtf-vlib-section:last-child{border-bottom:0}.dtf-vlib-heading{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:24px}.dtf-vlib-heading h2{margin:7px 0 0;font-size:clamp(1.9rem,4vw,3rem);line-height:1;letter-spacing:-.045em;text-wrap:balance}.dtf-vlib-heading>a{color:var(--green);font-weight:800}.dtf-vlib-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.dtf-vlib-card{margin:0;min-width:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(12,39,23,.07)}.dtf-vlib-image{display:block;aspect-ratio:4/3;background:var(--soft);overflow:hidden}.dtf-vlib-image img{display:block;width:100%;height:100%;object-fit:cover}.dtf-vlib-card figcaption{display:grid;gap:10px;padding:17px 18px 18px}.dtf-vlib-card strong{font-size:1rem;line-height:1.35}.dtf-vlib-card figcaption a{width:max-content;color:var(--green);font-size:.9rem;font-weight:850}.dtf-vlib-empty{max-width:760px;margin:clamp(54px,7vw,88px) auto;padding:clamp(28px,5vw,46px);border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:0 12px 30px rgba(12,39,23,.06)}.dtf-vlib-empty h2{margin:8px 0 12px;font-size:clamp(1.8rem,4vw,2.8rem);letter-spacing:-.04em}.dtf-vlib-empty>p:not(.dtf-vlib-kicker){color:var(--muted);line-height:1.7}.dtf-vlib-note{background:var(--deep);color:#dbe8de}.dtf-vlib-note .dtf-vlib-wrap{padding-block:34px}.dtf-vlib-note strong{color:#fff}.dtf-vlib-note p{max-width:800px;margin:7px 0 0;line-height:1.68}
@media(max-width:900px){.dtf-vlib-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.dtf-vlib-wrap{width:min(100% - 28px,1240px)}.dtf-vlib-hero{padding-top:52px}.dtf-vlib h1{font-size:clamp(2.5rem,12vw,3.8rem)}.dtf-vlib-actions{display:grid}.dtf-vlib-button{width:100%}.dtf-vlib-index .dtf-vlib-wrap{display:grid;grid-template-columns:1fr}.dtf-vlib-index a{width:100%;justify-content:space-between}.dtf-vlib-heading{align-items:start}.dtf-vlib-heading>a{display:none}.dtf-vlib-grid{grid-template-columns:1fr}.dtf-vlib-section{padding-block:44px}}
</style>`;
const content=`${style}<div id="top" class="dtf-vlib"><section class="dtf-vlib-hero"><div class="dtf-vlib-wrap"><p class="dtf-vlib-kicker">Teaching Healthy Cultivation</p><h1>Visual plant science library.</h1><p class="lead">${approved.length?`${approved.length} approved educational visual${approved.length===1?' is':'s are'} available for public use. Browse by subject and open any approved image at full size.`:'The public visual library is under a strict quality gate while approved replacement graphics are rebuilt.'}</p><div class="dtf-vlib-actions"><a class="dtf-vlib-button primary" href="/learn/">Back to Learn</a><a class="dtf-vlib-button" href="/tools/">Cultivation tools</a></div></div></section>${nav?`<nav class="dtf-vlib-index" aria-label="Visual library subjects"><div class="dtf-vlib-wrap">${nav}</div></nav>`:''}<main class="dtf-vlib-main"><div class="dtf-vlib-wrap">${emptyState}</div></main><section class="dtf-vlib-note"><div class="dtf-vlib-wrap"><strong>Use visuals as evidence support, not as a one-image diagnosis.</strong><p>Plant symptoms overlap. Confirm plant stage, symptom pattern, root-zone conditions, irrigation, environment, recent changes, pest evidence, and appropriate measurements before acting.</p></div></section></div>`;

if(apply)await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({title:'THC Visual Library',content,status:'publish'})});
const report={generatedAt:new Date().toISOString(),apply,policyMode:policy.mode,totalMediaScanned:all.length,approvedMediaFound:approved.length,rejectedOrUnapproved:all.length-approved.length,pageId:page.id,groups:Object.fromEntries(categories.map(c=>[c.id,grouped.get(c.id).length])),backupDir};
await writeFile(join(backupDir,'gallery-report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupRoot,'infographic-gallery-backup-path.txt'),`${backupDir}\n`);console.log(JSON.stringify(report,null,2));
