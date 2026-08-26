import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const validateOnly = process.argv.includes('--validate-only');
const apply = String(process.env.APPLY_OUTDOOR_QUANT_V1 || '').toLowerCase() === 'true';
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-outdoor-quantification-v1';
const file = 'site/wordpress/education/outdoor-quantification-v1.json';
const start = '<!-- dtf-outdoor-quantification-v1:start -->';
const end = '<!-- dtf-outdoor-quantification-v1:end -->';
const baseEnd = '<!-- dtf-outdoor-v6:end -->';

const esc = (v='') => String(v)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

const rendered = v => typeof v === 'string' ? v : (v?.raw || v?.rendered || '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = message => { throw new Error(message); };

async function loadJson(){
  return JSON.parse(await readFile(join(ROOT, file), 'utf8'));
}

function validateData(data){
  if(data?.schemaVersion !== 1 || data?.id !== 'outdoor-quantification-v1') fail('Invalid quantification schema/id');
  if(data.route !== '/learn/outdoor/') fail(`Unexpected route ${data.route}`);
  if(!data.title || !data.purpose) fail('Missing title/purpose');
  if(!Array.isArray(data.measurementPrinciples) || data.measurementPrinciples.length < 4) fail('Expected at least four measurement principles');
  if(!Array.isArray(data.calculations) || data.calculations.length < 4) fail('Expected at least four calculation/context helpers');
  if(!Array.isArray(data.sections) || data.sections.length < 1) fail('Expected at least one completed section');

  const chapterIds = new Set();
  let subtopics = 0;
  let metrics = 0;
  for(const section of data.sections){
    if(!section.chapterId || chapterIds.has(section.chapterId)) fail(`Missing/duplicate chapterId ${section.chapterId}`);
    chapterIds.add(section.chapterId);
    if(!section.chapterTitle || !section.learnerQuestion) fail(`${section.chapterId}: missing chapter metadata`);
    if(!Array.isArray(section.sourceContext) || section.sourceContext.length < 1) fail(`${section.chapterId}: source context required`);
    if(!Array.isArray(section.subtopics) || section.subtopics.length !== 4) fail(`${section.chapterId}: expected exactly four subtopics`);
    if(!section.fieldWorksheet?.title || !Array.isArray(section.fieldWorksheet.fields) || section.fieldWorksheet.fields.length < 8) fail(`${section.chapterId}: incomplete field worksheet`);

    const ids = new Set();
    for(const topic of section.subtopics){
      subtopics += 1;
      if(!topic.id || ids.has(topic.id)) fail(`${section.chapterId}: duplicate/missing subtopic id ${topic.id}`);
      ids.add(topic.id);
      if(!topic.lessonTitle || !topic.goal || !topic.decisionRule || !topic.confidenceCheck) fail(`${section.chapterId}/${topic.id}: missing required text`);
      if(!Array.isArray(topic.measure) || topic.measure.length < 3) fail(`${section.chapterId}/${topic.id}: expected at least three measurements`);
      if(!Array.isArray(topic.record) || topic.record.length < 5) fail(`${section.chapterId}/${topic.id}: record list too thin`);
      if(!Array.isArray(topic.compare) || topic.compare.length < 2) fail(`${section.chapterId}/${topic.id}: compare list too thin`);
      if(!Array.isArray(topic.interpret) || topic.interpret.length < 2) fail(`${section.chapterId}/${topic.id}: interpretation list too thin`);
      for(const m of topic.measure){
        metrics += 1;
        if(!m.metric || !m.unit || !m.method || !m.frequency) fail(`${section.chapterId}/${topic.id}: incomplete measurement row`);
      }
    }
  }

  const raw = JSON.stringify(data).toLowerCase();
  const forbidden = [
    /universal safe (?:pollen )?(?:distance|radius)/,
    /guarantees? zero pollen/,
    /rain(?:fall)? (?:total|amount) (?:equals|is) root-zone recharge/,
    /hours? of (?:direct )?sun (?:equals|is) dli/
  ];
  for(const pattern of forbidden) if(pattern.test(raw)) fail(`Forbidden overclaim matched ${pattern}`);

  return {
    sections: data.sections.length,
    subtopics,
    metrics,
    principles: data.measurementPrinciples.length,
    calculations: data.calculations.length
  };
}

function list(items){
  return `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function measureTable(rows){
  return `<div class="oqv1-table-wrap"><table class="oqv1-table"><thead><tr><th>Metric</th><th>Unit</th><th>Method</th><th>Repeat</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.metric)}</strong></td><td>${esc(row.unit)}</td><td>${esc(row.method)}</td><td>${esc(row.frequency)}</td></tr>`).join('')}</tbody></table></div>`;
}

