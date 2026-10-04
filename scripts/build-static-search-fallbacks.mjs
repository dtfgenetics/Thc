import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const searchPagePath=path.join(root,'site/public-route-patch/learn/search/index.html');
const encyclopediaPagePath=path.join(root,'site/public-route-patch/learn/encyclopedia/index.html');
const searchIndexPath=path.join(root,'site/public-route-patch/learn/search/search-index.json');
const encyclopediaIndexPath=path.join(root,'site/public-route-patch/learn/encyclopedia/encyclopedia-index.json');

const SEARCH_START='<!-- DTF_STATIC_SEARCH_FALLBACK_START -->';
const SEARCH_END='<!-- DTF_STATIC_SEARCH_FALLBACK_END -->';
const ENC_START='<!-- DTF_STATIC_ENCYCLOPEDIA_FALLBACK_START -->';
const ENC_END='<!-- DTF_STATIC_ENCYCLOPEDIA_FALLBACK_END -->';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reEsc=v=>String(v).replace(/[.*+?^$()|[\]\\]/g,'\\$&');

function replaceBlock(file,start,end,html){
  let text=fs.readFileSync(file,'utf8');
  const pattern=new RegExp(reEsc(start)+'[\\s\\S]*?'+reEsc(end));
  if(!pattern.test(text))throw new Error('Static fallback markers missing in '+path.relative(root,file));
  text=text.replace(pattern,start+'\n'+html.trim()+'\n'+end);
  fs.writeFileSync(file,text);
}

const search=JSON.parse(fs.readFileSync(searchIndexPath,'utf8'));
const encyclopedia=JSON.parse(fs.readFileSync(encyclopediaIndexPath,'utf8'));
const docs=Array.isArray(search.documents)?search.documents:[];
const preferred=['Learning','Courses','Tool','Atlas','Terpene Atlas','Encyclopedia'];
const picked=[];
const seen=new Set();
for(const type of preferred){
  for(const row of docs.filter(x=>x.type===type).slice(0,type==='Encyclopedia'?12:6)){
    if(seen.has(row.route))continue;
    seen.add(row.route);picked.push(row);
  }
}
for(const row of docs){
  if(picked.length>=48)break;
  if(seen.has(row.route))continue;
  seen.add(row.route);picked.push(row);
}
const searchHtml=`
<section class="static-fallback" data-static-fallback aria-label="Browse education without search">
<div class="status"><strong>Browse immediately:</strong> these links are rendered into the page so the education system remains usable and crawlable even before the interactive search loads.</div>
<div class="grid" style="margin-top:14px">
${picked.map(item=>`<article class="search-card"><div class="search-meta"><span>${esc(item.type)}</span><code>${esc(item.id)}</code></div><h2><a href="${esc(item.route)}">${esc(item.title)}</a></h2><p>${esc(item.summary||'Teaching Healthy Cultivation resource.')}</p><a class="open-link" href="${esc(item.route)}">Open resource →</a></article>`).join('\n')}
</div>
</section>`;
replaceBlock(searchPagePath,SEARCH_START,SEARCH_END,searchHtml);

const topics=Array.isArray(encyclopedia.topics)?encyclopedia.topics:[];
const lessons=Array.isArray(encyclopedia.lessons)?encyclopedia.lessons.filter(x=>x.status==='published'):[];
const encHtml=`
<section class="static-fallback" data-static-fallback aria-label="Static encyclopedia directory">
<style>
.static-fallback-directory{margin:28px 0;padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--paper)}
.static-fallback-directory h2{margin:0 0 8px}.static-fallback-directory p{margin:0 0 14px;color:var(--muted)}
.static-topic-links{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.static-topic-links a{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;text-decoration:none;font-weight:800}
.static-lesson-list{columns:3 250px;column-gap:24px}.static-lesson-list a{display:block;break-inside:avoid;padding:5px 0;text-decoration:none;color:#176d39}.static-lesson-list code{color:#496153;font-size:.78em}
</style>
<div class="static-fallback-directory">
<h2>Browse the encyclopedia now</h2>
<p>The complete published directory is embedded in the page as ordinary links. Interactive search and filters enhance this directory when JavaScript loads.</p>
<div class="static-topic-links">${topics.map(t=>`<a href="/learn/encyclopedia/?topic=${Number(t.part)}">Part ${String(t.part).padStart(2,'0')} · ${esc(t.title)}</a>`).join('')}</div>
<div class="static-lesson-list">${lessons.map(item=>`<a href="${esc(item.route)}"><code>${esc(item.id)}</code></a>`).join('\n')}</div>
</div>
</section>`;
replaceBlock(encyclopediaPagePath,ENC_START,ENC_END,encHtml);

console.log(`Static education fallbacks built: ${picked.length} education links · ${topics.length} encyclopedia subjects · ${lessons.length} published encyclopedia lessons`);
