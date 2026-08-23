import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_INFOGRAPHIC_POLISH||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-infographic-backups';
const placementPath=process.env.INFOGRAPHIC_PLACEMENT_CONFIG||join(process.cwd(),'site/wordpress/assets/infographics/placement-rules.json');
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','Content-Type':'application/json','User-Agent':'DTFSeeds-Infographic-Polish/2.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`infographic-polish-${stamp}`);
await mkdir(backupDir,{recursive:true});

function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function rendered(v){if(typeof v==='string')return v;if(v&&typeof v==='object')return v.rendered||v.raw||'';return'';}
function strip(v=''){return String(v).replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();}
function norm(v=''){return String(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\\/_-]+/g,' ').replace(/[^a-z0-9. ]+/g,' ').replace(/\s+/g,' ').trim();}
function hasAny(value,fragments=[]){const n=norm(value);return fragments.some(f=>n.includes(norm(f)));}
function routeSlug(route=''){return String(route).split('/').filter(Boolean).at(-1)||'reference';}
function mediaText(m){return `${m.slug||''} ${strip(rendered(m.title))} ${strip(rendered(m.caption))} ${strip(rendered(m.description))} ${m.alt_text||''}`;}
function mediaTitle(m){return strip(rendered(m.title))||strip(m.alt_text)||'Teaching Healthy Cultivation visual';}
function mediaUrl(m){return m.source_url||m.guid?.rendered||'';}

async function request(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60000)});
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok)throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
  return body;
}

async function allMedia(){
  const out=[];
  for(let page=1;page<=8;page++){
    try{
      const rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if(!Array.isArray(rows)||!rows.length)break;
      out.push(...rows);
      if(rows.length<100)break;
    }catch(error){if(/invalid_page|400/i.test(error.message))break;throw error;}
  }
  return out.filter(m=>String(m.slug||'').startsWith('dtf-edu-')&&mediaUrl(m));
}

async function learnPage(){
  const rows=await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
  if(!Array.isArray(rows)||rows.length!==1)throw new Error(`Expected one Learn page, found ${Array.isArray(rows)?rows.length:'invalid'}`);
  return rows[0];
}

async function childPage(parentId,route){
  const slug=routeSlug(route);
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&parent=${parentId}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1)throw new Error(`Expected one ${route} page, found ${Array.isArray(rows)?rows.length:'invalid'}`);
  return rows[0];
}

const config=JSON.parse(await readFile(placementPath,'utf8'));
if(!Array.isArray(config.categories)||!config.categories.length)throw new Error('Placement categories missing');
const categoryById=new Map(config.categories.map(c=>[c.id,c]));
const fallback=config.categories.find(c=>c.id==='general-reference')||config.categories.at(-1);

function classify(m){
  const value=mediaText(m);
  const override=(config.primaryOverrides||[]).find(rule=>hasAny(value,rule.match||[])&&categoryById.has(rule.categoryId));
  const primary=override?categoryById.get(override.categoryId):(config.categories.find(c=>c.id!==fallback.id&&hasAny(value,c.primaryMatch||[]))||fallback);
  const placements=new Set([primary.id]);
  for(const rule of config.relatedPlacementRules||[]){
    if(hasAny(value,rule.match||[]))for(const id of rule.categoryIds||[])if(categoryById.has(id))placements.add(id);
  }
  return {media:m,primaryCategoryId:primary.id,placementCategoryIds:[...placements]};
}

const rawMedia=await allMedia();
if(rawMedia.length<20)throw new Error(`Only ${rawMedia.length} education media items found`);
const records=rawMedia.map(classify).sort((a,b)=>mediaTitle(a.media).localeCompare(mediaTitle(b.media)));
const learn=await learnPage();

function card(record){
  const m=record.media;
  const url=esc(mediaUrl(m));
  const title=esc(mediaTitle(m));
  const category=categoryById.get(record.primaryCategoryId);
  return `<figure style="margin:0;background:#ffffff;border:1px solid #d8e5dc;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(18,50,31,.08)"><a href="${url}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;aspect-ratio:4/5;padding:12px;background:linear-gradient(180deg,#f6faf7 0%,#edf5ef 100%)"><img src="${url}" loading="lazy" decoding="async" alt="${title}" style="display:block;width:100%;height:100%;object-fit:contain;border-radius:10px"></a><figcaption style="padding:15px 16px 17px"><span style="display:block;color:#257044;font-size:.76rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${esc(category?.title||'THC Education')}</span><strong style="display:block;color:#153b26;line-height:1.35;font-size:.98rem">${title}</strong></figcaption></figure>`;
}

