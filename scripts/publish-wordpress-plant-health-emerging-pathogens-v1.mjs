import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_PLANT_HEALTH_EMERGING_V1 || '').toLowerCase() === 'true';
const validateOnly = process.argv.includes('--validate-only');
const packPath = process.env.PLANT_HEALTH_EMERGING_V1_PATH || 'site/wordpress/education/plant-health-emerging-pathogens-v1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-plant-health-emerging-v1';

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
  if (pack?.schemaVersion !== 1 || pack?.id !== 'plant-health-emerging-pathogens-v1') fail('Invalid emerging-pathogen pack schema/id.');
  if (pack.topicId !== 'plant-health-ipm' || pack.route !== '/learn/ipm/') fail('Emerging-pathogen route ownership must remain /learn/ipm/.');
  if (!pack.title || !pack.learningOutcome || pack.learningOutcome.length < 140) fail('Emerging-pathogen metadata is too thin.');
  if (!pack.evidenceBoundary || pack.evidenceBoundary.length < 180) fail('Emerging-pathogen evidence boundary is too thin.');
  if (!Array.isArray(pack.sourceRefs) || pack.sourceRefs.length !== 4) fail('Expected exactly four emerging-pathogen evidence references.');
  const sourceIds = new Set();
  for (const source of pack.sourceRefs) {
    if (!source.id || sourceIds.has(source.id)) fail(`Missing/duplicate source id ${source.id || 'unknown'}.`);
    sourceIds.add(source.id);
    if (!source.type || !source.citation || !source.supports || !source.url) fail(`${source.id}: incomplete evidence reference.`);
    if (!/^https:\/\//.test(source.url)) fail(`${source.id}: evidence URL must use HTTPS.`);
  }
  if (!Array.isArray(pack.records) || pack.records.length !== 4) fail('Expected exactly four emerging-pathogen records.');
  const recordIds = new Set();
  for (const record of pack.records) {
    if (!record.id || recordIds.has(record.id)) fail(`Missing/duplicate record id ${record.id || 'unknown'}.`);
    recordIds.add(record.id);
    if (!record.title || !Array.isArray(record.sourceIds) || record.sourceIds.length < 1) fail(`${record.id}: source mapping missing.`);
    for (const sourceId of record.sourceIds) if (!sourceIds.has(sourceId)) fail(`${record.id}: unknown source ${sourceId}.`);
    if (!Array.isArray(record.concepts) || record.concepts.length < 3) fail(`${record.id}: at least three concepts are required.`);
    for (const key of ['summary', 'whatToLookFor', 'confirmation', 'systemResponse', 'evidenceLimits']) {
      if (!record[key] || record[key].length < 120) fail(`${record.id}: ${key} is too thin.`);
    }
  }
  if (!Array.isArray(pack.knowledgeChecks) || pack.knowledgeChecks.length < 5) fail('Emerging-pathogen knowledge checks are incomplete.');
  if (!Array.isArray(pack.visualTargets) || pack.visualTargets.length < 5) fail('Emerging-pathogen visual targets are incomplete.');
  const raw = JSON.stringify(pack).toLowerCase();
  for (const pattern of [/guaranteed cure/, /universal pest threshold/, /spray until runoff/, /eradicates every/, /always caused by/]) {
    if (pattern.test(raw)) fail(`Forbidden plant-health claim matched ${pattern}.`);
  }
  return {
    valid: true,
    id: pack.id,
    route: pack.route,
    records: pack.records.length,
    sources: pack.sourceRefs.length,
    visualTargets: pack.visualTargets.length
  };
}

const validation = validate();
if (validateOnly) {
  console.log(JSON.stringify(validation, null, 2));
  process.exit(0);
}
if (!user || !pass) fail('WP_API_USERNAME and WP_API_PASSWORD are required for publication.');
if (!apply) fail('APPLY_PLANT_HEALTH_EMERGING_V1=true is required for publication.');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Plant-Health-Emerging-V1/1.0' };

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          ...headers,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
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

