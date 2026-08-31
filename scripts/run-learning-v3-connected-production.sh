#!/usr/bin/env bash
set -euo pipefail

learning_root="${BACKUP_ROOT:-/tmp/dtf-learning-v3}"
map_root="${LEARNING_V4_BACKUP_ROOT:-/tmp/dtf-learning-v4-final}"

# Learning Experience V3 is the sole /learn root writer. Refuse to publish if
# the independent static Hostinger overlay ever regains that route.
if grep -Eq '^[[:space:]]+learn$' scripts/deploy/hostinger-overlay.sh; then
  echo 'Learning ownership violation: static Hostinger overlay contains /learn.' >&2
  exit 1
fi

# Learning writes must not be visitor-verified through a stale Hostinger cache.
# The IPv4 fetch bootstrap marks successful WordPress mutations and requires a
# LiteSpeed purge before the next anonymous public request.
export DTF_REQUIRE_CACHE_CONVERGENCE=true

node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/run-learning-v3-production.mjs | tee /tmp/dtf-learning-v3-output.json

APPLY_LEARNING_V4=true \
BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/improve-wordpress-learning-v4.mjs | tee /tmp/dtf-learning-v4-final-output.json

EXPANDED_REFERENCE_BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs --input-type=module - <<'NODE' | tee /tmp/dtf-learning-expanded-reference-output.json
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.EXPANDED_REFERENCE_BACKUP_ROOT || '/tmp/dtf-learning-v4-final';
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Expanded-References/1.0' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if ((response.status === 429 || response.status >= 500) && attempt < 6) {
        await sleep(attempt * 1800);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 6) await sleep(attempt * 1800);
    }
  }
  throw lastError;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

function stripMarked(content, start, end) {
  let next = String(content || '');
  for (;;) {
    const first = next.indexOf(start);
    if (first < 0) return next;
    const last = next.indexOf(end, first + start.length);
    if (last < 0) throw new Error(`Found ${start} without matching ${end}`);
    next = `${next.slice(0, first)}${next.slice(last + end.length)}`;
  }
}

const routes = [
  ['/learn/plant-health/', 'Plant Health & IPM', 'Prevention, scouting, pest and disease references, and plant-health decision support.'],
  ['/learn/cultivation-science/', 'Cultivation Science', 'A deeper reference library spanning physiology, propagation, environment, nutrition, genetics, training, flowering, and post-harvest science.'],
  ['/learn/symptoms/', 'Symptom Differentials', 'Compare plausible causes before deciding what yellowing, necrosis, curling, wilting, distortion, root decline, or flower damage means.'],
  ['/learn/tools/', 'Printable Field Tools', 'Structured worksheets for scouting, environment, irrigation, meters, propagation, selection, harvest, drying, and storage.'],
  ['/learn/sources/', 'Evidence & Sources', 'Research and extension references supporting Teaching Healthy Cultivation lessons and measurement-first decisions.']
];
const start = '<!-- DTF-LEARN-EXPANDED-REFERENCE-V1-START -->';
const end = '<!-- DTF-LEARN-EXPANDED-REFERENCE-V1-END -->';
const mapEnd = '<!-- DTF-LEARN-GUIDED-V4-END -->';
const heading = 'Use the expanded reference systems when you need more depth.';
const ownershipPhrase = 'Learn the plant as a connected system.';
const section = `${start}\n<section class="section" id="expanded-reference-systems" data-dtf-learning-expanded-reference="v1"><div class="wrap"><div class="heading"><div><p class="eyebrow">Expanded references</p><h2>${heading}</h2></div><p>${ownershipPhrase} These deeper source-controlled libraries extend the guided THC learning path without creating a second Learn-page owner.</p></div><div class="path-grid">${routes.map(([href,title,text]) => `<article class="path-card"><h3>${title}</h3><p>${text}</p><a class="v3-text-link" href="${href}">Open reference <span aria-hidden="true">→</span></a></article>`).join('')}</div></div></section>\n${end}`;

const pages = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(pages) || pages.length !== 1) throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
const page = pages[0];
let content = raw(page.content);
if (!content.includes('data-dtf-layout="learn-v3"') || !content.includes('data-dtf-learning-map="v4"')) {
  throw new Error('Canonical Learning V3 + connected V4 markers are required before expanded references can publish.');
}
content = stripMarked(content, start, end);
const anchor = content.indexOf(mapEnd);
if (anchor < 0) throw new Error('Connected Learning V4 end marker was not found.');
const insertAt = anchor + mapEnd.length;
content = `${content.slice(0, insertAt)}\n${section}\n${content.slice(insertAt)}`;
for (const [href] of routes) if (!content.includes(href)) throw new Error(`Expanded Learn output is missing ${href}`);
if (!content.includes(heading) || !content.includes(ownershipPhrase)) throw new Error('Expanded Learn ownership markers are incomplete.');

const backupDir = join(backupRoot, `expanded-reference-${new Date().toISOString().replace(/[-:.]/g, '')}`);
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupDir, `learn-page-${page.id}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
await request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content, status: 'publish' }) });

let verified = false;
for (let attempt = 1; attempt <= 10; attempt += 1) {
  const response = await fetch(`${siteUrl}/learn/?dtf_expanded_reference=${Date.now()}-${attempt}`, {
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000)
  });
  const html = await response.text();
  if (response.ok && html.includes('data-dtf-layout="learn-v3"') && html.includes('data-dtf-learning-map="v4"') && html.includes('data-dtf-learning-expanded-reference="v1"') && html.includes(heading) && html.includes(ownershipPhrase) && routes.every(([href]) => html.includes(href))) {
    verified = true;
    break;
  }
  await sleep(3500);
}
if (!verified) throw new Error('Live Learn page did not expose the canonical expanded reference links after publication.');

const report = { generatedAt: new Date().toISOString(), pageId: page.id, canonicalOwner: 'Learning Experience V3', routes: routes.map(([href]) => href), liveVerification: 'success', backupDir };
await writeFile(join(backupDir, 'expanded-reference-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
NODE

test -s "$map_root/learning-v4-backup-path.txt"
echo "Canonical Learning V3, connected Learning V4 map, and expanded THC references published as one owner transaction."