function gallery(recordsToShow){
  if(!recordsToShow.length)return '<p style="padding:18px;border:1px dashed #b8cbbf;border-radius:14px;background:#f7faf8">Additional visuals for this topic are being prepared.</p>';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px">${recordsToShow.map(card).join('')}</div>`;
}

function topicCard(category,primaryCount,totalCount){
  return `<a href="#${esc(category.id)}" style="display:block;text-decoration:none;background:#fff;border:1px solid #d7e5db;border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(18,50,31,.06);color:#153b26"><span style="display:block;color:#2b7a4a;font-weight:900;font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${totalCount} visual${totalCount===1?'':'s'}</span><strong style="display:block;font-size:1.05rem;line-height:1.25;margin-bottom:7px">${esc(category.title)}</strong><span style="display:block;color:#587060;font-size:.9rem;line-height:1.45">${esc(category.description)}</span></a>`;
}

function masterContent(){
  const active=config.categories.map(category=>({category,primary:records.filter(r=>r.primaryCategoryId===category.id),all:records.filter(r=>r.placementCategoryIds.includes(category.id))})).filter(x=>x.all.length);
  const topicCards=active.map(x=>topicCard(x.category,x.primary.length,x.all.length)).join('');
  const sections=active.map(({category,primary,all})=>{
    const display=primary.length?primary:all;
    return `<section id="${esc(category.id)}" style="margin:54px 0"><div style="display:flex;justify-content:space-between;gap:18px;align-items:end;flex-wrap:wrap;margin-bottom:18px"><div style="max-width:820px"><span style="display:block;color:#2b7a4a;font-weight:900;text-transform:uppercase;letter-spacing:.09em;font-size:.78rem;margin-bottom:7px">Teaching Healthy Cultivation · ${all.length} visual${all.length===1?'':'s'}</span><h2 style="margin:0;color:#143b25;font-size:clamp(1.7rem,3.5vw,2.55rem);line-height:1.08">${esc(category.title)}</h2><p style="margin:10px 0 0;color:#587060;line-height:1.65">${esc(category.description)}</p></div><a href="${esc(category.route)}" style="display:inline-block;padding:10px 15px;border-radius:999px;background:#e6f1e9;color:#185c35;text-decoration:none;font-weight:900">Open topic →</a></div>${gallery(display)}</section>`;
  }).join('');
  return `<div style="background:#f6faf7;color:#143b25"><section style="background:linear-gradient(135deg,#0d2e1a 0%,#174a2b 62%,#1f6038 100%);color:#fff"><div style="max-width:1240px;margin:auto;padding:64px 22px 54px"><span style="display:inline-block;padding:7px 11px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.08);font-size:.76rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em">Teaching Healthy Cultivation</span><h1 style="font-size:clamp(2.65rem,6vw,5rem);line-height:.98;letter-spacing:-.045em;margin:18px 0 16px;max-width:900px">THC Visual Learning Library</h1><p style="font-size:1.08rem;line-height:1.75;max-width:820px;color:#d8e7dc;margin:0">Visual plant science and cultivation library. Browse ${records.length} source-controlled educational infographics by topic, open any visual at full size, then continue into the matching lesson or cultivation tool.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><a href="/learn/" style="display:inline-block;padding:12px 17px;border-radius:999px;background:#fff;color:#12351f;text-decoration:none;font-weight:900">Education home</a><a href="/tools/" style="display:inline-block;padding:12px 17px;border-radius:999px;border:1px solid rgba(255,255,255,.35);color:#fff;text-decoration:none;font-weight:900">Cultivation tools</a></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:34px;max-width:720px"><div style="padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.09)"><strong style="font-size:1.55rem">${records.length}</strong><span style="display:block;color:#cfe0d4;font-size:.84rem">published visuals</span></div><div style="padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.09)"><strong style="font-size:1.55rem">${active.length}</strong><span style="display:block;color:#cfe0d4;font-size:.84rem">topic collections</span></div><div style="padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.09)"><strong style="font-size:1.55rem">1×</strong><span style="display:block;color:#cfe0d4;font-size:.84rem">canonical media source</span></div></div></div></section><main style="max-width:1240px;margin:auto;padding:34px 22px 70px"><section style="margin-bottom:48px"><div style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:16px"><div><span style="color:#2b7a4a;font-size:.77rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em">Browse by subject</span><h2 style="margin:5px 0 0;font-size:clamp(1.65rem,3vw,2.35rem)">Find the right visual faster.</h2></div><p style="max-width:580px;color:#587060;line-height:1.6;margin:0">Every infographic has one primary home and can also appear in related topics when the science overlaps.</p></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">${topicCards}</div></section>${sections}</main><section style="background:#102f1c;color:#dbe8de"><div style="max-width:1240px;margin:auto;padding:38px 22px"><strong style="display:block;color:#fff;font-size:1.15rem">Use visuals to support reasoning, not replace it.</strong><p style="max-width:850px;line-height:1.7;margin-bottom:0">Plant symptoms overlap. Confirm plant stage, pattern, root-zone conditions, irrigation, environment, recent changes, pest evidence, and appropriate measurements before making a diagnosis or crop-management change.</p></div></section></div>`;
}

