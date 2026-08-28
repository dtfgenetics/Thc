import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_OUTDOOR_CHAPTER_VISUALS||'').toLowerCase()==='true';
const manifestPath=process.env.OUTDOOR_CHAPTER_VISUALS_MANIFEST||'site/wordpress/education/outdoor-v6-chapter-visuals-v1.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/thc-outdoor-chapter-visuals-v1';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'THC-Outdoor-Chapter-Visuals-V1/1.0'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rendered=value=>typeof value==='string'?value:(value?.raw||value?.rendered||'');
const esc=(value='')=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`outdoor-chapter-visuals-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{
        ...options,
        redirect:'follow',
        signal:AbortSignal.timeout(60000),
        headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}
      });
      const text=await response.text();
      let body=text;
      try{body=text?JSON.parse(text):null}catch{}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1600);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){
      last=error;
      if(attempt<8) await sleep(attempt*1600);
    }
  }
  throw last;
}

async function pageBySlug(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${slug}: expected exactly one WordPress page, found ${Array.isArray(rows)?rows.length:'invalid response'}.`);
  return rows[0];
}

const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const expectedChapters=['site-sun','hardening-transplant','water-rootzone','wind-support','rain-flower-risk','pests-wildlife','pollen-sex','season-microclimate'];
if(manifest?.schemaVersion!==1||manifest?.id!=='outdoor-v6-chapter-visuals-v1'||manifest?.route!=='/learn/outdoor/'||manifest?.brand!=='THC — Teaching Healthy Cultivation') throw new Error('Invalid Outdoor chapter visual manifest metadata.');
if(!Array.isArray(manifest.items)||manifest.items.length!==8) throw new Error('Outdoor chapter visual manifest must contain exactly eight items.');
const chapterIds=manifest.items.map(item=>item.chapterId);
if(new Set(chapterIds).size!==8||expectedChapters.some(id=>!chapterIds.includes(id))) throw new Error('Outdoor chapter visual manifest must map the eight stable V6 chapter IDs exactly once.');
for(const item of manifest.items){
  if(!item.file||!item.title||!item.alt||!item.caption) throw new Error(`Incomplete visual mapping for ${item.chapterId}.`);
  if(/draft|quarantine|superseded|legacy|qa[-_ ]?required|strain[_ -]?card/i.test(item.file)) throw new Error(`Unsafe Outdoor chapter visual mapping: ${item.file}`);
  await access(`site/wordpress/assets/infographics/${item.file}`);
}

const media=[];
for(let page=1;page<=8;page+=1){
  let rows=[];
  try{rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);}catch(error){if(/rest_post_invalid_page_number|400/.test(error.message)) break;throw error;}
  if(!Array.isArray(rows)||rows.length===0) break;
  media.push(...rows);
  if(rows.length<100) break;
}
const norm=value=>String(value||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'');
const mediaIndex=new Map();
for(const item of media){
  const source=String(item?.source_url||'');
  let base='';
  try{base=decodeURIComponent(new URL(source).pathname.split('/').pop()||'')}catch{}
  for(const key of [base,item?.slug,item?.title?.raw]) if(key) mediaIndex.set(norm(key),item);
}
const resolved=manifest.items.map(item=>{
  const wp=mediaIndex.get(norm(item.file));
  if(!wp?.source_url||!wp?.id) throw new Error(`Required WordPress media is missing for ${item.file}; refusing a generic or raw-GitHub substitute.`);
  return {...item,src:wp.source_url,mediaId:wp.id};
});

const style=`<style id="thc-outdoor-chapter-visuals-v1-style">
.outcv1{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:0;margin:18px 0 20px;background:#fff;border:1px solid #d7e2dc;border-radius:20px;overflow:hidden;box-shadow:0 12px 28px rgba(20,48,39,.07)}.outcv1>a{display:block;background:#edf3ef;min-height:280px}.outcv1 img{display:block;width:100%;height:100%;object-fit:contain}.outcv1 figcaption{padding:22px 24px;align-self:center}.outcv1 figcaption>span{display:block;margin-bottom:8px;color:#78672f;font-size:.68rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}.outcv1 figcaption>strong{display:block;color:#143027;font-size:1.28rem;line-height:1.2}.outcv1 figcaption>p{margin:9px 0 0;color:#52665e;line-height:1.6}.outcv1 figcaption>a{display:inline-block;margin-top:12px;color:#1f704f!important;font-weight:900;text-decoration:none!important}
@media(max-width:760px){.outcv1{grid-template-columns:1fr}.outcv1>a{min-height:0}.outcv1 figcaption{padding:17px 18px}}
</style>`;

function figure(item){
  return `<!-- thc-outdoor-chapter-visual-v1:${esc(item.chapterId)}:start --><figure class="outcv1" data-outdoor-chapter-visual="${esc(item.chapterId)}" data-thc-media-id="${item.mediaId}"><a href="${esc(item.src)}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="${esc(item.src)}" alt="${esc(item.alt)}"></a><figcaption><span>THC · Teaching Healthy Cultivation</span><strong>${esc(item.title)}</strong><p>${esc(item.caption)}</p><a href="${esc(item.src)}" target="_blank" rel="noopener">Open full infographic ↗</a></figcaption></figure><!-- thc-outdoor-chapter-visual-v1:${esc(item.chapterId)}:end -->`;
}

