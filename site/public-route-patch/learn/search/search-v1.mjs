import Fuse from '/assets/vendor/fuse-7.1.0.min.mjs';

const input=document.querySelector('[data-search-input]');
const results=document.querySelector('[data-search-results]');
const status=document.querySelector('[data-search-status]');
const filters=[...document.querySelectorAll('[data-search-filter]')];
let documents=[];
let fuse=null;
let activeType='all';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=(v)=>String(v??'').trim().toLowerCase();

function buildFuse(){
  fuse=new Fuse(documents,{
    includeScore:true,
    shouldSort:true,
    ignoreLocation:true,
    threshold:.34,
    minMatchCharLength:2,
    keys:[
      {name:'title',weight:.42},
      {name:'keywords',weight:.28},
      {name:'summary',weight:.2},
      {name:'type',weight:.06},
      {name:'id',weight:.04}
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
  results.innerHTML=rows.length?rows.map(item=>`
    <article class="search-card">
      <div class="search-meta"><span>${esc(item.type)}</span><code>${esc(item.id)}</code></div>
      <h2><a href="${esc(item.route)}">${esc(item.title)}</a></h2>
      <p>${esc(item.summary)}</p>
      <div class="search-keywords">${(item.keywords||[]).slice(0,6).map(k=>`<span>${esc(k)}</span>`).join('')}</div>
      <a class="open-link" href="${esc(item.route)}">Open resource →</a>
    </article>`).join('')
    : '<div class="empty"><strong>No matching resource found.</strong><span>Try a broader term such as roots, VPD, pests, lighting, cloning, pH, EC, trichomes or breeding.</span></div>';
}

for(const button of filters){
  button.addEventListener('click',()=>{
    activeType=button.dataset.searchFilter;
    filters.forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
    render();
  });
}
input.addEventListener('input',render);

fetch('./search-index.json',{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error('Search index failed to load');return r.json()})
  .then(payload=>{
    documents=Array.isArray(payload?.documents)?payload.documents:[];
    buildFuse();
    const types=[...new Set(documents.map(x=>x.type).filter(Boolean))].sort();
    const filterHost=document.querySelector('[data-search-filters]');
    for(const type of types){
      const b=document.createElement('button');
      b.type='button'; b.dataset.searchFilter=type; b.setAttribute('aria-pressed','false'); b.textContent=type;
      b.addEventListener('click',()=>{
        activeType=type;
        [...filterHost.querySelectorAll('[data-search-filter]')].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
        render();
      });
      filterHost.append(b);
    }
    render();
  })
  .catch(error=>{
    console.error('[THC Education Search]',error);
    status.textContent='Search index could not load.';
    results.innerHTML='<div class="empty"><strong>Search is temporarily unavailable.</strong><span>Use the Learning Center, Encyclopedia, Atlases or Tools links above.</span></div>';
  });
