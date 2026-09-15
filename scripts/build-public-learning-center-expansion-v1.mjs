import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'site/public-route-patch/learn');
const DTF420_SHA = '1427a9e1619a76a04b07c879d39b2af3b5b8806e';
const RAW = `https://raw.githubusercontent.com/dtfgenetics/Dtf420/${DTF420_SHA}/content`;
const FETCH_ATTEMPTS = Number.parseInt(process.env.DTF420_FETCH_ATTEMPTS || '4', 10);
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.DTF420_FETCH_TIMEOUT_MS || '60000', 10);

const sourceFiles = {
  plantHealth: ['plant-health-library.json', 'plant-health-expanded.json'],
  science: [
    'cultivation-science-library.json',
    'protected-cultivation-library.json',
    'protected-cultivation-lighting.json',
    'outdoor-cultivation-expanded.json',
    'postharvest-science-expanded.json',
    'advanced-cultivation-science-expanded.json',
    'plant-physiology-expanded.json',
    'propagation-nutrition-genetics-expanded.json'
  ],
  symptoms: ['symptom-differential-library.json'],
  tools: ['learning-tools.json'],
  sources: ['education-sources.json']
};

const publicMarkerAliases = {
  'plant-health': 'Plant Health, IPM',
  'cultivation-science': 'Cultivation Science Reference Library',
  symptoms: 'Visual Symptom Differential Library',
  tools: 'Printable Learning Tools',
  sources: 'Current sources'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function errorDetail(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === 'object') {
    const code = 'code' in cause ? String(cause.code) : '';
    const message = 'message' in cause ? String(cause.message) : '';
    if (code || message) return [code, message].filter(Boolean).join(': ');
  }
  return error.message || error.name;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableFetchError(error) {
  const detail = errorDetail(error);
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_SOCKET|fetch failed|network/i.test(detail);
}

async function fetchJson(name) {
  const url = `${RAW}/${name}`;
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'DTFSeeds-Production-Education-Importer/1.2' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (response.ok) return response.json();

      lastError = new Error(`HTTP ${response.status}`);
      const retryable = isRetryableStatus(response.status);
      if (!retryable || attempt === FETCH_ATTEMPTS) {
        throw new Error(`Could not fetch ${name} from pinned Dtf420 source (${response.status})`);
      }
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      lastError = error;
      if (attempt === FETCH_ATTEMPTS || !isRetryableFetchError(error)) break;
    }

    await sleep(500 * attempt);
  }

  throw new Error(`Could not fetch ${name} from pinned Dtf420 source after ${FETCH_ATTEMPTS} attempts (${errorDetail(lastError)})`);
}

function flattenRecords(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['lessons', 'entries', 'records', 'items', 'sources', 'tools']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return Object.entries(value)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([key, v]) => ({ slug: key, ...v }));
}

async function loadGroup(names) {
  const datasets = await Promise.all(names.map(fetchJson));
  return datasets.flatMap(flattenRecords);
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function humanize(key = '') {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'references';
}

function renderValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) return `<p><a href="${esc(value)}" rel="noopener noreferrer">${esc(value)}</a></p>`;
    if (/^\/[^\s]+/.test(value)) return `<p><a href="${esc(value)}">${esc(value)}</a></p>`;
    return `<p>${esc(value)}</p>`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return `<p>${esc(value)}</p>`;
  if (Array.isArray(value)) {
    if (!value.length) return '';
    if (value.every((x) => ['string', 'number', 'boolean'].includes(typeof x))) {
      return `<ul>${value.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    }
    return value.map((x) => `<div class="nested">${renderObject(x)}</div>`).join('');
  }
  if (typeof value === 'object') return renderObject(value);
  return '';
}

function renderObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([key, value]) => !['slug', 'title', 'category', 'summary', 'purpose'].includes(key) && value != null && value !== '')
    .map(([key, value]) => `<section class="field"><h4>${esc(humanize(key))}</h4>${renderValue(value)}</section>`)
    .join('');
}

function dedupe(records) {
  const seen = new Set();
  return records.filter((record, index) => {
    const key = record?.slug || record?.id || `${record?.title || record?.name || 'record'}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const label = String(record?.category || record?.type || 'General references').trim() || 'General references';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(record);
  }
  return [...groups.entries()];
}

function recordId(record, index) {
  const stableId = record?.slug || record?.id;
  if (stableId) return slugify(stableId);
  return `${slugify(record?.title || record?.name || 'record')}-${index + 1}`;
}

function renderRecord(record, index) {
  const heading = record.title || record.name || record.citation || record.id || `Reference ${index + 1}`;
  const summary = record.summary || record.purpose || record.description || record.abstract || record.notes || '';
  const category = record.category || record.type || 'THC reference';
  return `<details class="record" id="${esc(recordId(record, index))}" data-reference-record="true"><summary><span class="record-copy"><span class="cat">${esc(category)}</span><span class="record-title">${esc(heading)}</span>${summary ? `<span class="record-summary">${esc(summary)}</span>` : ''}</span><span class="record-toggle" aria-hidden="true"></span></summary><div class="record-body">${renderObject(record)}</div></details>`;
}