function sectionHtml(section){
  return `<section class="oqv1-section" id="oqv1-${esc(section.chapterId)}" data-oqv1-chapter="${esc(section.chapterId)}">
    <div class="oqv1-section-head">
      <p class="oqv1-kicker">Field Lab ${String(section.chapterNumber).padStart(2,'0')} · Quantify the chapter</p>
      <h3>${esc(section.chapterTitle)}</h3>
      <p class="oqv1-question">${esc(section.learnerQuestion)}</p>
    </div>

    <div class="oqv1-subtopics">
      ${section.subtopics.map((topic,index) => `<article class="oqv1-topic" data-oqv1-subtopic="${esc(topic.id)}">
        <div class="oqv1-topic-head"><span>${String(index+1).padStart(2,'0')}</span><div><h4>${esc(topic.lessonTitle)}</h4><p>${esc(topic.goal)}</p></div></div>
        <h5>What to measure</h5>
        ${measureTable(topic.measure)}
        <div class="oqv1-grid">
          <div><h5>Record</h5>${list(topic.record)}</div>
          <div><h5>Compare</h5>${list(topic.compare)}</div>
          <div><h5>Interpret</h5>${list(topic.interpret)}</div>
        </div>
        <div class="oqv1-rule"><strong>Decision rule</strong><p>${esc(topic.decisionRule)}</p></div>
        <div class="oqv1-confidence"><strong>Confidence check</strong><p>${esc(topic.confidenceCheck)}</p></div>
      </article>`).join('')}
    </div>

    <div class="oqv1-worksheet">
      <div><p class="oqv1-kicker">Field worksheet</p><h4>${esc(section.fieldWorksheet.title)}</h4><p>${esc(section.fieldWorksheet.outcome)}</p></div>
      ${list(section.fieldWorksheet.fields)}
    </div>

    <div class="oqv1-evidence">
      <p class="oqv1-kicker">Evidence context</p>
      ${section.sourceContext.map(source => `<article><span>${esc(source.id)} · ${esc(source.type)}</span><strong>${esc(source.citation)}</strong><p>${esc(source.supports)}</p></article>`).join('')}
    </div>
  </section>`;
}

