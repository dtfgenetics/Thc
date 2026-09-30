import Fuse from '/assets/vendor/fuse-7.1.0.min.mjs';
import {explainSearchMatch} from './thc-search-explain-v1.mjs';

const input=document.querySelector('[data-search-input]');
const results=document.querySelector('[data-search-results]');
const status=document.querySelector('[data-search-status]');
const filters=[...document.querySelectorAll('[data-search-filter]')];
let documents=[];
let fuse=null;
let activeType='all';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=(v)=>String(v??'').trim().toLowerCase();
function syncUrl(){
  const params=new URLSearchParams(location.search);
  const query=input.value.trim();
  if(query)params.set('q',query);else params.delete('q');
  if(activeType!=='all')params.set('type',activeType);else params.delete('type');
  const next=params.toString()?location.pathname+'?'+params.toString():location.pathname;
  history.replaceState(null,'',next);
}

function buildFuse(){
  fuse=new Fuse(documents,{
    includeScore:true,
    shouldSort:true,
    ignoreLocation:true,
    threshold:.34,
    minMatchCharLength:2,
    keys:[
      {name:'title',weight:.30},
      {name:'keywords',weight:.18},
      {name:'terms',weight:.12},
      {name:'synonyms',weight:.07},
      {name:'aliases',weight:.10},
      {name:'summary',weight:.08},
      {name:'objective',weight:.07},
      {name:'measurements',weight:.05},
      {name:'misconceptions',weight:.04},
      {name:'coreScience',weight:.03},
      {name:'cultivation',weight:.025},
      {name:'tools',weight:.015},
      {name:'type',weight:.01},
      {name:'id',weight:.005}
    ]
  });
}

function visibleDocs(){
  const q=input.value.trim();
  const base=q&&fuse?fuse.search(q,{limit:80}).map(row=>row.item):documents;
  return activeType==='all'?base:base.filter(item=>normalize(item.type)===normalize(activeType));
}

function render(){
  const rows=visibleDocs();
  const q=input.value.trim();
  status.textContent=q
    ? `${rows.length} result${rows.length===1?'':'s'} for “${q}”`
    : `${rows.length} education resource${rows.length===1?'':'s'} available`;
  results.innerHTML=rows.length?rows.map(item=>{const match=q?explainSearchMatch(item,q):null;return `
    <article class="search-card">
      <div class="search-meta"><span>${esc(item.type)}</span><code>${esc(item.id)}</code></div>
      <h2><a href="${esc(item.route)}">${esc(item.title)}</a></h2>
      <p>${esc(item.summary)}</p>
      ${match?`<p class="search-match"><strong>Why this matched:</strong> ${esc(match.label)} · ${esc(match.snippet)}</p>`:''}
      <div class="search-keywords">${(item.keywords||[]).slice(0,6).map(k=>`<span>${esc(k)}</span>`).join('')}</div>
      <a class="open-link" href="${esc(item.route)}">Open resource →</a>
    </article>`}).join('')
    : '<div class="empty"><strong>No matching resource found.</strong><span>Try a broader term such as roots, VPD, pests, lighting, cloning, pH, EC, trichomes or breeding.</span></div>';
}

for(const button of filters){
  button.addEventListener('click',()=>{
    activeType=button.dataset.searchFilter;
    filters.forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
    syncUrl();render();
  });
}
input.addEventListener('input',()=>{syncUrl();render()});

Promise.all([
  fetch('./search-index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Search index failed to load');return r.json()}),
  fetch('../encyclopedia/encyclopedia-index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Encyclopedia index failed to load');return r.json()})
]).then(([payload,encyclopedia])=>{
    documents=Array.isArray(payload?.documents)?payload.documents.slice():[];
    const seen=new Set(documents.map(x=>String(x.id)));
    for(const item of Array.isArray(encyclopedia?.lessons)?encyclopedia.lessons:[]){
      if(seen.has(String(item.id)))continue;
      documents.push({
        id:item.id,
        type:'Encyclopedia',
        title:item.title,
        route:item.route,
        summary:item.status==='published'
          ? (item.topic+' · '+item.primaryFormat)
          : (item.topic+' · catalogued entry; full lesson is still in review'),
        keywords:[...(item.keywords||[]),item.topic,item.primaryFormat,item.status].filter(Boolean),
        terms:item.terms||[],
        synonyms:item.synonyms||[],
        aliases:item.aliases||[],
        objective:item.objective||'',
        measurements:item.measurements||[],
        misconceptions:item.misconceptions||[],
        coreScience:item.coreScience||[],
        cultivation:item.cultivation||[],
        tools:item.tools||[]
      });
      seen.add(String(item.id));
    }
    buildFuse();
    const params=new URLSearchParams(location.search);
    const requestedQuery=params.get('q');
    const requestedType=params.get('type');
    if(requestedQuery)input.value=requestedQuery;
    const types=[...new Set(documents.map(x=>x.type).filter(Boolean))].sort();
    const filterHost=document.querySelector('[data-search-filters]');
    for(const type of types){
      const b=document.createElement('button');
      b.type='button'; b.dataset.searchFilter=type; b.setAttribute('aria-pressed','false'); b.textContent=type;
      b.addEventListener('click',()=>{
        activeType=type;
        [...filterHost.querySelectorAll('[data-search-filter]')].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
        syncUrl();render();
      });
      filterHost.append(b);
    }
    if(requestedType&&types.some(type=>normalize(type)===normalize(requestedType)))activeType=requestedType;
    const requestedButton=[...filterHost.querySelectorAll('[data-search-filter]')].find(x=>normalize(x.dataset.searchFilter)===normalize(activeType));
    if(requestedButton)[...filterHost.querySelectorAll('[data-search-filter]')].forEach(x=>x.setAttribute('aria-pressed',String(x===requestedButton)));
    render();
  })
  .catch(error=>{
    console.error('[THC Education Search]',error);
    status.textContent='Search index could not load.';
    results.innerHTML='<div class="empty"><strong>Search is temporarily unavailable.</strong><span>Use the Learning Center, Encyclopedia, Atlases or Tools links above.</span></div>';
  });
