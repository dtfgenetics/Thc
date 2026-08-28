import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'site/public-route-patch/learn');
const DTF420_SHA = '1427a9e1619a76a04b07c879d39b2af3b5b8806e';
const RAW = `https://raw.githubusercontent.com/dtfgenetics/Dtf420/${DTF420_SHA}/content`;

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

async function fetchJson(name) {
  const response = await fetch(`${RAW}/${name}`, {
    headers: { 'User-Agent': 'DTFSeeds-Production-Education-Importer/1.0' },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Could not fetch ${name} from pinned Dtf420 source (${response.status})`);
  return response.json();
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

const style = `<style>
:root{--ink:#15341f;--muted:#496253;--green:#176d39;--deep:#0d2c1a;--cream:#f7faf7;--line:#d6e4d9;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1220px;margin:auto;padding:42px 22px 78px}.hero{padding:24px 0 20px}.eyebrow{font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--green);font-size:.82rem}h1{font-size:clamp(2.2rem,5vw,4.3rem);line-height:1.03;letter-spacing:-.04em;margin:.22em 0}.lede{max-width:900px;color:var(--muted);font-size:1.08rem;line-height:1.7}.meta{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.pill{padding:8px 12px;border-radius:999px;background:#e7f2ea;color:var(--deep);font-weight:800}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}.btn{display:inline-block;padding:10px 14px;border-radius:999px;background:var(--green);color:white;text-decoration:none;font-weight:900}.btn.alt{background:white;color:var(--green);border:1px solid var(--green)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}.record{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 10px 26px rgba(22,64,35,.05);break-inside:avoid}.record h2{font-size:1.3rem;margin:0 0 7px}.record .cat{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--green);font-weight:900}.record>p{color:var(--muted);line-height:1.6}.record details{margin-top:12px}.record summary{cursor:pointer;font-weight:900;color:var(--green)}.field{margin-top:15px;padding-top:13px;border-top:1px solid var(--line)}.field h4{margin:0 0 6px;font-size:.92rem}.field p,.field li{color:var(--muted);line-height:1.55}.field ul{padding-left:20px}.nested{padding:9px 12px;margin:8px 0;border-left:3px solid #b8d4bf;background:#f8fbf8}.source-note{margin:34px 0 0;padding:20px;border-radius:18px;background:var(--deep);color:#e7f5ea}.source-note code{color:#d9f06e}@media print{.toolbar,.source-note{display:none}.record{box-shadow:none;break-inside:avoid}body{background:#fff}main{max-width:none;padding:10mm}}
</style>`;

function renderPage({ slug, title, description, eyebrow, records, print = false }) {
  const clean = dedupe(records);
  const categories = new Set(clean.map((x) => x.category).filter(Boolean));
  const cards = clean.map((record, index) => {
    const heading = record.title || record.name || record.citation || record.id || `Reference ${index + 1}`;
    const summary = record.summary || record.purpose || record.description || record.abstract || record.notes || '';
    return `<article class="record" id="${esc(record.slug || record.id || `record-${index + 1}`)}"><div class="cat">${esc(record.category || record.type || 'THC reference')}</div><h2>${esc(heading)}</h2>${summary ? `<p>${esc(summary)}</p>` : ''}<details><summary>Open full reference</summary>${renderObject(record)}</details></article>`;
  }).join('');
  const canonical = `https://dtfseeds.com/learn/${slug}/`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">${style}</head><body><main><header class="hero"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p><div class="meta"><span class="pill">${clean.length} references</span>${categories.size ? `<span class="pill">${categories.size} topic groups</span>` : ''}<span class="pill">Teaching Healthy Cultivation</span></div><div class="toolbar"><a class="btn" href="/learn/">Back to Learn</a><a class="btn alt" href="/learn/search/">Search education</a>${print ? `<a class="btn alt" href="javascript:window.print()">Print / Save PDF</a>` : ''}</div></header><div class="grid">${cards}</div><aside class="source-note"><strong>Source-controlled release.</strong> This production page is generated from the validated Dtf420 education libraries pinned at <code>${DTF420_SHA}</code>. Visual briefs are teaching requirements, not claims that unfinished artwork is already published.</aside></main></body></html>`;
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
  await writeFile(join(dir, 'index.html'), renderPage(page));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceRepo: 'dtfgenetics/Dtf420',
  sourceCommit: DTF420_SHA,
  routes: pages.map((p) => ({ slug: p.slug, recordCount: dedupe(p.records).length })),
  sourceFiles
};
await writeFile(join(root, 'dtf420-education-expansion-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