function buildBlock(data, pageId){
  return `${start}<style id="dtf-outdoor-quantification-v1-style">
body.page-id-${pageId} .oqv1{--oq-deep:#071b16;--oq-green:#1f704f;--oq-gold:#b69945;--oq-cream:#f7f4ea;--oq-paper:#fffdf8;--oq-ink:#143027;--oq-muted:#52665e;--oq-line:#d7e2dc;background:linear-gradient(180deg,#f7f4ea 0,#f1f5f2 100%);color:var(--oq-ink);padding:58px 0 74px}.oqv1 *{box-sizing:border-box}.oqv1-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.oqv1-hero{display:grid;grid-template-columns:1.15fr .85fr;gap:24px;align-items:start;margin-bottom:28px}.oqv1-kicker{margin:0 0 7px;color:#78672f;font-size:.7rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.oqv1 h2{margin:0;font-size:clamp(2rem,4vw,3.7rem);line-height:1;letter-spacing:-.04em}.oqv1 h3{margin:0;font-size:clamp(1.7rem,3vw,2.6rem);letter-spacing:-.03em}.oqv1 h4{margin:0;font-size:1.08rem}.oqv1 h5{margin:18px 0 8px;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:#476154}.oqv1 p,.oqv1 li,.oqv1 td{line-height:1.55;color:var(--oq-muted)}.oqv1-intro{font-size:1.03rem}.oqv1-principles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.oqv1-principles article,.oqv1-calc article{background:var(--oq-paper);border:1px solid var(--oq-line);border-radius:14px;padding:13px}.oqv1-principles strong{display:block;margin-bottom:4px}.oqv1-principles p{margin:0;font-size:.9rem}.oqv1-calc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:16px 0 42px}.oqv1-calc code{display:block;margin:7px 0;padding:7px;border-radius:8px;background:#edf3ef;white-space:normal;color:#24493a}.oqv1-calc p{font-size:.86rem;margin:4px 0}.oqv1-boundary{font-size:.78rem!important;color:#78672f!important}.oqv1-section{border-top:1px solid var(--oq-line);padding-top:38px}.oqv1-question{font-size:1.05rem;max-width:820px}.oqv1-subtopics{display:grid;gap:14px;margin-top:18px}.oqv1-topic{background:var(--oq-paper);border:1px solid var(--oq-line);border-radius:19px;padding:20px;box-shadow:0 8px 24px rgba(20,48,39,.04)}.oqv1-topic-head{display:flex;gap:12px;align-items:flex-start}.oqv1-topic-head>span{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:10px;background:#e7f0eb;color:#3b6754;font-size:.7rem;font-weight:950}.oqv1-topic-head p{margin:5px 0 0}.oqv1-table-wrap{overflow-x:auto;border:1px solid var(--oq-line);border-radius:12px}.oqv1-table{width:100%;border-collapse:collapse;min-width:760px}.oqv1-table th,.oqv1-table td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #e6ece8}.oqv1-table th{background:#edf3ef;color:#355344;font-size:.73rem;text-transform:uppercase;letter-spacing:.05em}.oqv1-table tr:last-child td{border-bottom:0}.oqv1-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.oqv1-grid>div{padding:12px;border-radius:12px;background:#f4f7f5;border:1px solid #e0e8e3}.oqv1-grid ul,.oqv1-worksheet ul{margin:0;padding-left:1.15rem}.oqv1-grid li,.oqv1-worksheet li{margin:5px 0;font-size:.9rem}.oqv1-rule,.oqv1-confidence{margin-top:10px;padding:12px 14px;border-radius:12px}.oqv1-rule{background:#ecf4ef;border-left:4px solid var(--oq-green)}.oqv1-confidence{background:#fff8e9;border-left:4px solid var(--oq-gold)}.oqv1-rule p,.oqv1-confidence p{margin:4px 0 0}.oqv1-worksheet{display:grid;grid-template-columns:.8fr 1.2fr;gap:18px;margin:18px 0;padding:20px;border-radius:18px;background:var(--oq-deep);color:#fff}.oqv1-worksheet h4{font-size:1.3rem}.oqv1-worksheet p,.oqv1-worksheet li{color:#d3dfda}.oqv1-evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.oqv1-evidence>.oqv1-kicker{grid-column:1/-1}.oqv1-evidence article{padding:12px;border:1px solid var(--oq-line);border-radius:12px;background:#fff}.oqv1-evidence span{display:block;color:#78672f;font-size:.66rem;font-weight:950;text-transform:uppercase}.oqv1-evidence strong{display:block;margin:4px 0;font-size:.86rem}.oqv1-evidence p{margin:0;font-size:.88rem}@media(max-width:900px){.oqv1-hero,.oqv1-worksheet{grid-template-columns:1fr}.oqv1-calc{grid-template-columns:repeat(2,minmax(0,1fr))}.oqv1-grid{grid-template-columns:1fr}}@media(max-width:620px){.oqv1-principles,.oqv1-calc,.oqv1-evidence{grid-template-columns:1fr}.oqv1{padding-top:44px}.oqv1-topic{padding:15px}}
</style><section class="oqv1" data-dtf-outdoor-quantification-v1="true"><div class="oqv1-wrap">
  <div class="oqv1-hero"><div><p class="oqv1-kicker">Teaching Healthy Cultivation · Field measurement layer</p><h2>Turn outdoor observations into evidence.</h2><p class="oqv1-intro">${esc(data.purpose)}</p></div><div class="oqv1-principles">${data.measurementPrinciples.map(p => `<article><strong>${esc(p.title)}</strong><p>${esc(p.detail)}</p></article>`).join('')}</div></div>
  <div class="oqv1-calc">${data.calculations.map(c => `<article><strong>${esc(c.name)}</strong><code>${esc(c.formula)}</code><p>${esc(c.use)}</p><p class="oqv1-boundary">${esc(c.boundary)}</p></article>`).join('')}</div>
  ${data.sections.map(sectionHtml).join('')}
</div></section>${end}`;
}