function topicContent(category){
  const matched=records.filter(r=>r.placementCategoryIds.includes(category.id));
  const primary=matched.filter(r=>r.primaryCategoryId===category.id);
  const related=matched.filter(r=>r.primaryCategoryId!==category.id);
  return `<div style="background:#f6faf7;color:#143b25"><section style="background:linear-gradient(135deg,#0f341e,#1d5b35);color:#fff"><div style="max-width:1120px;margin:auto;padding:54px 22px 45px"><a href="/learn/infographics/" style="color:#cfe5d5;text-decoration:none;font-weight:800">← THC Visual Learning Library</a><h1 style="font-size:clamp(2.3rem,5vw,4.3rem);line-height:1;letter-spacing:-.035em;margin:15px 0 13px">${esc(category.title)}</h1><p style="max-width:790px;color:#d8e7dc;line-height:1.7;font-size:1.04rem;margin:0">${esc(category.description)}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px"><span style="padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.1);font-weight:900">${primary.length} core visual${primary.length===1?'':'s'}</span><span style="padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.1);font-weight:900">${related.length} related</span></div></div></section><main style="max-width:1120px;margin:auto;padding:38px 22px 66px"><section><span style="color:#2b7a4a;font-size:.77rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em">Core visual set</span><h2 style="font-size:clamp(1.65rem,3vw,2.3rem);margin:5px 0 18px">Learn the topic visually.</h2>${gallery(primary)}</section>${related.length?`<section style="margin-top:52px"><span style="color:#2b7a4a;font-size:.77rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em">Cross-topic connections</span><h2 style="font-size:clamp(1.55rem,3vw,2.15rem);margin:5px 0 8px">Related visuals</h2><p style="color:#587060;line-height:1.6;margin-top:0">These visuals have another primary home but directly support this subject.</p>${gallery(related)}</section>`:''}<p style="margin-top:38px"><a href="/learn/infographics/" style="font-weight:900;color:#1b6b3c">Browse the full infographic library →</a></p></main></div>`;
}

function preferredRecord(categoryId=null){
  const pool=categoryId?records.filter(r=>r.primaryCategoryId===categoryId):records;
  const prefs=config.featuredMediaPreference||[];
  for(const pref of prefs){const found=pool.find(r=>hasAny(mediaText(r.media),[pref]));if(found)return found;}
  return pool[0]||records[0];
}

const master=await childPage(learn.id,config.masterLibraryRoute);
const masterFeatured=preferredRecord();
await writeFile(join(backupDir,'master-before.json'),`${JSON.stringify(master,null,2)}\n`);
if(apply)await request(`/wp-json/wp/v2/pages/${master.id}`,{method:'POST',body:JSON.stringify({title:'THC Visual Learning Library',content:masterContent(),status:'publish',featured_media:masterFeatured.media.id})});

const topicResults=[];
for(const category of config.categories){
  const matched=records.filter(r=>r.placementCategoryIds.includes(category.id));
  if(!matched.length)continue;
  const page=await childPage(learn.id,category.route);
  await writeFile(join(backupDir,`topic-before-${routeSlug(category.route)}.json`),`${JSON.stringify(page,null,2)}\n`);
  const featured=preferredRecord(category.id)||matched[0];
  if(apply)await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({title:category.title,content:topicContent(category),status:'publish',featured_media:featured.media.id})});
  topicResults.push({categoryId:category.id,route:category.route,pageId:page.id,primaryCount:records.filter(r=>r.primaryCategoryId===category.id).length,totalCount:matched.length,featuredMediaId:featured.media.id});
}

const primaryCounts=Object.fromEntries(config.categories.map(c=>[c.id,records.filter(r=>r.primaryCategoryId===c.id).length]));
const relatedCounts=Object.fromEntries(config.categories.map(c=>[c.id,records.filter(r=>r.placementCategoryIds.includes(c.id)).length]));
const report={generatedAt:new Date().toISOString(),apply,mediaCount:records.length,masterPageId:master.id,masterFeaturedMediaId:masterFeatured.media.id,topicPageCount:topicResults.length,topicResults,primaryCounts,relatedCounts,backupDir};
await writeFile(join(backupDir,'infographic-polish-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'infographic-polish-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
