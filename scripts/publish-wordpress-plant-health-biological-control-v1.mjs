import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_PLANT_HEALTH_BIOCONTROL_V1 || '').toLowerCase() === 'true';
const validateOnly = process.argv.includes('--validate-only');
const packPath = process.env.PLANT_HEALTH_BIOCONTROL_V1_PATH || 'site/wordpress/education/plant-health-biological-control-v1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-plant-health-biocontrol-v1';

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const count = (text, needle) => String(text).split(needle).length - 1;
const fail = message => { throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const pack = JSON.parse(await readFile(join(ROOT, packPath), 'utf8'));

function validate() {
  if (pack?.schemaVersion !== 1 || pack?.id !== 'plant-health-biological-control-v1') fail('Invalid biological-control pack schema/id.');
  if (pack.topicId !== 'plant-health-ipm' || pack.route !== '/learn/ipm/') fail('Biological-control route ownership must remain /learn/ipm/.');
  if (!pack.title || !pack.learningOutcome || pack.learningOutcome.length < 180) fail('Biological-control metadata is too thin.');
  if (!pack.evidenceBoundary || pack.evidenceBoundary.length < 220) fail('Biological-control evidence boundary is too thin.');
  if (!Array.isArray(pack.sourceRefs) || pack.sourceRefs.length !== 7) fail('Expected exactly seven biological-control references.');
  const sourceIds = new Set();
  for (const source of pack.sourceRefs) {
    if (!source.id || sourceIds.has(source.id)) fail(`Missing/duplicate source id ${source.id || 'unknown'}.`);
    sourceIds.add(source.id);
    if (!source.type || !source.citation || !source.supports || !source.url) fail(`${source.id}: incomplete reference.`);
    if (!/^https:\/\//.test(source.url)) fail(`${source.id}: reference URL must use HTTPS.`);
  }
  if (!Array.isArray(pack.records) || pack.records.length !== 5) fail('Expected exactly five biological-control records.');
  const recordIds = new Set();
  for (const record of pack.records) {
    if (!record.id || recordIds.has(record.id)) fail(`Missing/duplicate record id ${record.id || 'unknown'}.`);
    recordIds.add(record.id);
    if (!record.title || !Array.isArray(record.sourceIds) || record.sourceIds.length < 1) fail(`${record.id}: source mapping missing.`);
    for (const sourceId of record.sourceIds) if (!sourceIds.has(sourceId)) fail(`${record.id}: unknown source ${sourceId}.`);
    if (!Array.isArray(record.concepts) || record.concepts.length < 3) fail(`${record.id}: at least three concepts are required.`);
    for (const key of ['summary', 'measure', 'interpret', 'apply', 'evidenceLimits']) {
      if (!record[key] || record[key].length < 130) fail(`${record.id}: ${key} is too thin.`);
    }
  }
  if (!Array.isArray(pack.knowledgeChecks) || pack.knowledgeChecks.length < 6) fail('Biological-control knowledge checks are incomplete.');
  if (!Array.isArray(pack.visualTargets) || pack.visualTargets.length < 6) fail('Biological-control visual targets are incomplete.');
  const raw = JSON.stringify(pack).toLowerCase();
  const forbiddenClaims = [
    /guaranteed cure/,
    /works for every/,
    /all bacillus(?: strains| species)?\s+(?:are|is|work|works|control|controls|prevent|prevents|cure|cures|safe|beneficial|effective)/,
    /all trichoderma(?: strains| species)?\s+(?:are|is|work|works|control|controls|prevent|prevents|cure|cures|safe|beneficial|effective)/,
    /safe because natural/,
    /ignore the label/
  ];
  for (const pattern of forbiddenClaims) {
    if (pattern.test(raw)) fail(`Forbidden biological-control claim matched ${pattern}.`);
  }
  return { valid: true, id: pack.id, route: pack.route, records: pack.records.length, sources: pack.sourceRefs.length, visualTargets: pack.visualTargets.length };
}

const validation = validate();
if (validateOnly) {
  console.log(JSON.stringify(validation, null, 2));
  process.exit(0);
}
if (!user || !pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required for publication.');
if (!apply) fail('APPLY_PLANT_HEALTH_BIOCONTROL_V1=true is required for publication.');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Plant-Health-Biocontrol-V1/1.0' };

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 7) {
        await sleep(attempt * 1400);
        continue;
      }
      if (!response.ok) fail(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 7) await sleep(attempt * 1400);
    }
  }
  throw last;
}

