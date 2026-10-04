import Fuse from '/assets/vendor/fuse-7.1.0.min.mjs';
import {explainSearchMatch} from '../search/thc-search-explain-v1.mjs';

const q=document.querySelector('[data-q]');
const clear=document.querySelector('[data-clear]');
const topicsHost=document.querySelector('[data-topics]');
const library=document.querySelector('[data-library]');
const statusText=document.querySelector('[data-status-text]');
const formatHost=document.querySelector('[data-format-filters]');
const title=document.querySelector('[data-library-title]');
const visibleStat=document.querySelector('[data-stat-visible]');
const publishedStat=document.querySelector('[data-stat-published]');
const totalStat=document.querySelector('[data-stat-total]');
const subjectStat=document.querySelector('[data-stat-subjects]');
const subjectCount=document.querySelector('[data-subject-count]');
const resetAll=document.querySelector('[data-reset-all]');

let payload={topics:[],lessons:[]};
let fuse=null;
let activeStatus='all';
let activeFormat='all';
let activePart=null;
let lastResultCount=0;
const PAGE_SIZE=60;
let renderLimit=PAGE_SIZE;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=v=>String(v??'').trim().toLowerCase();
function syncUrl(){
 const params=new URLSearchParams(location.search);
 const query=q.value.trim();
 if(query)params.set('q',query);else params.delete('q');
 if(activePart)params.set('topic',String(activePart));else params.delete('topic');
 if(activeStatus!=='all')params.set('status',activeStatus);else params.delete('status');
 if(activeFormat!=='all')params.set('format',activeFormat);else params.delete('format');
 params.delete('lesson');
 const next=params.toString()?location.pathname+'?'+params.toString():location.pathname;
 history.replaceState(null,'',next);
}

function setPressed(host,button){[...host.querySelectorAll('button')].forEach(x=>x.setAttribute('aria-pressed',String(x===button)))}