function assertUniqueIds(html, slug) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size) throw new Error(`${slug} output contains duplicate DOM ids: ${[...duplicates].join(', ')}`);
}

const style = `<style>
:root{--ink:#15341f;--muted:#496253;--green:#176d39;--deep:#0d2c1a;--cream:#f7faf7;--line:#d6e4d9;--card:#fff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1220px;margin:auto;padding:42px 22px 78px}.hero{padding:24px 0 20px}.eyebrow{font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--green);font-size:.82rem}h1{font-size:clamp(2.2rem,5vw,4.3rem);line-height:1.03;letter-spacing:-.04em;margin:.22em 0}.lede{max-width:900px;color:var(--muted);font-size:1.08rem;line-height:1.7}.meta{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.pill{padding:8px 12px;border-radius:999px;background:#e7f2ea;color:var(--deep);font-weight:800}.toolbar,.reference-index{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}.btn,.jump{display:inline-block;padding:10px 14px;border-radius:999px;background:var(--green);color:white;text-decoration:none;font-weight:900}.btn.alt,.jump{background:white;color:var(--green);border:1px solid var(--green)}.reference-index{padding:14px 0 2px}.jump{font-size:.9rem}.topic-groups{display:grid;gap:14px}.topic-group{background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:0 10px 26px rgba(22,64,35,.05);overflow:hidden}.topic-group>summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;min-height:76px;padding:18px 20px;cursor:pointer;list-style:none}.topic-group>summary::-webkit-details-marker,.record>summary::-webkit-details-marker{display:none}.topic-group>summary:after{content:"+";display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:999px;background:#f3f6f1;color:var(--green);font-size:1.25rem;font-weight:900}.topic-group[open]>summary:after{content:"−"}.topic-group>summary:focus-visible,.record>summary:focus-visible{outline:3px solid #c6a83d;outline-offset:-3px}.group-kicker{display:block;margin-bottom:4px;color:var(--green);font-size:.76rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.group-title{font-size:1.2rem;font-weight:900;line-height:1.25}.group-count{padding:7px 10px;border-radius:999px;background:#edf5ef;color:var(--deep);font-size:.84rem;font-weight:850;white-space:nowrap}.group-body{padding:4px 16px 16px;border-top:1px solid var(--line)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;padding-top:12px}.record{background:#fbfdfb;border:1px solid var(--line);border-radius:16px;overflow:hidden;break-inside:avoid}.record>summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;padding:16px;cursor:pointer;list-style:none}.record[open]>summary{background:#f1f7f2}.record-copy{display:block;min-width:0}.record-title{display:block;font-size:1.08rem;font-weight:900;line-height:1.3;margin-top:4px}.record-summary{display:block;color:var(--muted);font-size:.94rem;line-height:1.5;margin-top:7px}.record .cat{display:block;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;color:var(--green);font-weight:900}.record-toggle{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--green);font-weight:900}.record-toggle:after{content:"+"}.record[open] .record-toggle:after{content:"−"}.record-body{padding:0 16px 16px;border-top:1px solid var(--line)}.field{margin-top:15px;padding-top:13px;border-top:1px solid var(--line)}.field:first-child{border-top:0}.field h4{margin:0 0 6px;font-size:.92rem}.field p,.field li{color:var(--muted);line-height:1.55}.field ul{padding-left:20px}.nested{padding:9px 12px;margin:8px 0;border-left:3px solid #b8d4bf;background:#f8fbf8}.source-note{margin:34px 0 0;padding:20px;border-radius:18px;background:var(--deep);color:#e7f5ea}.source-note code{color:#d9f06e}@media(max-width:640px){main{padding:24px 14px 60px}.topic-group>summary{grid-template-columns:minmax(0,1fr) auto}.group-count{grid-column:1/2;justify-self:start}.topic-group>summary:after{grid-column:2;grid-row:1/3}.grid{grid-template-columns:1fr}}@media print{.toolbar,.reference-index,.source-note{display:none}.topic-group,.record{box-shadow:none;break-inside:avoid}.topic-group>.group-body,.record>.record-body{display:block!important}body{background:#fff}main{max-width:none;padding:10mm}}
</style>`;

const behavior = `<script>
(function(){
  function openHashTarget(){
    if(!location.hash) return;
    var id=decodeURIComponent(location.hash.slice(1));
    var target=document.getElementById(id);
    if(!target) return;
    var node=target;
    while(node){if(node.tagName==='DETAILS') node.open=true;node=node.parentElement;}
    requestAnimationFrame(function(){target.scrollIntoView({block:'start'});});
  }
  addEventListener('hashchange',openHashTarget);
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',openHashTarget); else openHashTarget();
})();
</script>`;