const conceptPills = concepts => concepts.map(item => `<span>${esc(item)}</span>`).join('');
const sourcePills = ids => ids.map(id => `<span>${esc(id)}</span>`).join('');
const recordCard = record => `
<article class="phe1-record" id="phe1-${esc(record.id)}" data-phe1-record="${esc(record.id)}">
  <div class="phe1-record-head"><div><p class="phe1-kicker">Focused reference</p><h3>${esc(record.title)}</h3></div><div class="phe1-pills">${conceptPills(record.concepts)}</div></div>
  <p class="phe1-summary">${esc(record.summary)}</p>
  <div class="phe1-grid">
    <section><h4>What to look for</h4><p>${esc(record.whatToLookFor)}</p></section>
    <section><h4>How to confirm</h4><p>${esc(record.confirmation)}</p></section>
    <section><h4>System response principles</h4><p>${esc(record.systemResponse)}</p></section>
    <section><h4>Evidence limits</h4><p>${esc(record.evidenceLimits)}</p></section>
  </div>
  <div class="phe1-source-pills"><strong>Mapped evidence</strong>${sourcePills(record.sourceIds)}</div>
</article>`;

const sourceCard = source => `
<article class="phe1-source">
  <span>${esc(source.id)}</span>
  <strong>${esc(source.citation)}</strong>
  <p>${esc(source.supports)}</p>
  <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Open evidence ↗</a>
</article>`;

function block() {
  return `<!-- dtf-plant-health-emerging-v1:start -->
<style id="dtf-plant-health-emerging-v1-style">
.phe1{--ink:#173121;--muted:#5e6d62;--green:#315f3d;--gold:#a88936;--cream:#f7f4e9;--paper:#fffdf8;--line:#d9e3da;margin:0;background:linear-gradient(180deg,#eef4ed,#f7f4e9);color:var(--ink);padding:62px 0 74px}.phe1 *{box-sizing:border-box}.phe1-wrap{width:min(1180px,calc(100% - 34px));margin:auto}.phe1-kicker{margin:0 0 8px;color:#806d32;font-size:.7rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.phe1-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:start}.phe1 h2{margin:0;font-size:clamp(2.1rem,4.3vw,3.8rem);line-height:1;letter-spacing:-.04em}.phe1 h3{margin:0;font-size:clamp(1.55rem,3vw,2.35rem);line-height:1.05}.phe1 h4{margin:0 0 7px}.phe1 p{color:var(--muted);line-height:1.67}.phe1-boundary{padding:22px;border-radius:20px;background:#173121;color:#fff}.phe1-boundary strong{color:#e2c875}.phe1-boundary p{color:#d8e2da;margin-bottom:0}.phe1-records{display:grid;gap:18px;margin-top:30px}.phe1-record{padding:24px;border:1px solid var(--line);border-radius:20px;background:var(--paper)}.phe1-record-head{display:flex;justify-content:space-between;gap:18px;align-items:start}.phe1-pills,.phe1-source-pills{display:flex;gap:6px;flex-wrap:wrap}.phe1-pills span,.phe1-source-pills span{padding:5px 8px;border:1px solid #d7e4d8;border-radius:999px;background:#edf4ec;color:#48614d;font-size:.72rem;font-weight:850}.phe1-summary{font-size:1.02rem}.phe1-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.phe1-grid section{padding:15px;border-radius:14px;background:#f2f6f1;border:1px solid #e0e8e0}.phe1-grid section:nth-child(even){background:#fff9ed;border-color:#eadfc6}.phe1-grid p{margin:0;font-size:.94rem}.phe1-source-pills{margin-top:14px;align-items:center}.phe1-source-pills strong{margin-right:3px;font-size:.78rem}.phe1-bottom{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.phe1-panel{padding:22px;border-radius:18px;background:#fff;border:1px solid var(--line)}.phe1-panel li{margin:8px 0;color:#4f6154;line-height:1.5}.phe1-source-grid{display:grid;gap:9px}.phe1-source{padding:13px;border-radius:13px;background:#f4f7f2;border:1px solid #dde5dd}.phe1-source>span{display:block;color:#806d32;font-size:.68rem;font-weight:950}.phe1-source strong{display:block;margin:5px 0}.phe1-source p{font-size:.88rem;margin:0 0 7px}.phe1-source a{color:var(--green)!important;font-weight:900;text-decoration:none!important}.phe1-visuals{margin-top:16px}.phe1-visuals li{margin:7px 0;color:#536358}
@media(max-width:820px){.phe1-hero,.phe1-bottom{grid-template-columns:1fr}.phe1-record-head{flex-direction:column}.phe1-grid{grid-template-columns:1fr}}@media(max-width:620px){.phe1{padding:48px 0 58px}.phe1-wrap{width:min(100% - 26px,1180px)}.phe1-record{padding:18px}}
</style>
<section class="phe1" data-dtf-plant-health-emerging-v1="true"><div class="phe1-wrap">
  <div class="phe1-hero"><div><p class="phe1-kicker">Teaching Healthy Cultivation · Emerging pathogen evidence</p><h2>${esc(pack.title)}</h2><p>${esc(pack.learningOutcome)}</p></div><aside class="phe1-boundary"><strong>Evidence boundary</strong><p>${esc(pack.evidenceBoundary)}</p></aside></div>
  <div class="phe1-records">${pack.records.map(recordCard).join('')}</div>
  <div class="phe1-bottom">
    <section class="phe1-panel"><p class="phe1-kicker">Knowledge check</p><h3>Reason from evidence</h3><ol>${pack.knowledgeChecks.map(item => `<li>${esc(item)}</li>`).join('')}</ol><div class="phe1-visuals"><p class="phe1-kicker">Visual study targets</p><ul>${pack.visualTargets.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div></section>
    <section class="phe1-panel"><p class="phe1-kicker">Peer-reviewed evidence</p><h3>Source-mapped references</h3><div class="phe1-source-grid">${pack.sourceRefs.map(sourceCard).join('')}</div></section>
  </div>
</div></section>
<!-- dtf-plant-health-emerging-v1:end -->`;
}