function filtered(){
 const query=q.value.trim();
 let rows=query&&fuse?fuse.search(query,{limit:Math.max(1000,payload.lessons.length)}).map(x=>x.item):payload.lessons.slice();
 if(activePart)rows=rows.filter(x=>x.part===activePart);
 if(activeStatus!=='all')rows=rows.filter(x=>x.status===activeStatus);
 if(activeFormat!=='all')rows=rows.filter(x=>normalize(x.primaryFormat)===normalize(activeFormat));
 return rows;
}
function renderTopics(){
 topicsHost.innerHTML=payload.topics.map(t=>'<button class="topic" type="button" data-part="'+t.part+'" aria-pressed="'+String(activePart===Number(t.part))+'"><span class="topic-num">Part '+String(t.part).padStart(2,'0')+' · '+t.range[0]+'–'+t.range[1]+'</span><h3>'+esc(t.title)+'</h3><p>'+esc(t.description)+'</p><div class="topic-meta">'+t.publishedCount+' published · '+t.count+' registered</div></button>').join('');
 for(const button of topicsHost.querySelectorAll('[data-part]')){
  button.addEventListener('click',()=>{
   const part=Number(button.dataset.part);
   activePart=activePart===part?null:part;renderLimit=PAGE_SIZE;
   renderTopics();syncUrl();render();
   document.querySelector('[data-library-title]')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
 }
}
function renderFormats(){
 const formats=[...new Set(payload.lessons.map(x=>x.primaryFormat).filter(Boolean))].sort();
 formatHost.innerHTML='<button class="chip" type="button" data-format="all" aria-pressed="true">All formats</button>'+formats.map(x=>'<button class="chip" type="button" data-format="'+esc(x)+'" aria-pressed="false">'+esc(x)+'</button>').join('');
 for(const button of formatHost.querySelectorAll('[data-format]')){
  button.addEventListener('click',()=>{activeFormat=button.dataset.format;renderLimit=PAGE_SIZE;setPressed(formatHost,button);syncUrl();render()});
 }
}
function render(){
 const rows=filtered();
 const visibleRows=rows.slice(0,renderLimit);
 lastResultCount=rows.length;
 visibleStat.textContent=String(rows.length);
 library.setAttribute('aria-busy','false');
 clear.disabled=!q.value.trim()&&activePart===null&&activeStatus==='all'&&activeFormat==='all';
 if(resetAll)resetAll.hidden=clear.disabled;
 const topic=activePart?payload.topics.find(x=>x.part===activePart):null;
 title.textContent=topic?topic.title:(q.value.trim()?'Search results':`All ${payload.lessons.length} topics`);
 const parts=[];
 if(q.value.trim())parts.push('query “'+q.value.trim()+'”');
 if(topic)parts.push(topic.title);
 if(activeStatus!=='all')parts.push(activeStatus==='published'?'published only':'in review only');
 if(activeFormat!=='all')parts.push(activeFormat);
 statusText.textContent='Showing '+visibleRows.length+' of '+rows.length+' matching entr'+(rows.length===1?'y':'ies')+' · '+payload.lessons.length+' total'+(parts.length?' · '+parts.join(' · '):'');
 library.innerHTML=rows.length?visibleRows.map(item=>{
  const published=item.status==='published';
  const summary=item.objective||('Reference topic in '+item.topic+'.');
  const match=q.value.trim()?explainSearchMatch(item,q.value.trim()):null;
  const why=match?'<p class="match-reason"><strong>Why this matched:</strong> '+esc(match.label)+' · '+esc(match.snippet)+'</p>':'';
  const ev=item.evidence||{};
  const sourceTitles=Array.isArray(ev.sourceTitles)?ev.sourceTitles:[];
  const evidence=published&&Number(ev.claimCount||0)>0
   ?'<p class="evidence-note"><strong>Evidence mapped:</strong> '+Number(ev.claimCount)+' claim'+(Number(ev.claimCount)===1?'':'s')+(sourceTitles.length?' · '+sourceTitles.slice(0,2).map(esc).join(' · '):'')+'</p>'
   :'';
  return '<article class="lesson"><div class="lesson-top"><span class="id">'+esc(item.id)+'</span><span class="badge '+(published?'':'review')+'">'+(published?'Published':'In review')+'</span></div><h3>'+esc(item.title)+'</h3><p>'+esc(summary)+'</p>'+why+evidence+'<div class="meta"><span>'+esc(item.topic)+'</span><span>'+esc(item.primaryFormat)+'</span>'+(item.teachingVisual?'<span>'+esc(item.teachingVisual)+'</span>':'')+'</div>'+(published?'<a href="'+esc(item.route)+'" aria-label="Open '+esc(item.id)+' '+esc(item.title)+'">Open lesson →</a>':'<span class="disabled">Registered · full lesson not yet released</span>')+'</article>'
 }).join('')+(rows.length>visibleRows.length?'<div class="more-results"><button type="button" data-load-more>Show '+Math.min(PAGE_SIZE,rows.length-visibleRows.length)+' more</button></div>':''):'<div class="empty"><strong>No matching encyclopedia entry.</strong><p>Try a broader term, remove one of the filters, or search by symptom, scientific term, measurement, pest, process, or lesson ID.</p><button type="button" data-empty-reset>Show all encyclopedia entries</button></div>';
 const emptyReset=library.querySelector('[data-empty-reset]');if(emptyReset)emptyReset.addEventListener('click',resetFilters);
 const loadMore=library.querySelector('[data-load-more]');if(loadMore)loadMore.addEventListener('click',()=>{renderLimit+=PAGE_SIZE;render();});
}
document.querySelector('[data-status-filters]').addEventListener('click',e=>{
 const b=e.target.closest('[data-status]');if(!b)return;activeStatus=b.dataset.status;renderLimit=PAGE_SIZE;setPressed(e.currentTarget,b);syncUrl();render();
});
q.addEventListener('input',()=>{renderLimit=PAGE_SIZE;syncUrl();render()});
function resetFilters(){
 q.value='';activePart=null;activeStatus='all';activeFormat='all';renderLimit=PAGE_SIZE;
 const statusAll=document.querySelector('[data-status="all"]');if(statusAll)setPressed(document.querySelector('[data-status-filters]'),statusAll);
 renderFormats();renderTopics();syncUrl();render();q.focus();
}
clear.addEventListener('click',resetFilters);
if(resetAll)resetAll.addEventListener('click',resetFilters);

const params=new URLSearchParams(location.search);const requested=params.get('lesson');const requestedQuery=params.get('q');const requestedTopic=Number(params.get('topic'));const requestedStatus=params.get('status');const requestedFormat=params.get('format');
const loadIndex=window.__THC_ENCYCLOPEDIA_INDEX__?Promise.resolve(window.__THC_ENCYCLOPEDIA_INDEX__):fetch('./encyclopedia-index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Index failed to load');return r.json()});
loadIndex.then(data=>{
 payload=data;
 document.querySelectorAll('[data-static-fallback]').forEach(node=>node.hidden=true);
 totalStat.textContent=String(payload.lessons.length);
 publishedStat.textContent=String(payload.lessons.filter(x=>x.status==='published').length);
 subjectStat.textContent=String(payload.topics.length);
 subjectCount.textContent=String(payload.topics.length);
 fuse=new Fuse(payload.lessons,{
 includeScore:true,
 shouldSort:true,
 ignoreLocation:true,
 threshold:.3,
 minMatchCharLength:2,
 keys:[
  {name:'title',weight:.26},
  {name:'id',weight:.12},
  {name:'terms',weight:.12},
  {name:'synonyms',weight:.08},
  {name:'aliases',weight:.10},
  {name:'objective',weight:.09},
  {name:'topic',weight:.07},
  {name:'measurements',weight:.06},
  {name:'misconceptions',weight:.05},
  {name:'coreScience',weight:.05},
  {name:'cultivation',weight:.04},
  {name:'tools',weight:.025},
  {name:'evidence.sourceTitles',weight:.035},
  {name:'evidence.claimTypes',weight:.02},
  {name:'keywords',weight:.025}
 ]
});
 renderTopics();renderFormats();
 if(requested){q.value=requested}
 else if(requestedQuery){q.value=requestedQuery}
 if(Number.isInteger(requestedTopic)&&payload.topics.some(x=>Number(x.part)===requestedTopic))activePart=requestedTopic;
 if(['published','catalogued-review'].includes(requestedStatus))activeStatus=requestedStatus;
 if(requestedFormat&&payload.lessons.some(x=>normalize(x.primaryFormat)===normalize(requestedFormat)))activeFormat=requestedFormat;
 renderTopics();
 const statusButton=document.querySelector('[data-status="'+activeStatus+'"]');if(statusButton)setPressed(document.querySelector('[data-status-filters]'),statusButton);
 const formatButton=[...formatHost.querySelectorAll('[data-format]')].find(x=>normalize(x.dataset.format)===normalize(activeFormat));if(formatButton)setPressed(formatHost,formatButton);
 render();
}).catch(error=>{console.error('[THC encyclopedia]',error);library.setAttribute('aria-busy','false');statusText.textContent='Interactive filtering could not load. The static encyclopedia directory remains available below.';library.innerHTML='<div class="empty"><strong>Interactive encyclopedia filtering unavailable.</strong><p>Use the static directory below or return to the Learning Center.</p></div>'});
