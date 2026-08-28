import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-center-expansion';
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learn-Expansion/1.0' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learn-expansion-nav-${stamp}`);
await mkdir(backupDir, { recursive: true });

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    redirect: 'follow', signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
  return body;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}
function esc(value = '') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

const cards = [
  ['/learn/cultivation-science/', 'Cultivation Science', 'Protected cultivation, outdoor systems, physiology, flowering, training, post-harvest science, measurement, propagation, nutrition, genetics, and breeding.'],
  ['/learn/symptoms/', 'Symptom Differentials', 'Compare multiple plausible causes before deciding what yellowing, necrosis, curling, wilting, distortion, root decline, or flower damage means.'],
  ['/learn/tools/', 'Printable Field Tools', 'Fourteen structured worksheets for scouting, plant-health intake, quarantine, environment, light mapping, irrigation, meters, propagation, selection, harvest, drying, and storage.'],
  ['/learn/sources/', 'Evidence & Sources', 'Research and extension references supporting THC lessons and measurement-first cultivation education.']
];

const start = '<!-- DTF-EDUCATION-EXPANSION-V1-START -->';
const end = '<!-- DTF-EDUCATION-EXPANSION-V1-END -->';
const section = `${start}<section id="thc-education-expansion-v1" style="background:#f7faf7;margin:0;padding:54px 22px"><div style="max-width:1240px;margin:auto"><p style="margin:0 0 8px;color:#176d39;font-weight:900;letter-spacing:.11em;text-transform:uppercase">Teaching Healthy Cultivation · Expanded Reference System</p><h2 style="margin:0 0 14px;font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.03em;color:#15341f">Go deeper with the newly released science, diagnostics, tools, and evidence.</h2><p style="max-width:900px;line-height:1.75;color:#496253">These source-controlled learning surfaces bring the validated Dtf420 education libraries into the production WordPress site without replacing the existing Academy, Encyclopedia, Atlas, infographics, Grow Doc, or GrowLens.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px;margin-top:26px">${cards.map(([href,title,text]) => `<article style="background:#fff;border:1px solid #d6e4d9;border-radius:20px;padding:22px"><h3 style="margin:0 0 9px;color:#15341f">${esc(title)}</h3><p style="color:#496253;line-height:1.6">${esc(text)}</p><a href="${esc(href)}" style="display:inline-block;padding:10px 14px;border-radius:999px;background:#176d39;color:#fff;text-decoration:none;font-weight:900">Open</a></article>`).join('')}</div></div></section>${end}`;

const pages = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(pages) || pages.length !== 1) throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid'}`);
const page = pages[0];
await writeFile(join(backupDir, `learn-page-${page.id}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
let content = raw(page.content);
const i = content.indexOf(start);
const j = content.indexOf(end);
if (i >= 0 && j > i) content = `${content.slice(0, i)}${section}${content.slice(j + end.length)}`;
else content = `${content}\n${section}`;

await request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content, status: 'publish' }) });

let verified = false;
for (let attempt = 1; attempt <= 8; attempt++) {
  const response = await fetch(`${siteUrl}/learn/?dtf_expansion_nav=${Date.now()}-${attempt}`, { headers: { 'Cache-Control':'no-cache, no-store,max-age=0', Pragma:'no-cache' }, redirect:'follow', signal:AbortSignal.timeout(60_000) });
  const html = await response.text();
  if (response.ok && cards.every(([href]) => html.includes(href))) { verified = true; break; }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
if (!verified) throw new Error('Live Learn page did not expose every expansion route');
console.log(JSON.stringify({ pageId: page.id, routes: cards.map(([href]) => href), liveVerification: 'success', backupDir }, null, 2));
