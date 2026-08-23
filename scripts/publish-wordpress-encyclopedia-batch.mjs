import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME;
const pass=process.env.WP_API_PASSWORD;
const input=process.env.ENCYCLOPEDIA_BATCH_FILE||'site/wordpress/education/encyclopedia/volume01-batch01.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-encyclopedia-production';
if(!user||!pass) throw new Error('Missing WordPress API credentials.');
const auth=Buffer.from(`${user}:${pass}`).toString('base64');
const data=JSON.parse(await readFile(input,'utf8'));
if(!Array.isArray(data.articles)||!data.articles.length) throw new Error('Encyclopedia batch has no articles.');

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slugify=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const list=a=>`<ul class="thc-list">${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const paired=(a,labelA='Observation',labelB='Correction')=>`<div class="thc-paired">${a.map(([a1,a2])=>`<article><strong>${esc(labelA)}:</strong> ${esc(a1)}<br><strong>${esc(labelB)}:</strong> ${esc(a2)}</article>`).join('')}</div>`;
const terms=a=>`<dl class="thc-terms">${a.map(([t,d])=>`<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`;
const records=a=>`<div class="thc-records">${a.map(([t,d])=>`<article><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('')}</div>`;

async function wp(endpoint,{method='GET',body}={}){
  const r=await fetch(`${site}/wp-json/wp/v2${endpoint}`,{
    method,
    headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json','Cache-Control':'no-cache'},
    body:body?JSON.stringify(body):undefined
  });
  const text=await r.text();
  let parsed; try{parsed=text?JSON.parse(text):null;}catch{parsed=text;}
  if(!r.ok) throw new Error(`${method} ${endpoint} failed ${r.status}: ${typeof parsed==='string'?parsed.slice(0,600):JSON.stringify(parsed).slice(0,600)}`);
  return parsed;
}

async function findPage(slug,parent=null){
  const rows=await wp(`/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  return rows.find(x=>parent===null||Number(x.parent)===Number(parent))||null;
}

const backups=[];
async function upsertPage({slug,title,parent,content,excerpt=''}){
  const existing=await findPage(slug,parent);
  if(existing) backups.push(existing);
  const payload={slug,title,status:'publish',parent,content,excerpt,comment_status:'closed'};
  return existing
    ? wp(`/pages/${existing.id}`,{method:'POST',body:payload})
    : wp('/pages',{method:'POST',body:payload});
}

const css=`<style>
.thc-ency{--green:#133c26;--leaf:#1d6b3a;--ink:#183524;--muted:#587064;--line:#dbe8df;--soft:#f4f8f5;color:var(--ink);background:#fff}
.thc-ency *{box-sizing:border-box}.thc-wrap{max-width:1120px;margin:auto;padding:0 20px}.thc-hero{background:linear-gradient(135deg,#0d2f1c,#194c2d);color:#fff;padding:58px 0 48px}.thc-kicker{font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#cce56f}.thc-hero h1{font-size:clamp(2.3rem,5vw,4.6rem);line-height:.98;margin:.25em 0}.thc-hero p{max-width:820px;font-size:1.08rem;line-height:1.75;color:#e0ece4}.thc-badge{display:inline-flex;gap:8px;align-items:center;background:#e9f4ec;border:1px solid #c9dfcf;color:#245a35;border-radius:999px;padding:8px 13px;font-weight:800;font-size:.86rem}.thc-content{padding:34px 0 60px}.thc-content h2{font-size:1.65rem;margin:2rem 0 .75rem}.thc-content p,.thc-list{line-height:1.78;color:#3d5a49}.thc-list{padding-left:1.25rem}.thc-terms,.thc-records,.thc-paired,.thc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px}.thc-terms>div,.thc-records article,.thc-paired article,.thc-card{background:var(--soft);border:1px solid var(--line);border-radius:16px;padding:17px}.thc-terms dt,.thc-records h3{font-weight:900;margin:0 0 5px}.thc-terms dd{margin:0;color:var(--muted);line-height:1.55}.thc-records h3{font-size:1rem}.thc-records p{margin:0}.thc-note{background:#f2f7e8;border-left:5px solid #9ab93c;padding:18px 20px;margin:24px 0;border-radius:0 14px 14px 0}.thc-nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.thc-btn{display:inline-block;padding:11px 16px;border-radius:999px;text-decoration:none!important;font-weight:900;background:#d6ec77;color:#15351f!important}.thc-btn.alt{background:#fff;color:#1b5b33!important;border:1px solid var(--line)}.thc-sources li{margin-bottom:.65rem}.thc-search{width:100%;padding:15px 17px;border:1px solid #bcd0c2;border-radius:14px;font-size:1rem;margin:12px 0 22px}.thc-card h2{margin:.25rem 0 .55rem;font-size:1.25rem}.thc-card p{margin:.4rem 0 1rem}.thc-id{font-weight:900;color:#1d6b3a;font-size:.84rem;letter-spacing:.06em}.thc-footerbar{background:#0e2e1b;color:#dbe8df;padding:32px 0}.thc-footerbar a{color:#d6ec77;font-weight:900}
@media(max-width:640px){.thc-hero{padding:42px 0 34px}.thc-content{padding-top:24px}}
</style>`;