const page = await pageBySlug('ipm');
const before = rendered(page.content);
const ownerMarker = 'data-dtf-topic="plant-health-ipm"';
const guideMarker = 'data-dtf-learning-v4="topic-plant-health-ipm"';
const coreMarker = 'data-dtf-plant-health-ipm-v6="true"';
if (!before.includes(ownerMarker)) fail(`Plant Health route owner marker is missing (${ownerMarker}).`);
if (!before.includes(guideMarker)) fail(`Plant Health guided-learning marker is missing (${guideMarker}).`);
if (!before.includes(coreMarker)) fail(`Plant Health V6 core marker is missing (${coreMarker}).`);

const clean = before.replace(/<!-- dtf-plant-health-emerging-v1:start -->[\s\S]*?<!-- dtf-plant-health-emerging-v1:end -->/g, '').trim();
const next = `${clean}\n${block()}`.trim();
if (count(next, 'data-dtf-plant-health-emerging-v1="true"') !== 1) fail('Planned page must contain exactly one emerging-pathogen marker.');
if (count(next, 'data-phe1-record=') !== 4) fail('Planned page must contain exactly four emerging-pathogen records.');
for (const record of pack.records) if (!next.includes(`data-phe1-record="${record.id}"`)) fail(`Planned page is missing ${record.id}.`);

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `plant-health-emerging-v1-${stamp}`);
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
  if (!html.includes(ownerMarker) || !html.includes(guideMarker) || !html.includes(coreMarker)) fail('Post-write core Plant Health ownership verification failed.');
  if (count(html, 'data-dtf-plant-health-emerging-v1="true"') !== 1 || count(html, 'data-phe1-record=') !== 4) fail('Post-write emerging-pathogen marker/count verification failed.');
  for (const record of pack.records) if (!html.includes(`data-phe1-record="${record.id}"`)) fail(`Post-write verification is missing ${record.id}.`);
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