function stripExisting(content){
  const a = content.indexOf(start);
  if(a < 0) return content;
  const b = content.indexOf(end, a);
  if(b < 0) fail('Found quantification start marker without end marker');
  return content.slice(0,a) + content.slice(b + end.length);
}

async function request(path, options={}){
  let last;
  for(let attempt=1; attempt<=8; attempt+=1){
    try{
      const response = await fetch(`${site}${path}`,{
        ...options,
        redirect:'follow',
        signal:AbortSignal.timeout(60000),
        headers:{
          Authorization:`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
          Accept:'application/json',
          'User-Agent':'DTFSeeds-Outdoor-Quantification-V1/1.0',
          ...(options.body ? {'Content-Type':'application/json'} : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try{ body = text ? JSON.parse(text) : null; }catch{}
      if((response.status===429 || response.status>=500) && attempt<8){
        await sleep(attempt*1500);
        continue;
      }
      if(!response.ok) fail(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){
      last = error;
      if(attempt<8) await sleep(attempt*1500);
    }
  }
  throw last;
}

async function pageBySlug(slug){
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if(!Array.isArray(rows) || rows.length !== 1) fail(`outdoor: expected exactly one WordPress page, found ${Array.isArray(rows)?rows.length:'invalid response'}`);
  return rows[0];
}

const data = await loadJson();
const validation = validateData(data);

if(validateOnly){
  console.log(JSON.stringify({valid:true,id:data.id,...validation},null,2));
  process.exit(0);
}

if(!apply) fail('Refusing production write: set APPLY_OUTDOOR_QUANT_V1=true');
if(!user || !pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required for production publication.');

const page = await pageBySlug('outdoor');
const before = rendered(page.content);
if(!before.includes(baseEnd)) fail('Outdoor V6 base block end marker is missing; refusing to attach quantification layer.');

const cleaned = stripExisting(before);
const block = buildBlock(data, page.id);
const after = cleaned.replace(baseEnd, `${baseEnd}\n${block}`);
if(after === before) fail('Outdoor quantification update produced no content change');
if((after.match(/data-dtf-outdoor-quantification-v1="true"/g) || []).length !== 1) fail('Expected exactly one quantification owner marker after update');

const stamp = new Date().toISOString().replace(/[-:.]/g,'');
const backupDir = join(backupRoot, `outdoor-quantification-v1-${stamp}`);
await mkdir(backupDir,{recursive:true});
await writeFile(join(backupDir,'before.html'), before, 'utf8');
await writeFile(join(backupDir,'after.html'), after, 'utf8');
await writeFile(join(backupDir,'data.json'), JSON.stringify(data,null,2), 'utf8');

const updated = await request(`/wp-json/wp/v2/pages/${page.id}`,{
  method:'POST',
  body:JSON.stringify({content:after})
});
const saved = rendered(updated.content);
if(!saved.includes('data-dtf-outdoor-quantification-v1="true"')) fail('WordPress response is missing quantification marker');
for(const section of data.sections){
  if(!saved.includes(`data-oqv1-chapter="${section.chapterId}"`)) fail(`WordPress response missing chapter ${section.chapterId}`);
  for(const topic of section.subtopics){
    if(!saved.includes(`data-oqv1-subtopic="${topic.id}"`)) fail(`WordPress response missing subtopic ${topic.id}`);
  }
}

const report = {
  id:data.id,
  pageId:page.id,
  route:data.route,
  validation,
  publishedAt:new Date().toISOString(),
  marker:'data-dtf-outdoor-quantification-v1="true"',
  completedChapters:data.coverage?.completedChapters || []
};
await writeFile(join(backupDir,'report.json'), JSON.stringify(report,null,2), 'utf8');
console.log(JSON.stringify(report,null,2));