function articleHtml(a){
  const prev=Number(a.id.slice(-3))-1, next=Number(a.id.slice(-3))+1;
  return `${css}<main class="thc-ency" data-thc-encyclopedia-id="${esc(a.id)}">
<section class="thc-hero"><div class="thc-wrap"><div class="thc-kicker">THC Cannabis Encyclopedia · ${esc(a.id)}</div><h1>${esc(a.title)}</h1><p>${esc(a.summary)}</p><div class="thc-nav"><a class="thc-btn" href="/learn/encyclopedia/">Browse Encyclopedia</a><a class="thc-btn alt" href="/learn/infographics/">Search Infographics</a></div></div></section>
<section class="thc-content"><div class="thc-wrap">
<p><span class="thc-badge">Controlled education content · review status tracked separately</span></p>
<div class="thc-note"><strong>Learning objective</strong><p>${esc(a.learningObjective)}</p></div>
<h2>Terms to know</h2>${terms(a.terms)}
<h2>Core science</h2>${a.coreScience.map(p=>`<p>${esc(p)}</p>`).join('')}
<h2>Why this matters in cultivation</h2>${list(a.cultivationRelevance)}
<h2>Measure and record</h2>${records(a.measureAndRecord)}
<h2>Common misconceptions</h2>${paired(a.misconceptions,'Claim','Correction')}
<h2>Evidence limits</h2><p>${esc(a.evidenceLimits)}</p>
<h2>Related encyclopedia topics</h2>${list(a.crossLinks)}
<h2>Source notes</h2><ul class="thc-list thc-sources">${a.sources.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
<div class="thc-note"><strong>Publication control</strong><p>This website derivative is tied to the controlled THC Education System. Claim-level review does not by itself mean independent lesson approval. Scientific, editorial, visual, accessibility, rights, and time-sensitive release controls remain governed by the project control workbooks.</p></div>
</div></section>
<section class="thc-footerbar"><div class="thc-wrap">Continue with the <a href="/learn/encyclopedia/">Encyclopedia index</a>, <a href="/learn/infographics/">searchable infographic library</a>, or the broader <a href="/learn/">THC Learning Center</a>.</div></section>
</main>`;
}

function indexHtml(articles){
  const cards=articles.map(a=>`<article class="thc-card" data-search="${esc(`${a.id} ${a.title} ${a.summary}`.toLowerCase())}"><div class="thc-id">${esc(a.id)}</div><h2>${esc(a.title)}</h2><p>${esc(a.summary)}</p><a class="thc-btn alt" href="/learn/encyclopedia/${esc(a.slug)}/">Read lesson →</a></article>`).join('');
  return `${css}<main class="thc-ency"><section class="thc-hero"><div class="thc-wrap"><div class="thc-kicker">Teaching Healthy Cultivation</div><h1>Cannabis Plant Science Encyclopedia</h1><p>The controlled 420-ID encyclopedia is publishing in verified blocks. Search the lessons already released to the website, then use the infographic library as supporting visual material inside the same topic system.</p><div class="thc-nav"><a class="thc-btn" href="/learn/infographics/">Search Infographics</a><a class="thc-btn alt" href="/learn/">Learning Center</a></div></div></section><section class="thc-content"><div class="thc-wrap"><label for="thc-ency-search"><strong>Search published encyclopedia lessons</strong></label><input class="thc-search" id="thc-ency-search" type="search" placeholder="Search by THC-ENC ID, title, or topic…" autocomplete="off"><div id="thc-ency-grid" class="thc-grid">${cards}</div><div class="thc-note"><strong>Controlled rollout</strong><p>The permanent architecture contains 420 encyclopedia IDs. Only visitor-verified website derivatives are shown here as released website pages. Review/approval state remains separate in project control.</p></div></div></section></main><script>(()=>{const q=document.getElementById('thc-ency-search'),cards=[...document.querySelectorAll('#thc-ency-grid .thc-card')];if(!q)return;q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();cards.forEach(c=>c.hidden=!!s&&!c.dataset.search.includes(s));});})();</script>`;
}

const now=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(backupRoot,now);
await mkdir(backupDir,{recursive:true});

const learn=await findPage('learn');
if(!learn) throw new Error('Canonical /learn/ WordPress page not found.');
const encyclopedia=await upsertPage({slug:'encyclopedia',title:'Cannabis Plant Science Encyclopedia',parent:learn.id,content:indexHtml(data.articles),excerpt:'Search the visitor-verified THC Cannabis Encyclopedia lessons published from the controlled 420-ID education system.'});

const published=[];
for(const a of data.articles){
  if(!/^THC-ENC-\d{3}$/.test(a.id)) throw new Error(`Invalid encyclopedia ID: ${a.id}`);
  if(a.slug!==slugify(a.id)) throw new Error(`Stable slug mismatch for ${a.id}: ${a.slug}`);
  const page=await upsertPage({slug:a.slug,title:`${a.id} — ${a.title}`,parent:encyclopedia.id,content:articleHtml(a),excerpt:a.summary});
  published.push({id:a.id,title:a.title,slug:a.slug,pageId:page.id,link:page.link});
}

await writeFile(path.join(backupDir,'pre-write-pages.json'),JSON.stringify(backups,null,2));
const report={batch:data.batch,source:data.source,index:{pageId:encyclopedia.id,link:encyclopedia.link},published,backupDir,generatedAt:new Date().toISOString()};
await writeFile(path.join(backupDir,'encyclopedia-publication-report.json'),JSON.stringify(report,null,2));
await writeFile(path.join(backupRoot,'latest-backup-path.txt'),backupDir+'\n');
console.log(JSON.stringify(report,null,2));