async function pageBySlug(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length !== 1) fail(`${slug}: expected exactly one WordPress page, found ${Array.isArray(rows) ? rows.length : 'invalid response'}.`);
  return rows[0];
}

const pills = items => items.map(item => `<span>${esc(item)}</span>`).join('');
const recordCard = record => `
<article class="phb1-record" id="phb1-${esc(record.id)}" data-phb1-record="${esc(record.id)}">
  <div class="phb1-head"><div><p class="phb1-kicker">Evidence-based biological control</p><h3>${esc(record.title)}</h3></div><div class="phb1-pills">${pills(record.concepts)}</div></div>
  <p class="phb1-summary">${esc(record.summary)}</p>
  <div class="phb1-grid">
    <section><h4>Measure</h4><p>${esc(record.measure)}</p></section>
    <section><h4>Interpret</h4><p>${esc(record.interpret)}</p></section>
    <section><h4>Apply inside IPM</h4><p>${esc(record.apply)}</p></section>
    <section><h4>Evidence limits</h4><p>${esc(record.evidenceLimits)}</p></section>
  </div>
  <div class="phb1-evidence"><strong>Mapped evidence</strong>${pills(record.sourceIds)}</div>
</article>`;
const sourceCard = source => `
<article class="phb1-source"><span>${esc(source.id)}</span><strong>${esc(source.citation)}</strong><p>${esc(source.supports)}</p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></article>`;

function block() {
  return `<!-- dtf-plant-health-biocontrol-v1:start -->
<style id="dtf-plant-health-biocontrol-v1-style">
.phb1{--deep:#0d2116;--green:#315f3d;--gold:#b28f3d;--cream:#f7f3e8;--paper:#fffdf8;--ink:#173021;--muted:#5b6b60;--line:#d7e1d8;background:linear-gradient(180deg,#f7f3e8,#edf4ed);color:var(--ink);padding:62px 0 76px}.phb1 *{box-sizing:border-box}.phb1-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.phb1-kicker{margin:0 0 8px;color:#826b2f;font-size:.7rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.phb1 h2{margin:0;font-size:clamp(2.2rem,4.5vw,4rem);line-height:.98;letter-spacing:-.045em}.phb1 h3{margin:0;font-size:clamp(1.55rem,2.8vw,2.25rem);line-height:1.06}.phb1 h4{margin:0 0 7px}.phb1 p{color:var(--muted);line-height:1.67}.phb1-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px}.phb1-boundary{padding:23px;border-radius:21px;background:linear-gradient(145deg,#0d2116,#21452d);color:#fff}.phb1-boundary strong{color:#e1c979}.phb1-boundary p{color:#d7e2d9;margin-bottom:0}.phb1-records{display:grid;gap:18px;margin-top:30px}.phb1-record{padding:24px;border:1px solid var(--line);border-radius:20px;background:var(--paper)}.phb1-head{display:flex;justify-content:space-between;gap:18px;align-items:start}.phb1-pills,.phb1-evidence{display:flex;gap:6px;flex-wrap:wrap}.phb1-pills span,.phb1-evidence span{padding:5px 8px;border:1px solid #d6e2d7;border-radius:999px;background:#ebf3eb;color:#49614e;font-size:.71rem;font-weight:850}.phb1-summary{font-size:1.02rem}.phb1-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.phb1-grid section{padding:15px;border-radius:14px;background:#f1f6f1;border:1px solid #dee7df}.phb1-grid section:nth-child(2n){background:#fff9ed;border-color:#e7dcc4}.phb1-grid p{margin:0;font-size:.94rem}.phb1-evidence{align-items:center;margin-top:14px}.phb1-evidence strong{font-size:.78rem;margin-right:3px}.phb1-bottom{display:grid;grid-template-columns:.85fr 1.15fr;gap:16px;margin-top:24px}.phb1-panel{padding:22px;border-radius:18px;background:#fff;border:1px solid var(--line)}.phb1-panel li{margin:8px 0;color:#4e6053;line-height:1.5}.phb1-source-grid{display:grid;gap:9px}.phb1-source{padding:13px;border-radius:13px;background:#f4f7f2;border:1px solid #dde5dd}.phb1-source>span{display:block;color:#826b2f;font-size:.68rem;font-weight:950}.phb1-source strong{display:block;margin:5px 0}.phb1-source p{font-size:.88rem;margin:0 0 7px}.phb1-source a{color:var(--green)!important;font-weight:900;text-decoration:none!important}
@media(max-width:820px){.phb1-hero,.phb1-bottom,.phb1-grid{grid-template-columns:1fr}.phb1-head{flex-direction:column}}@media(max-width:620px){.phb1{padding:48px 0 58px}.phb1-wrap{width:min(100% - 26px,1180px)}.phb1-record{padding:18px}}
</style>
<section class="phb1" data-dtf-plant-health-biocontrol-v1="true"><div class="phb1-wrap">
  <div class="phb1-hero"><div><p class="phb1-kicker">Teaching Healthy Cultivation · IPM decision support</p><h2>${esc(pack.title)}</h2><p>${esc(pack.learningOutcome)}</p></div><aside class="phb1-boundary"><strong>Evidence and legal boundary</strong><p>${esc(pack.evidenceBoundary)}</p></aside></div>
  <div class="phb1-records">${pack.records.map(recordCard).join('')}</div>
  <div class="phb1-bottom"><section class="phb1-panel"><p class="phb1-kicker">Knowledge check</p><h3>Separate evidence from assumption</h3><ol>${pack.knowledgeChecks.map(item => `<li>${esc(item)}</li>`).join('')}</ol><p class="phb1-kicker">Visual study targets</p><ul>${pack.visualTargets.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section><section class="phb1-panel"><p class="phb1-kicker">Evidence library</p><h3>Research and regulatory sources</h3><div class="phb1-source-grid">${pack.sourceRefs.map(sourceCard).join('')}</div></section></div>
</div></section>
<!-- dtf-plant-health-biocontrol-v1:end -->`;
}

