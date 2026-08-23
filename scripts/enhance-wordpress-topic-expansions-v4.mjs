import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_TOPIC_EXPANSIONS_V4||'').toLowerCase()==='true';
const expansionPath=process.env.TOPIC_EXPANSION_V4_PATH||'site/wordpress/education/topic-expansions-v4.json';
const literaturePath=process.env.TOPIC_LITERATURE_PATH||'site/wordpress/education/topic-literature.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-topic-expansions-v4';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetch(`${site}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Topic-Expansion-V4/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
      if((response.status===429||response.status>=500)&&attempt<6){await sleep(attempt*1500);continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<6)await sleep(attempt*1500)}
  }
  throw last;
}

const expansions=JSON.parse(await readFile(expansionPath,'utf8'));
const literature=JSON.parse(await readFile(literaturePath,'utf8'));
if(expansions?.schemaVersion!==1||!expansions?.topics||Object.keys(expansions.topics).length<2) throw new Error('Topic expansion file is incomplete');
if(!Array.isArray(literature?.topics)) throw new Error('Canonical topic literature is incomplete');
const rules=[
  {id:'plant-biology',terms:['plant biology']},{id:'genetics-breeding',terms:['genetics','breeding']},{id:'lifecycle-propagation',terms:['lifecycle','propagation']},{id:'environment-vpd',terms:['environment','vpd']},{id:'lighting',terms:['lighting']},{id:'water-root-zone',terms:['water','root zone']},{id:'nutrition-media',terms:['nutrition','media']},{id:'training-canopy',terms:['training','canopy']},{id:'plant-health-ipm',terms:['plant health','ipm']},{id:'harvest-postharvest',terms:['harvest','post-harvest']},{id:'outdoor-cultivation',terms:['outdoor']},{id:'evidence-measurement',terms:['evidence','measurement']}
];
const used=new Set();
const normalized=literature.topics.map(topic=>{const hay=`${topic.id||''} ${topic.title||''}`.toLowerCase();const rule=rules.find(x=>!used.has(x.id)&&x.terms.some(term=>hay.includes(term)));if(!rule)return topic;used.add(rule.id);return{...topic,id:rule.id}});
const topicIndex=new Map(normalized.map(topic=>[topic.id,topic]));
for(const id of Object.keys(expansions.topics)) if(!topicIndex.has(id)) throw new Error(`${id}: no canonical topic route found`);

const styleId='dtf-learning-v4-expansion-style';
const css=`<style id="${styleId}">
.dtf-topic-expansion-v4{--x4-deep:#0a2517;--x4-green:#247548;--x4-gold:#d7b961;--x4-paper:#fffdf7;--x4-soft:#eef3ec;--x4-ink:#122d1d;--x4-muted:#5a6c60;--x4-line:#d8e2da;background:#fff;color:var(--x4-ink)}.dtf-topic-expansion-v4 *{box-sizing:border-box}.dtf-topic-expansion-v4 .x4-wrap{width:min(1200px,calc(100% - 36px));margin:auto;padding:62px 0}.dtf-topic-expansion-v4 .x4-head{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:end;margin-bottom:22px}.dtf-topic-expansion-v4 .x4-kicker{margin:0 0 8px;color:#7c682f;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.dtf-topic-expansion-v4 h2{margin:0;font-size:clamp(2.1rem,4vw,3.6rem);line-height:1;letter-spacing:-.045em}.dtf-topic-expansion-v4 .x4-intro{margin:0;color:var(--x4-muted);font-size:1.03rem;line-height:1.7}.dtf-topic-expansion-v4 .x4-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}.dtf-topic-expansion-v4 .x4-module{padding:25px;border-radius:22px;background:var(--x4-paper);border:1px solid var(--x4-line);box-shadow:0 11px 28px rgba(18,49,29,.055)}.dtf-topic-expansion-v4 .x4-module h3{margin:0 0 11px;font-size:1.35rem;line-height:1.18}.dtf-topic-expansion-v4 .x4-module p{margin:0;color:var(--x4-muted);line-height:1.7}.dtf-topic-expansion-v4 .x4-module p+p{margin-top:12px}.dtf-topic-expansion-v4 .x4-records{margin-top:18px;padding:16px;border-radius:16px;background:var(--x4-soft);border:1px solid #d9e5da}.dtf-topic-expansion-v4 .x4-records strong{display:block;margin-bottom:8px;color:#315c41;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}.dtf-topic-expansion-v4 .x4-records ul{margin:0;padding-left:19px}.dtf-topic-expansion-v4 .x4-records li{margin:6px 0;color:#465b4d;line-height:1.5}.dtf-topic-expansion-v4 .x4-note{margin-top:18px;padding:20px 22px;border-radius:20px;background:linear-gradient(145deg,#0a2517,#143b25);color:#fff}.dtf-topic-expansion-v4 .x4-note strong{color:#efd889}.dtf-topic-expansion-v4 .x4-note p{margin:0;color:#d3e0d6;line-height:1.65}
@media(max-width:900px){.dtf-topic-expansion-v4 .x4-head,.dtf-topic-expansion-v4 .x4-grid{grid-template-columns:1fr}}@media(max-width:620px){.dtf-topic-expansion-v4 .x4-wrap{width:min(100% - 28px,1200px);padding:48px 0}}
</style>`;

function block(id,item){
  const modules=item.sections.map(section=>`<article class="x4-module"><p class="x4-kicker">Advanced module</p><h3>${esc(section.heading)}</h3>${section.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="x4-records"><strong>Record these observations</strong><ul>${section.records.map(record=>`<li>${esc(record)}</li>`).join('')}</ul></div></article>`).join('');
  return `<!-- dtf-topic-expansion-v4:start --><section class="dtf-topic-expansion-v4" data-dtf-topic-expansion-v4="${esc(id)}"><div class="x4-wrap"><div class="x4-head"><div><p class="x4-kicker">Advanced subject depth</p><h2>${esc(item.title)}</h2></div><p class="x4-intro">${esc(item.intro)}</p></div><div class="x4-grid">${modules}</div><div class="x4-note"><p><strong>Use this as a comparison framework:</strong> preserve the conditions, measurements, and observations that produced each conclusion. Advanced cultivation decisions become more reliable when the record is detailed enough to compare one site, plant, or batch with another.</p></div></div></section><!-- dtf-topic-expansion-v4:end -->`;
}
function strip(content){return String(content||'').replace(new RegExp(`<style\\s+id=["']${styleId}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'gi'),'').replace(/<!-- dtf-topic-expansion-v4:start -->[\s\S]*?<!-- dtf-topic-expansion-v4:end -->\s*/gi,'')}
function insertBeforeVisuals(content,newBlock){
  const anchor='<section class="section soft"><div class="wrap"><div class="heading"><div><p class="eyebrow">Visual references</p>';
  const at=content.indexOf(anchor);
  if(at<0) throw new Error('Could not locate the V3 visual-reference section');
  return `${css}${content.slice(0,at)}${newBlock}\n${content.slice(at)}`;
}
async function getPage(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);if(!Array.isArray(rows)||rows.length!==1)throw new Error(`Expected one page for ${slug}`);return rows[0]}
const stamp=new Date().toISOString().replace(/[-:.]/g,'');const backupDir=join(backupRoot,`topic-expansions-v4-${stamp}`);await mkdir(backupDir,{recursive:true});
const results=[];
for(const [id,item] of Object.entries(expansions.topics)){
  const topic=topicIndex.get(id);const slug=String(topic.route||'').split('/').filter(Boolean).at(-1);if(!slug)throw new Error(`${id}: invalid route`);
  const page=await getPage(slug);let content=strip(rendered(page.content));
  if(!content.includes(`data-dtf-topic="${id}"`))throw new Error(`${id}: current page is not the expected V3 topic owner`);
  const next=insertBeforeVisuals(content,block(id,item));
  await writeFile(join(backupDir,`${id}-before.json`),`${JSON.stringify(page,null,2)}\n`);
  if(apply)await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
  results.push({id,route:topic.route,pageId:page.id,sections:item.sections.length});
}
const report={generatedAt:new Date().toISOString(),apply,topicCount:results.length,results};await writeFile(join(backupRoot,'topic-expansions-v4-report.json'),`${JSON.stringify(report,null,2)}\n`);await writeFile(join(backupDir,'topic-expansions-v4-report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
