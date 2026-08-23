import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-center';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Center/1.1' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learn-center-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

const start = '<!-- DTF-LEARNING-CENTER-START -->';
const end = '<!-- DTF-LEARNING-CENTER-END -->';
const cards = [
  ['/learn/start-here/', 'Start Here', 'A beginner-friendly path through plant stage, grow-space safety, environment, roots, plant health, and records.'],
  ['/learn/library/', 'Education Library', 'The gateway to THC learning centers, Academy, Encyclopedia, visual education, diagnostics, and tools.'],
  ['/learn/beginner-guides/', 'Beginner Guides', 'A practical sequence from setup and propagation through light, root-zone care, plant health, and reference use.'],
  ['/learn/academy/', 'THC Academy', 'Course-based learning that connects plant science, evidence, cultivation interpretation, and practical application.'],
  ['/learn/encyclopedia/', 'Plant Science Encyclopedia', 'The public gateway into the structured 21-part, 420-record THC plant-science reference architecture.'],
  ['/learn/infographics/', 'Infographic Library', 'Source-controlled visual education covering anatomy, roots, nutrition, climate, plant health, propagation, and more.'],
  ['/learn/sops/', 'SOPs & Measurement', 'Repeatable pH, EC, PPFD, DLI, VPD, scouting, sanitation, calibration, and recordkeeping practices.'],
  ['/learn/glossary/', 'Cultivation Glossary', 'Plain-language definitions for common plant-science and cultivation measurements and terms.'],
  ['/learn/records/', 'Printables & Records', 'Print-friendly daily logs, irrigation records, plant observations, IPM scouting, and breeding selection sheets.'],
  ['/learn/search/', 'Search THC Education', 'Search the customer-facing education system by plant-science or cultivation topic.'],
  ['/learn/setup/', 'Set Up Before You Grow', 'Location, electrical and water safety, equipment mapping, sanitation, pest exclusion, and empty-room commissioning.'],
  ['/learn/root-zone/', 'Root Zone, Water & Nutrition', 'Media, root oxygen, water chemistry, pH and EC, irrigation, dryback, nutrient mixing, diagnosis, and corrective action.'],
  ['/learn/environment/', 'Light, Climate & Canopy', 'PPFD, DLI, fixture distribution, photoperiod, temperature, humidity, VPD, airflow, mapping, alarms, and CO₂ safety.'],
  ['/learn/plant-health/', 'Plant Health & IPM', 'Scouting, abiotic-versus-biotic reasoning, arthropods, disease prevention, quarantine, lawful controls, disposal, and CAPA.'],
  ['/learn/propagation/', 'Genetics & Propagation', 'Identity, provenance, crop planning, mother stock, cuttings, rooting, acclimation, clone release, tissue culture, and preservation.'],
];

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const section = `${start}
<section id="thc-learning-centers" style="background:#edf5ef;margin:0;padding:58px 22px">
  <div style="max-width:1240px;margin:auto">
    <p style="margin:0 0 8px;color:#176d39;font-weight:900;letter-spacing:.11em;text-transform:uppercase">Teaching Healthy Cultivation · Customer Learning System</p>
    <h2 style="margin:0 0 14px;font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.03em;color:#15341f">Choose a path, search a topic, or diagnose a plant.</h2>
    <p style="max-width:900px;line-height:1.75;color:#496253;font-size:1.05rem">The THC education system connects beginner guides, Academy courses, Encyclopedia references, infographics, measurement SOPs, printables, diagnostics, and grow tools so visitors can move from a question to the right depth of information.</p>
    <p style="margin:20px 0"><a href="/learn/search/" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#15341f;color:#fff;text-decoration:none;font-weight:900">Search THC Education</a> <a href="/thc-grow-doc/" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#176d39;color:#fff;text-decoration:none;font-weight:900">Diagnose a Plant</a> <a href="/learn/start-here/" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#fff;color:#176d39;border:1px solid #176d39;text-decoration:none;font-weight:900">Start Here</a></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px;margin-top:26px">
      ${cards.map(([href, title, text]) => `<article style="background:#fff;border:1px solid #d6e4d9;border-radius:20px;padding:22px;box-shadow:0 10px 26px rgba(22,64,35,.06)"><h3 style="margin:0 0 9px;font-size:1.18rem;color:#15341f">${esc(title)}</h3><p style="margin:0 0 17px;color:#496253;line-height:1.6">${esc(text)}</p><a href="${esc(href)}" style="display:inline-block;padding:10px 14px;border-radius:999px;background:#176d39;color:#fff;text-decoration:none;font-weight:900">Open</a></article>`).join('')}
    </div>
  </div>
</section>
${end}`;

const pages = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(pages) || pages.length !== 1) {
  throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
}

const page = pages[0];
await writeFile(join(backupDir, `learn-page-${page.id}-before.json`), `${JSON.stringify(page, null, 2)}\n`);

let content = raw(page.content);
const existingStart = content.indexOf(start);
const existingEnd = content.indexOf(end);
if (existingStart >= 0 && existingEnd > existingStart) {
  content = `${content.slice(0, existingStart)}${section}${content.slice(existingEnd + end.length)}`;
} else {
  content = `${content}\n${section}`;
}

const updated = await request(`/wp-json/wp/v2/pages/${page.id}`, {
  method: 'POST',
  body: JSON.stringify({ content, status: 'publish' }),
});
await writeFile(join(backupDir, `learn-page-${page.id}-after.json`), `${JSON.stringify(updated, null, 2)}\n`);
await writeFile(join(backupRoot, 'learning-center-backup-path.txt'), `${backupDir}\n`);

const verifyUrl = `${siteUrl}/learn/?dtf_learning=${Date.now()}`;
const response = await fetch(verifyUrl, {
  headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-Learning-Center/1.1' },
  redirect: 'follow',
  signal: AbortSignal.timeout(60_000),
});
const html = await response.text();
if (!response.ok) throw new Error(`Live Learn verification failed (${response.status})`);
for (const required of [
  'Choose a path, search a topic, or diagnose a plant.',
  '/learn/start-here/', '/learn/library/', '/learn/beginner-guides/', '/learn/academy/',
  '/learn/encyclopedia/', '/learn/infographics/', '/learn/sops/', '/learn/glossary/',
  '/learn/records/', '/learn/search/', '/learn/setup/', '/learn/root-zone/',
  '/learn/environment/', '/learn/plant-health/', '/learn/propagation/', '/thc-grow-doc/'
]) {
  if (!html.includes(required)) throw new Error(`Live Learn page is missing required learning-center marker: ${required}`);
}

console.log(JSON.stringify({
  pageId: page.id,
  pageUrl: `${siteUrl}/learn/`,
  backupDir,
  learningCenterRoutes: cards.map(([href]) => href),
  liveVerification: 'success',
}, null, 2));