const page = await pageBySlug('ipm');
const before = rendered(page.content);
const requiredMarkers = [
  'data-dtf-topic="plant-health-ipm"',
  'data-dtf-learning-v4="topic-plant-health-ipm"',
  'data-dtf-plant-health-ipm-v6="true"',
  'data-dtf-plant-health-emerging-v1="true"'
];
for (const marker of requiredMarkers) if (!before.includes(marker)) fail(`Plant Health dependency marker is missing (${marker}).`);

const clean = before.replace(/<!-- dtf-plant-health-biocontrol-v1:start -->[\s\S]*?<!-- dtf-plant-health-biocontrol-v1:end -->/g, '').trim();
const next = `${clean}\n${block()}`.trim();
if (count(next, 'data-dtf-plant-health-biocontrol-v1="true"') !== 1) fail('Planned page must contain exactly one biological-control marker.');
if (count(next, 'data-phb1-record=') !== 5) fail('Planned page must contain exactly five biological-control records.');
for (const record of pack.records) if (!next.includes(`data-phb1-record="${record.id}"`)) fail(`Planned page is missing ${record.id}.`);
for (const marker of requiredMarkers) if (!next.includes(marker)) fail(`Planned page would remove dependency marker ${marker}.`);

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `plant-health-biocontrol-v1-${stamp}`);
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupDir, 'page-before.json'), JSON.stringify(page, null, 2));
await writeFile(join(backupDir, 'before.html'), before);
await writeFile(join(backupDir, 'planned.html'), next);

let changed = false;
try {
  if (before !== next) {
    await request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content: next, status: 'publish' }) });
    changed = true;
  }
  const check = await pageBySlug('ipm');
  const html = rendered(check.content);
  for (const marker of requiredMarkers) if (!html.includes(marker)) fail(`Post-write dependency verification failed for ${marker}.`);
  if (count(html, 'data-dtf-plant-health-biocontrol-v1="true"') !== 1 || count(html, 'data-phb1-record=') !== 5) fail('Post-write biological-control marker/count verification failed.');
  for (const record of pack.records) if (!html.includes(`data-phb1-record="${record.id}"`)) fail(`Post-write verification is missing ${record.id}.`);
  const report = { ok: true, changed, pageId: page.id, route: pack.route, records: pack.records.length, sources: pack.sourceRefs.length, visualTargets: pack.visualTargets.length, backupDir };
  await writeFile(join(backupDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (changed) {
    try {
      await request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content: before, status: page.status || 'publish' }) });
    } catch (rollbackError) {
      console.error(`ROLLBACK ERROR: ${rollbackError.message}`);
    }
  }
  throw error;
}
