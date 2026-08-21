import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_INFOGRAPHIC_GALLERY||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-visual-rebuild';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Infographic-Gallery/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`infographic-gallery-${stamp}`);
await mkdir(backupDir,{recursive:true});

function rendered(v){if(typeof v==='string')return v;if(v&&typeof v==='object')return v.rendered||v.raw||'';return'';}
function strip(v=''){return String(v).replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
async function request(path,options={}){const r=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60000)});const t=await r.text();let b=null;try{b=t?JSON.parse(t):null}catch{b=t}if(!r.ok)throw new Error(`${options.method||'GET'} ${path} failed (${r.status}): ${typeof b==='string'?b.slice(0,400):JSON.stringify(b).slice(0,400)}`);return b;}
async function allMedia(){const out=[];for(let p=1;p<=5;p++){try{const rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${p}`);if(!Array.isArray(rows)||!rows.length)break;out.push(...rows);if(rows.length<100)break;}catch(e){if(/invalid_page|400/i.test(e.message))break;throw e;}}return out;}
async function getPage(){const rows=await request('/wp-json/wp/v2/pages?slug=infographics&context=edit&per_page=10');if(!Array.isArray(rows)||rows.length!==1)throw new Error(`Expected one infographics page, found ${Array.isArray(rows)?rows.length:'invalid'}`);return rows[0];}
function text(m){return `${m.slug||''} ${strip(rendered(m.title))} ${strip(rendered(m.caption))} ${strip(rendered(m.description))}`.toLowerCase();}
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
function categoryFor(m){const v=text(m);return categories.find(c=>c.id!=='general'&&c.match.some(k=>v.includes(k)))||categories.at(-1);}
function titleFor(m){return strip(rendered(m.title))||strip(m.slug)||'Teaching Healthy Cultivation visual';}
function card(m){const url=esc(m.source_url||m.guid?.rendered||'');const title=esc(titleFor(m));const alt=esc(strip(m.alt_text)||titleFor(m));return `<figure style="margin:0;background:#fff;border:1px solid #dce9df;border-radius:18px;overflow:hidden;box-shadow:0 8px 22px rgba(15,47,28,.08)"><a href="${url}" target="_blank" rel="noopener" style="display:block;background:#eef4ef"><img src="${url}" alt="${alt}" loading="lazy" decoding="async" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover"></a><figcaption style="padding:14px 15px;color:#1d3b26;font-weight:800;line-height:1.4">${title}</figcaption></figure>`;}
const media=(await allMedia()).filter(m=>String(m.slug||'').startsWith('dtf-edu-')&&m.source_url);
media.sort((a,b)=>titleFor(a).localeCompare(titleFor(b)));
if(media.length<20)throw new Error(`Only ${media.length} DTF education media items found; refusing gallery rebuild`);
const grouped=new Map(categories.map(c=>[c.id,[]]));for(const m of media)grouped.get(categoryFor(m).id).push(m);
const page=await getPage();await writeFile(join(backupDir,'page-before.json'),`${JSON.stringify(page,null,2)}\n`);
const nav=categories.filter(c=>grouped.get(c.id).length).map(c=>`<a href="#${c.id}" style="display:inline-block;margin:4px 5px 4px 0;padding:8px 12px;border-radius:999px;background:#e6f0e8;color:#174d2a;text-decoration:none;font-weight:800">${esc(c.title)} <span style="opacity:.65">${grouped.get(c.id).length}</span></a>`).join('');
const sections=categories.filter(c=>grouped.get(c.id).length).map(c=>`<section id="${c.id}" style="margin:54px 0"><div style="display:flex;justify-content:space-between;gap:18px;align-items:end;flex-wrap:wrap;margin-bottom:18px"><div><p style="margin:0;color:#1c7e40;font-weight:900;text-transform:uppercase;letter-spacing:.1em">Teaching Healthy Cultivation</p><h2 style="margin:5px 0 0;font-size:clamp(1.8rem,4vw,2.8rem)">${esc(c.title)}</h2></div><a href="#top" style="color:#176b37;font-weight:800">Back to top ↑</a></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px">${grouped.get(c.id).map(card).join('')}</div></section>`).join('');
const content=`<div id="top" style="background:#f7faf7;color:#173420"><section style="max-width:1240px;margin:auto;padding:54px 22px 30px"><p style="color:#1c7e40;font-weight:900;text-transform:uppercase;letter-spacing:.12em">Teaching Healthy Cultivation</p><h1 style="font-size:clamp(2.6rem,6vw,4.8rem);line-height:1;margin:0 0 18px;letter-spacing:-.04em">Visual plant science and cultivation library.</h1><p style="max-width:840px;font-size:1.12rem;line-height:1.8;color:#415e4b">${media.length} source-controlled educational visuals are hosted directly in the DTFSeeds WordPress Media Library. Browse by subject, open any image at full size, then connect the visual to the deeper education and grow tools.</p><p><a href="/learn/" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#1c7e40;color:white;text-decoration:none;font-weight:900;margin-right:7px">Back to Learn</a><a href="/tools/" style="display:inline-block;padding:12px 18px;border-radius:999px;background:white;color:#173420;border:1px solid #b7cdbd;text-decoration:none;font-weight:900">Cultivation tools</a></p><div style="margin-top:25px">${nav}</div></section><main style="max-width:1240px;margin:auto;padding:0 22px 64px">${sections}</main><section style="background:#102f1c;color:#dbe8de"><div style="max-width:1240px;margin:auto;padding:36px 22px"><strong style="color:#fff">Use visuals as evidence support, not as a one-image diagnosis.</strong><p style="line-height:1.7">Plant symptoms overlap. Confirm plant stage, symptom pattern, root-zone conditions, irrigation, environment, recent changes, pest evidence, and appropriate measurements before acting.</p></div></section></div>`;
if(apply)await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({title:'THC Infographic Library',content,status:'publish'})});
const report={generatedAt:new Date().toISOString(),apply,mediaCount:media.length,pageId:page.id,groups:Object.fromEntries(categories.map(c=>[c.id,grouped.get(c.id).length])),backupDir};
await writeFile(join(backupDir,'gallery-report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupRoot,'infographic-gallery-backup-path.txt'),`${backupDir}\n`);console.log(JSON.stringify(report,null,2));