function cleanOwnedBlocks(html){
  return html
    .replace(/<style id="thc-outdoor-chapter-visuals-v1-style">[\s\S]*?<\/style>/g,'')
    .replace(/<!-- thc-outdoor-chapter-visual-v1:[^:]+:start -->[\s\S]*?<!-- thc-outdoor-chapter-visual-v1:[^:]+:end -->/g,'');
}

function insertChapterVisuals(html){
  let next=cleanOwnedBlocks(html);
  const firstChapter='<section class="hov6-chapter"';
  if(!next.includes(firstChapter)) throw new Error('Outdoor V6 chapter markup is missing.');
  next=next.replace(firstChapter,`${style}${firstChapter}`);
  for(const item of resolved){
    const chapterStart=`<section class="hov6-chapter" id="hov6-${item.chapterId}" data-hov6-chapter="${item.chapterId}">`;
    const chapterIndex=next.indexOf(chapterStart);
    if(chapterIndex<0) throw new Error(`Missing V6 chapter container ${item.chapterId}.`);
    const lessonsMarker='<div class="hov6-lessons">';
    const lessonsIndex=next.indexOf(lessonsMarker,chapterIndex+chapterStart.length);
    if(lessonsIndex<0) throw new Error(`Missing lesson grid for V6 chapter ${item.chapterId}.`);
    next=`${next.slice(0,lessonsIndex)}${figure(item)}${next.slice(lessonsIndex)}`;
  }
  return next;
}

const page=await pageBySlug('outdoor');
const before=rendered(page.content);
if(!before.includes('data-dtf-outdoor-v6="true"')||!before.includes('data-dtf-topic="outdoor-cultivation"')||!before.includes('data-dtf-learning-v4="topic-outdoor-cultivation"')) throw new Error('Outdoor V6 canonical owner markers are missing; refusing chapter visual publication.');
if((before.match(/data-hov6-chapter=/g)||[]).length!==8||(before.match(/class="hov6-lesson"/g)||[]).length!==32) throw new Error('Outdoor V6 chapter/lesson boundary is not 8 chapters and 32 lessons.');
const next=insertChapterVisuals(before);
await writeFile(join(backupDir,'before.html'),before);
await writeFile(join(backupDir,'next.html'),next);

let wrote=false;
try{
  if(apply){
    await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
    wrote=true;
  }
  const edit=rendered((await pageBySlug('outdoor')).content);
  if((edit.match(/data-outdoor-chapter-visual=/g)||[]).length!==8) throw new Error('Edit-context Outdoor chapter visual count is not 8.');
  if((edit.match(/data-hov6-chapter=/g)||[]).length!==8||(edit.match(/class="hov6-lesson"/g)||[]).length!==32) throw new Error('Edit-context Outdoor V6 chapter/lesson boundary changed.');
  for(const item of resolved){
    if(!edit.includes(`data-outdoor-chapter-visual="${item.chapterId}"`)||!edit.includes(item.src)) throw new Error(`Edit-context chapter visual missing: ${item.chapterId}.`);
  }

  let visitor='';
  let verified=false;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${site}/learn/outdoor/?thc_outcv1=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'THC-Outdoor-Chapter-Visuals-V1-Verify/1.0','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
      visitor=await response.text();
      if(response.ok&&(visitor.match(/data-outdoor-chapter-visual=/g)||[]).length===8){verified=true;break;}
    }catch{}
    await sleep(attempt*1800);
  }
  await writeFile(join(backupDir,'visitor.html'),visitor);
  if(!verified) throw new Error('Visitor Outdoor chapter visuals were not visible after publication.');
  if((visitor.match(/data-hov6-chapter=/g)||[]).length!==8||(visitor.match(/class="hov6-lesson"/g)||[]).length!==32) throw new Error('Visitor Outdoor V6 chapter/lesson boundary changed.');
  for(const item of resolved){
    if(!visitor.includes(`data-outdoor-chapter-visual="${item.chapterId}"`)) throw new Error(`Visitor chapter visual marker missing: ${item.chapterId}.`);
    const filename=encodeURIComponent(item.file).replaceAll('%20','-');
    if(!visitor.toLowerCase().includes(item.file.replace(/\.[^.]+$/,'').toLowerCase().replaceAll('_','-').slice(0,18))&&!visitor.includes(item.src)) throw new Error(`Visitor image reference missing: ${item.file}.`);
  }

  const report={generatedAt:new Date().toISOString(),apply,pageId:page.id,route:'/learn/outdoor/',brand:manifest.brand,chapterVisuals:8,chapters:8,lessons:32,wordpressMedia:resolved.map(item=>({chapterId:item.chapterId,file:item.file,mediaId:item.mediaId,src:item.src})),visitorVerified:true,backupDir};
  await writeFile(join(backupRoot,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  await writeFile(join(backupDir,'report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){
  if(wrote){
    try{
      await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:before,status:page.status||'publish'})});
      await writeFile(join(backupDir,'rollback.txt'),`Restored prior Outdoor page after failure: ${error.message}\n`);
    }catch(rollbackError){
      await writeFile(join(backupDir,'rollback-failed.txt'),`${rollbackError.stack||rollbackError}\n`);
    }
  }
  throw error;
}
