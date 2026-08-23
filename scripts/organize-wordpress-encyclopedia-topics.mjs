import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME;
const pass=process.env.WP_API_PASSWORD;
const topicFile=process.env.ENCYCLOPEDIA_TOPIC_FILE||'configuration/encyclopedia-topics.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-encyclopedia-topics';
if(!user||!pass) throw new Error('Missing WordPress API credentials.');
const auth=Buffer.from(`${user}:${pass}`).toString('base64');
const config=JSON.parse(await readFile(topicFile,'utf8'));
if(config?.schemaVersion!==1||!Array.isArray(config.topics)||config.topics.length!==21) throw new Error('Topic map must contain 21 schemaVersion 1 topics.');

for(let i=0;i<config.topics.length;i++){
  const topic=config.topics[i];
  const expectedStart=i*20+1, expectedEnd=(i+1)*20;
  if(topic.part!==i+1||!topic.slug||!topic.title||topic.range?.[0]!==expectedStart||topic.range?.[1]!==expectedEnd) throw new Error(`Invalid topic map at part ${i+1}.`);
}

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const clean=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&#8211;/g,'–').replace(/&#8212;/g,'—').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const lessonNumber=slug=>Number(String(slug).match(/^thc-enc-(\d{3})$/)?.[1]||0);
const displayTitle=p=>clean(p.title?.rendered||p.title?.raw||'').replace(/^THC-ENC-\d{3}\s*[—–-]\s*/i,'');
const excerpt=p=>clean(p.excerpt?.rendered||p.excerpt?.raw||'');
const hasVisual=p=>/data-thc-lesson-visual-id=["']THC-ENC-\d{3}["']/i.test(String(p.content?.raw||p.content?.rendered||''));

async function request(endpoint,{method='GET',body}={}){
  const res=await fetch(`${site}/wp-json/wp/v2${endpoint}`,{method,headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},body:body?JSON.stringify(body):undefined});
  const text=await res.text(); let parsed;
  try{parsed=text?JSON.parse(text):null;}catch{parsed=text;}
  if(!res.ok) throw new Error(`${method} ${endpoint} failed ${res.status}: ${typeof parsed==='string'?parsed.slice(0,900):JSON.stringify(parsed).slice(0,900)}`);
  return parsed;
}
async function wp(endpoint,opts){return request(endpoint,opts);}
async function findPage(slug,parent=null){
  const rows=await wp(`/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  return (rows||[]).find(x=>parent===null||Number(x.parent)===Number(parent))||null;
}
async function allChildren(parent){
  const out=[];
  for(let page=1;;page++){
    const rows=await wp(`/pages?parent=${parent}&context=edit&per_page=100&page=${page}&orderby=slug&order=asc`);
    out.push(...rows);
    if(rows.length<100) break;
  }
  return out;
}

const css=`<style>
.thc-topics{--forest:#0d2f1c;--green:#174a2b;--leaf:#2b7a45;--lime:#d6ec77;--ink:#183524;--muted:#5d7367;--line:#d8e6dc;--soft:#f4f8f5;--white:#fff;color:var(--ink);background:#fff}.thc-topics *{box-sizing:border-box}.thc-wrap{max-width:1180px;margin:auto;padding:0 22px}.thc-topic-hero{padding:62px 0 50px;background:linear-gradient(135deg,#0b2919 0%,#16472b 62%,#215d37 100%);color:#fff}.thc-kicker{font-size:.78rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--lime)}.thc-topic-hero h1{max-width:900px;font-size:clamp(2.5rem,5.5vw,5rem);line-height:.98;margin:.18em 0}.thc-topic-hero p{max-width:820px;font-size:1.08rem;line-height:1.75;color:#e5eee8}.thc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.thc-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border-radius:999px;text-decoration:none!important;font-weight:900;background:var(--lime);color:#15351f!important}.thc-btn.alt{background:#fff;color:#205735!important;border:1px solid var(--line)}.thc-section{padding:38px 0}.thc-section.alt{background:var(--soft)}.thc-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px}.thc-section h2{font-size:clamp(1.65rem,3vw,2.35rem);margin:0}.thc-section-head p{margin:0;max-width:640px;color:var(--muted);line-height:1.6}.thc-topic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.thc-topic-card,.thc-article-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 8px 28px rgba(13,47,28,.06)}.thc-topic-card h3,.thc-article-card h3{margin:.3rem 0 .65rem;line-height:1.15}.thc-topic-card p,.thc-article-card p{color:var(--muted);line-height:1.62}.thc-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.82rem;font-weight:850;color:#306144}.thc-pill{display:inline-flex;border-radius:999px;padding:6px 9px;background:#eaf4ed;border:1px solid #d5e6da}.thc-pill.visual{background:#f1f6d9;border-color:#dbe69e;color:#506218}.thc-search{width:100%;font:inherit;padding:15px 17px;border:1px solid #b8ccbe;border-radius:14px;background:#fff;margin:12px 0 20px}.thc-topic-block{margin:0 0 28px}.thc-topic-block[hidden],.thc-article-card[hidden]{display:none!important}.thc-topic-link{color:#1c6336;font-weight:900;text-decoration:none}.thc-roadmap{display:flex;flex-wrap:wrap;gap:9px}.thc-roadmap span{background:#eef4ef;border:1px solid var(--line);border-radius:999px;padding:8px 11px;color:#456052;font-size:.86rem}.thc-count{font-size:clamp(2rem,4vw,3.6rem);font-weight:950;line-height:1;color:#174a2b}.thc-footerbar{padding:30px 0;background:#0d2f1c;color:#dce9df}.thc-footerbar a{color:var(--lime);font-weight:900}@media(max-width:700px){.thc-topic-hero{padding:44px 0 38px}.thc-section-head{align-items:start;flex-direction:column}}
</style>`;

function articleCard(p,topic){
  const n=lessonNumber(p.slug); const id=`THC-ENC-${String(n).padStart(3,'0')}`; const visual=hasVisual(p);
  const search=esc(`${id} ${displayTitle(p)} ${excerpt(p)} ${topic.title}`.toLowerCase());
  return `<article class="thc-article-card" data-search="${search}"><div class="thc-meta"><span class="thc-pill">${esc(topic.title)}</span>${visual?'<span class="thc-pill visual">Infographic included</span>':''}</div><h3>${esc(displayTitle(p))}</h3><p>${esc(excerpt(p))}</p><div class="thc-meta"><span>${esc(id)}</span></div><p><a class="thc-topic-link" href="/learn/encyclopedia/${esc(p.slug)}/">Read topic →</a></p></article>`;
}
function hubHtml(topic,articles){
  const cards=articles.map(p=>articleCard(p,topic)).join('');
  return `${css}<main class="thc-topics" data-thc-topic="${esc(topic.slug)}"><section class="thc-topic-hero"><div class="thc-wrap"><div class="thc-kicker">THC Plant Science · Topic Library</div><h1>${esc(topic.title)}</h1><p>${esc(topic.description)}</p><div class="thc-actions"><a class="thc-btn" href="/learn/encyclopedia/">All encyclopedia topics</a><a class="thc-btn alt" href="/learn/infographics/">Search infographics</a></div></div></section><section class="thc-section"><div class="thc-wrap"><div class="thc-section-head"><div><div class="thc-count">${articles.length}</div><h2>Published lessons</h2></div><p>These pages are organized here by subject. The permanent THC-ENC IDs remain stable behind the scenes even when a clearer display title is used.</p></div><label for="thc-topic-search"><strong>Search this topic</strong></label><input id="thc-topic-search" class="thc-search" type="search" placeholder="Search ${esc(topic.title)}…"><div id="thc-topic-grid" class="thc-topic-grid">${cards}</div></div></section><section class="thc-footerbar"><div class="thc-wrap">Continue through the <a href="/learn/encyclopedia/">full encyclopedia</a>, <a href="/learn/infographics/">visual library</a>, or <a href="/learn/">Learning Center</a>.</div></section></main><script>(()=>{const q=document.getElementById('thc-topic-search'),cards=[...document.querySelectorAll('#thc-topic-grid .thc-article-card')];if(!q)return;q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();cards.forEach(c=>c.hidden=!!s&&!c.dataset.search.includes(s));});})();</script>`;
}
function indexHtml(active,future,articlesByTopic){
  const topicCards=active.map(topic=>{const rows=articlesByTopic.get(topic.slug)||[];const visuals=rows.filter(hasVisual).length;return `<article class="thc-topic-card"><div class="thc-meta"><span class="thc-pill">${rows.length} published</span>${visuals?`<span class="thc-pill visual">${visuals} with infographic</span>`:''}</div><h3>${esc(topic.title)}</h3><p>${esc(topic.description)}</p><a class="thc-btn alt" href="/learn/encyclopedia/${esc(topic.slug)}/">Explore topic →</a></article>`;}).join('');
  const articleBlocks=active.map(topic=>{const rows=articlesByTopic.get(topic.slug)||[];return `<section class="thc-topic-block" data-topic-search="${esc(topic.title.toLowerCase())}"><div class="thc-section-head"><div><div class="thc-kicker" style="color:#2b7a45">${rows.length} published lessons</div><h2>${esc(topic.title)}</h2></div><a class="thc-topic-link" href="/learn/encyclopedia/${esc(topic.slug)}/">Open topic hub →</a></div><div class="thc-topic-grid">${rows.map(p=>articleCard(p,topic)).join('')}</div></section>`;}).join('');
  const futurePills=future.map(t=>`<span>${esc(t.title)}</span>`).join('');
  const total=[...articlesByTopic.values()].reduce((n,rows)=>n+rows.length,0);
  return `${css}<main class="thc-topics" data-thc-encyclopedia-topic-index="1"><section class="thc-topic-hero"><div class="thc-wrap"><div class="thc-kicker">Teaching Healthy Cultivation</div><h1>Cannabis Plant Science Encyclopedia</h1><p>Browse the encyclopedia by subject first, then search individual lessons. Display titles can evolve for clarity while permanent THC-ENC IDs keep every article, visual, reference, and future course link stable.</p><div class="thc-actions"><a class="thc-btn" href="#browse-by-topic">Browse by topic</a><a class="thc-btn alt" href="/learn/infographics/">Search infographics</a><a class="thc-btn alt" href="/learn/">Learning Center</a></div></div></section><section id="browse-by-topic" class="thc-section alt"><div class="thc-wrap"><div class="thc-section-head"><div><div class="thc-count">${total}</div><h2>Published lessons, organized by topic</h2></div><p>Start with the area you are trying to understand. Each topic hub combines companion literature and qualifying visuals without turning the article into an image-only page.</p></div><div class="thc-topic-grid">${topicCards}</div></div></section><section class="thc-section"><div class="thc-wrap"><label for="thc-ency-topic-search"><strong>Search all published encyclopedia lessons</strong></label><input id="thc-ency-topic-search" class="thc-search" type="search" placeholder="Search roots, germination, media, anatomy, THC-ENC ID…">${articleBlocks}</div></section><section class="thc-section alt"><div class="thc-wrap"><div class="thc-section-head"><h2>Encyclopedia roadmap</h2><p>The controlled architecture contains 21 subject areas and 420 permanent lesson IDs. Additional topics appear here as their literature passes the publication lane.</p></div><div class="thc-roadmap">${futurePills}</div></div></section><section class="thc-footerbar"><div class="thc-wrap">Use the <a href="/learn/infographics/">searchable infographic library</a> for visual support, or return to the <a href="/learn/">THC Learning Center</a>.</div></section></main><script>(()=>{const q=document.getElementById('thc-ency-topic-search'),cards=[...document.querySelectorAll('.thc-article-card')],blocks=[...document.querySelectorAll('.thc-topic-block')];if(!q)return;q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();cards.forEach(c=>c.hidden=!!s&&!c.dataset.search.includes(s));blocks.forEach(b=>b.hidden=!!s&&![...b.querySelectorAll('.thc-article-card')].some(c=>!c.hidden));});})();</script>`;
}

const learn=await findPage('learn'); if(!learn) throw new Error('Canonical /learn/ page not found.');
const encyclopedia=await findPage('encyclopedia',learn.id); if(!encyclopedia) throw new Error('Canonical /learn/encyclopedia/ page not found.');
const children=await allChildren(encyclopedia.id);
const articles=children.filter(p=>/^thc-enc-\d{3}$/.test(p.slug)).sort((a,b)=>lessonNumber(a.slug)-lessonNumber(b.slug));
if(articles.length<57) throw new Error(`Expected at least 57 published encyclopedia lessons, found ${articles.length}.`);

const articlesByTopic=new Map();
for(const topic of config.topics){articlesByTopic.set(topic.slug,articles.filter(p=>{const n=lessonNumber(p.slug);return n>=topic.range[0]&&n<=topic.range[1];}));}
const active=config.topics.filter(t=>(articlesByTopic.get(t.slug)||[]).length>0);
const future=config.topics.filter(t=>(articlesByTopic.get(t.slug)||[]).length===0);
if(active.length<3) throw new Error(`Expected at least 3 active topic areas, found ${active.length}.`);

const now=new Date().toISOString().replace(/[:.]/g,'-'); const backupDir=path.join(backupRoot,now); await mkdir(backupDir,{recursive:true});
const backups=[]; const created=[]; const updated=[];
async function upsert({slug,title,content,excerptText}){
  const existing=await findPage(slug,encyclopedia.id);
  if(existing) backups.push({id:existing.id,slug:existing.slug,title:existing.title?.raw||existing.title?.rendered||'',content:existing.content?.raw||'',excerpt:existing.excerpt?.raw||'',status:existing.status});
  const payload={slug,title,status:'publish',parent:encyclopedia.id,content,excerpt:excerptText,comment_status:'closed'};
  const page=existing?await wp(`/pages/${existing.id}`,{method:'POST',body:payload}):await wp('/pages',{method:'POST',body:payload});
  if(!existing) created.push(page.id); updated.push({id:page.id,slug:page.slug,link:page.link}); return page;
}

try{
  for(const topic of active){await upsert({slug:topic.slug,title:topic.title,content:hubHtml(topic,articlesByTopic.get(topic.slug)),excerptText:`Browse published THC encyclopedia lessons for ${topic.title}.`});}
  backups.push({id:encyclopedia.id,slug:encyclopedia.slug,title:encyclopedia.title?.raw||encyclopedia.title?.rendered||'',content:encyclopedia.content?.raw||'',excerpt:encyclopedia.excerpt?.raw||'',status:encyclopedia.status});
  await wp(`/pages/${encyclopedia.id}`,{method:'POST',body:{title:'Cannabis Plant Science Encyclopedia',status:'publish',content:indexHtml(active,future,articlesByTopic),excerpt:`Browse ${articles.length} published THC plant-science lessons by topic.`,comment_status:'closed'}});
  updated.push({id:encyclopedia.id,slug:'encyclopedia',link:encyclopedia.link});
}catch(error){
  for(const b of [...backups].reverse()){
    try{await wp(`/pages/${b.id}`,{method:'POST',body:{title:b.title,content:b.content,excerpt:b.excerpt,status:b.status}});}catch{}
  }
  for(const id of [...created].reverse()){
    try{await wp(`/pages/${id}?force=true`,{method:'DELETE'});}catch{}
  }
  throw error;
}

await writeFile(path.join(backupDir,'pre-write-pages.json'),JSON.stringify(backups,null,2));
const report={articleCount:articles.length,activeTopics:active.map(t=>({part:t.part,slug:t.slug,title:t.title,lessonCount:articlesByTopic.get(t.slug).length,visualCount:articlesByTopic.get(t.slug).filter(hasVisual).length})),futureTopics:future.map(t=>({part:t.part,slug:t.slug,title:t.title})),updated,created,backupDir,generatedAt:new Date().toISOString()};
await writeFile(path.join(backupDir,'encyclopedia-topic-organization-report.json'),JSON.stringify(report,null,2));
await writeFile(path.join(backupRoot,'latest-backup-path.txt'),backupDir+'\n');
console.log(JSON.stringify(report,null,2));