function renderPage({ slug, title, description, eyebrow, records, print = false }) {
  const clean = dedupe(records);
  const grouped = groupRecords(clean);
  const categories = new Set(grouped.map(([label]) => label));
  const alias = publicMarkerAliases[slug] || '';
  const compatibilityMarker = alias ? `<span hidden data-dtf-public-marker="${esc(alias)}">${esc(alias)}</span>` : '';
  let globalIndex = 0;
  const groupMarkup = grouped.map(([label, items], groupIndex) => {
    const groupId = `group-${slugify(label)}-${groupIndex + 1}`;
    const cards = items.map((record) => renderRecord(record, globalIndex++)).join('');
    return `<details class="topic-group" id="${esc(groupId)}" data-reference-group="true"><summary><span><span class="group-kicker">Topic group</span><span class="group-title">${esc(label)}</span></span><span class="group-count">${items.length} ${items.length === 1 ? 'reference' : 'references'}</span></summary><div class="group-body"><div class="grid">${cards}</div></div></details>`;
  }).join('');
  const indexMarkup = grouped.length > 1 ? `<nav class="reference-index" aria-label="Reference topic groups">${grouped.map(([label], groupIndex) => `<a class="jump" href="#group-${esc(slugify(label))}-${groupIndex + 1}">${esc(label)}</a>`).join('')}</nav>` : '';
  const canonical = `https://dtfseeds.com/learn/${slug}/`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">${style}</head><body><main data-reference-progressive-disclosure="true">${compatibilityMarker}<header class="hero"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p><div class="meta"><span class="pill">${clean.length} references</span>${categories.size ? `<span class="pill">${categories.size} topic groups</span>` : ''}<span class="pill">Teaching Healthy Cultivation</span></div><div class="toolbar"><a class="btn" href="/learn/">Back to Learn</a><a class="btn alt" href="/learn/search/">Search education</a>${print ? `<a class="btn alt" href="javascript:window.print()">Print / Save PDF</a>` : ''}</div></header>${indexMarkup}<div class="topic-groups">${groupMarkup}</div><aside class="source-note"><strong>Source-controlled release.</strong> This production page is generated from the validated Dtf420 education libraries pinned at <code>${DTF420_SHA}</code>. Visual briefs are teaching requirements, not claims that unfinished artwork is already published.</aside></main>${behavior}</body></html>`;
}

const [plantHealth, science, symptoms, tools, sources] = await Promise.all([
  loadGroup(sourceFiles.plantHealth),
  loadGroup(sourceFiles.science),
  loadGroup(sourceFiles.symptoms),
  loadGroup(sourceFiles.tools),
  loadGroup(sourceFiles.sources)
]);

const pages = [
  {
    slug: 'plant-health',
    title: 'Plant Health, Disease, Pests & IPM',
    description: 'Observation-first plant health references for pest identification, disease differentials, root decline, sanitation, quarantine, scouting, biological control, and evidence-based IPM.',
    eyebrow: 'Teaching Healthy Cultivation · Plant Health', records: plantHealth
  },
  {
    slug: 'cultivation-science',
    title: 'Cultivation Science Reference Library',
    description: 'Deep cultivation science covering protected cultivation, outdoor systems, post-harvest biology, training and architecture, flowering, measurement science, physiology, propagation, nutrition, root-zone chemistry, genetics, and breeding.',
    eyebrow: 'Teaching Healthy Cultivation · Science', records: science
  },
  {
    slug: 'symptoms',
    title: 'Symptom Differential Library',
    description: 'Compare plausible causes of yellowing, chlorosis, necrosis, curling, wilting, bleaching, pigmentation, stunting, distorted growth, root decline, stem lesions, and flower collapse without relying on one-symptom diagnosis charts.',
    eyebrow: 'Teaching Healthy Cultivation · Diagnostics', records: symptoms
  },
  {
    slug: 'tools',
    title: 'THC Printable Field Tools & Worksheets',
    description: 'Print-ready records for plant-health intake, pest scouting, quarantine, VPD, PPFD mapping, irrigation, pH and EC calibration, seed and clone tracking, phenotype scoring, outdoor surveys, harvest maturity, drying, and storage.',
    eyebrow: 'Teaching Healthy Cultivation · Tools', records: tools, print: true
  },
  {
    slug: 'sources',
    title: 'THC Evidence & Research Sources',
    description: 'Research and extension references supporting Teaching Healthy Cultivation lessons, with an emphasis on traceable evidence, measurement quality, greenhouse/IPM principles, and cannabis plant science.',
    eyebrow: 'Teaching Healthy Cultivation · Evidence', records: sources
  }
];

for (const page of pages) {
  const dir = join(root, page.slug);
  await mkdir(dir, { recursive: true });
  const html = renderPage(page);
  for (const marker of ['data-reference-progressive-disclosure="true"', 'data-reference-group="true"', 'data-reference-record="true"']) {
    if (!html.includes(marker)) throw new Error(`${page.slug} output is missing progressive disclosure marker ${marker}`);
  }
  assertUniqueIds(html, page.slug);
  await writeFile(join(dir, 'index.html'), html);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceRepo: 'dtfgenetics/Dtf420',
  sourceCommit: DTF420_SHA,
  presentation: 'grouped-progressive-disclosure',
  routes: pages.map((p) => ({ slug: p.slug, recordCount: dedupe(p.records).length, topicGroupCount: groupRecords(dedupe(p.records)).length })),
  sourceFiles
};
await writeFile(join(root, 'dtf420-education-expansion-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
