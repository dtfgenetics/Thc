import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARNING_V4 || '').toLowerCase() === 'true';
const guidePath = process.env.LEARNING_GUIDE_V4_PATH || 'site/wordpress/education/learning-guides-v4.json';
const literaturePath = process.env.TOPIC_LITERATURE_PATH || 'site/wordpress/education/topic-literature.json';
const encyclopediaPath = process.env.ENCYCLOPEDIA_TOPIC_FILE || 'configuration/encyclopedia-topics.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-v4';
if (!user || !pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Learning-V4/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 6) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 6) await sleep(attempt * 1500);
    }
  }
  throw last;
}

const guide = JSON.parse(await readFile(guidePath, 'utf8'));
const literature = JSON.parse(await readFile(literaturePath, 'utf8'));
const encyclopedia = JSON.parse(await readFile(encyclopediaPath, 'utf8'));
if (guide?.schemaVersion !== 1 || !guide?.topics || Object.keys(guide.topics).length !== 12) throw new Error('Learning V4 guide must define exactly 12 topics');
if (!Array.isArray(guide.tracks) || guide.tracks.length < 4) throw new Error('Learning V4 guide must define at least four learning tracks');
if (!Array.isArray(literature?.topics) || literature.topics.length < 12) throw new Error('Canonical topic literature is incomplete');
if (!Array.isArray(encyclopedia?.topics) || encyclopedia.topics.length !== 21) throw new Error('Encyclopedia topic configuration must contain 21 hubs');

const rules = [
  { id: 'plant-biology', terms: ['plant biology'] },
  { id: 'genetics-breeding', terms: ['genetics', 'breeding'] },
  { id: 'lifecycle-propagation', terms: ['lifecycle', 'propagation'] },
  { id: 'environment-vpd', terms: ['environment', 'vpd'] },
  { id: 'lighting', terms: ['lighting'] },
  { id: 'water-root-zone', terms: ['water', 'root zone'] },
  { id: 'nutrition-media', terms: ['nutrition', 'media'] },
  { id: 'training-canopy', terms: ['training', 'canopy'] },
  { id: 'plant-health-ipm', terms: ['plant health', 'ipm'] },
  { id: 'harvest-postharvest', terms: ['harvest', 'post-harvest'] },
  { id: 'outdoor-cultivation', terms: ['outdoor'] },
  { id: 'evidence-measurement', terms: ['evidence', 'measurement'] }
];
const used = new Set();
const normalizedTopics = literature.topics.map(topic => {
  const hay = `${topic.id || ''} ${topic.title || ''}`.toLowerCase();
  const rule = rules.find(candidate => !used.has(candidate.id) && candidate.terms.some(term => hay.includes(term)));
  if (!rule) return topic;
  used.add(rule.id);
  return { ...topic, id: rule.id };
});
const topicIndex = new Map(normalizedTopics.map(topic => [topic.id, topic]));
const encyclopediaIndex = new Map(encyclopedia.topics.map(topic => [topic.slug, topic]));
for (const id of Object.keys(guide.topics)) if (!topicIndex.has(id)) throw new Error(`Learning guide topic ${id} has no canonical subject page`);
for (const [id, item] of Object.entries(guide.topics)) {
  for (const slug of item.encyclopedia || []) if (!encyclopediaIndex.has(slug)) throw new Error(`${id}: unknown encyclopedia hub ${slug}`);
}

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `learning-v4-${stamp}`);
await mkdir(backupDir, { recursive: true });

const styleId = 'dtf-learning-v4-style';
const css = `<style id="${styleId}">
.dtf-learning-v4{--e4-deep:#07170f;--e4-forest:#0e2f1d;--e4-green:#26784a;--e4-gold:#d7b965;--e4-cream:#f7f3e9;--e4-paper:#fffdf7;--e4-ink:#112b1c;--e4-muted:#586b5f;--e4-line:#d8e2da;color:var(--e4-ink);background:linear-gradient(180deg,#f8f5ed,#f1f5ee)}
.dtf-learning-v4 *{box-sizing:border-box}.dtf-learning-v4 .e4-wrap{width:min(1200px,calc(100% - 36px));margin:auto}.dtf-learning-v4 .e4-section{padding:58px 0}.dtf-learning-v4 .e4-kicker{margin:0 0 9px;color:#7b672d;font-size:.72rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.dtf-learning-v4 h2{margin:0;font-size:clamp(2rem,4vw,3.4rem);line-height:1;letter-spacing:-.045em}.dtf-learning-v4 h3{margin:0 0 9px;font-size:1.18rem;line-height:1.2}.dtf-learning-v4 p{color:var(--e4-muted);line-height:1.68}.dtf-learning-v4 a{color:var(--e4-green);font-weight:850}.dtf-learning-v4 .e4-intro{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-bottom:18px}.dtf-learning-v4 .e4-focus,.dtf-learning-v4 .e4-nav,.dtf-learning-v4 .e4-card,.dtf-learning-v4 .e4-deep-card{border:1px solid var(--e4-line);border-radius:22px;background:rgba(255,253,247,.96);box-shadow:0 12px 32px rgba(18,49,29,.06)}.dtf-learning-v4 .e4-focus{padding:28px;background:radial-gradient(circle at 88% 10%,rgba(215,185,101,.22),transparent 28%),linear-gradient(145deg,#0a2416,#153b26);color:#fff;border-color:#244f35}.dtf-learning-v4 .e4-focus .e4-kicker{color:#ead48c}.dtf-learning-v4 .e4-focus h2{font-size:clamp(1.8rem,3.5vw,3rem)}.dtf-learning-v4 .e4-focus p{color:#d6e4da;font-size:1.04rem}.dtf-learning-v4 .e4-nav{padding:24px}.dtf-learning-v4 .e4-label{display:inline-flex;margin:0 6px 7px 0;padding:6px 9px;border-radius:999px;background:#e8f0e8;color:#2d6541;font-size:.7rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.dtf-learning-v4 .e4-route{display:grid;gap:8px;margin-top:12px}.dtf-learning-v4 .e4-route a{display:block;padding:10px 12px;border-radius:12px;background:#f1f5ef;text-decoration:none}.dtf-learning-v4 .e4-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}.dtf-learning-v4 .e4-card{padding:23px}.dtf-learning-v4 ul,.dtf-learning-v4 ol{margin:14px 0 0;padding-left:20px}.dtf-learning-v4 li{margin:8px 0;color:#43584a;line-height:1.55}.dtf-learning-v4 .e4-card.measure li::marker{color:#26784a}.dtf-learning-v4 .e4-card.mistakes{border-color:#e3d6c4;background:#fffaf1}.dtf-learning-v4 .e4-card.mistakes li::marker{color:#a06a33}.dtf-learning-v4 .e4-card.exercise{border-color:#cbdacb;background:#f7fbf6}.dtf-learning-v4 .e4-deep{margin-top:18px;padding:26px;border-radius:23px;background:linear-gradient(145deg,#eaf1e9,#f7f3e9);border:1px solid var(--e4-line)}.dtf-learning-v4 .e4-deep-head{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:16px}.dtf-learning-v4 .e4-deep-head h2{font-size:clamp(1.7rem,3vw,2.6rem)}.dtf-learning-v4 .e4-deep-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.dtf-learning-v4 .e4-deep-card{display:block;padding:17px;text-decoration:none!important;color:var(--e4-ink)!important}.dtf-learning-v4 .e4-deep-card span{display:block;margin-bottom:5px;color:#7d6b36;font-size:.67rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.dtf-learning-v4 .e4-deep-card strong{display:block;line-height:1.25}.dtf-learning-v4 .e4-track-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;margin-top:20px}.dtf-learning-v4 .e4-track{padding:25px;border-radius:23px;background:#fff;border:1px solid var(--e4-line);box-shadow:0 12px 30px rgba(18,49,29,.055)}.dtf-learning-v4 .e4-track h3{font-size:1.35rem}.dtf-learning-v4 .e4-steps{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}.dtf-learning-v4 .e4-steps a{padding:7px 10px;border-radius:999px;background:#edf3ec;border:1px solid #d6e1d8;text-decoration:none!important;font-size:.82rem}.dtf-learning-v4 .e4-why{margin-top:22px;padding:22px 24px;border-radius:22px;background:#0e2f1d;color:#fff}.dtf-learning-v4 .e4-why h3{color:#fff}.dtf-learning-v4 .e4-why p{margin-bottom:0;color:#d0ded4}.dtf-learning-v4 .e4-why strong{color:#efd98f}
@media(max-width:920px){.dtf-learning-v4 .e4-intro,.dtf-learning-v4 .e4-grid{grid-template-columns:1fr}.dtf-learning-v4 .e4-deep-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.dtf-learning-v4 .e4-wrap{width:min(100% - 28px,1200px)}.dtf-learning-v4 .e4-section{padding:46px 0}.dtf-learning-v4 .e4-track-grid,.dtf-learning-v4 .e4-deep-grid{grid-template-columns:1fr}.dtf-learning-v4 .e4-deep-head{align-items:flex-start;flex-direction:column}}
</style>`;

function topicLink(id, label = null) {
  const topic = topicIndex.get(id);
  if (!topic) return '';
  return `<a href="${esc(topic.route)}">${esc(label || topic.title)}</a>`;
}

function encyclopediaCards(slugs) {
  return (slugs || []).map(slug => {
    const item = encyclopediaIndex.get(slug);
    return `<a class="e4-deep-card" href="/learn/encyclopedia/${esc(slug)}/"><span>Part ${esc(item.part)}</span><strong>${esc(item.title)}</strong></a>`;
  }).join('');
}

function topicBlock(id) {
  const guideItem = guide.topics[id];
  const topic = topicIndex.get(id);
  const prereqs = (guideItem.prerequisites || []).length
    ? guideItem.prerequisites.map(item => topicLink(item)).join('')
    : '<span class="e4-label">Start here</span>';
  const next = guideItem.next ? topicLink(guideItem.next, `Next: ${topicIndex.get(guideItem.next)?.title || guideItem.next}`) : '';
  return `<!-- dtf-learning-v4:start --><section class="dtf-learning-v4" data-dtf-learning-v4="topic-${esc(id)}"><div class="e4-wrap e4-section">
    <div class="e4-intro"><article class="e4-focus"><p class="e4-kicker">Guided study · ${esc(guideItem.level)}</p><h2>${esc(guideItem.coreQuestion)}</h2><p>Use this question to organize the literature below. The goal is to connect observation to plant function before jumping to a correction.</p></article><aside class="e4-nav"><p class="e4-kicker">Learning order</p><h3>Prerequisites and next step</h3><div class="e4-route">${(guideItem.prerequisites || []).length ? (guideItem.prerequisites || []).map(item => topicLink(item)).join('') : '<span class="e4-label">No prerequisite subject</span>'}${next}</div></aside></div>
    <div class="e4-grid"><article class="e4-card measure"><p class="e4-kicker">Measure first</p><h3>Evidence to collect</h3><ul>${guideItem.measure.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article><article class="e4-card mistakes"><p class="e4-kicker">Interpret carefully</p><h3>Common reasoning errors</h3><ul>${guideItem.mistakes.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article><article class="e4-card exercise"><p class="e4-kicker">Apply it</p><h3>${esc(guideItem.exercise.title)}</h3><ol>${guideItem.exercise.steps.map(item => `<li>${esc(item)}</li>`).join('')}</ol></article></div>
    <div class="e4-deep"><div class="e4-deep-head"><div><p class="e4-kicker">Encyclopedia depth</p><h2>Go deeper after the subject overview.</h2></div><p>This subject page teaches the model. The encyclopedia hubs break that model into narrower reference lessons.</p></div><div class="e4-deep-grid">${encyclopediaCards(guideItem.encyclopedia)}</div></div>
  </div></section><!-- dtf-learning-v4:end -->`;
}

function learnBlock() {
  const cards = guide.tracks.map(track => `<article class="e4-track"><p class="e4-kicker">Guided path</p><h3>${esc(track.title)}</h3><p>${esc(track.description)}</p><div class="e4-steps">${track.topics.map(id => topicLink(id)).join('')}</div></article>`).join('');
  return `<!-- dtf-learning-v4:start --><section class="dtf-learning-v4" data-dtf-learning-v4="learn"><div class="e4-wrap e4-section"><p class="e4-kicker">Choose a learning path</p><h2>Learn in an order that builds usable understanding.</h2><div class="e4-track-grid">${cards}</div><div class="e4-why"><h3>How THC education is organized</h3><p><strong>Subject pages</strong> teach connected models. <strong>Encyclopedia hubs</strong> provide narrower reference lessons. <strong>Visuals</strong> support comparison and anatomy. <strong>Grow Doc and GrowLens</strong> help apply the same evidence-first process to real observations.</p></div></div></section><!-- dtf-learning-v4:end -->`;
}

function stripV4(content) {
  return String(content || '')
    .replace(new RegExp(`<style\\s+id=["']${styleId}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`, 'gi'), '')
    .replace(/<!-- dtf-learning-v4:start -->[\s\S]*?<!-- dtf-learning-v4:end -->\s*/gi, '');
}

function insertAfterHero(content, block) {
  const end = content.indexOf('</section>');
  if (end < 0) throw new Error('Could not find the end of the page hero');
  const at = end + '</section>'.length;
  return `${css}${content.slice(0, at)}\n${block}\n${content.slice(at)}`;
}

async function getPage(slug, ownerMarker) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`Expected at least one page for ${slug}; found ${Array.isArray(rows) ? rows.length : 'invalid'}`);
  if (rows.length === 1) return rows[0];

  const owned = ownerMarker ? rows.filter(row => rendered(row.content).includes(ownerMarker)) : [];
  if (owned.length === 1) {
    console.warn(`${slug}: found ${rows.length} pages; selected page ${owned[0].id} by canonical owner marker ${ownerMarker}`);
    return owned[0];
  }

  const candidates = rows.map(row => `${row.id}:${row.status || 'unknown'}`).join(', ');
  throw new Error(`${slug}: found ${rows.length} pages and ${owned.length} matched canonical owner marker ${ownerMarker || 'none'}; candidates=${candidates}`);
}

async function writePage(page, next, tag) {
  await writeFile(join(backupDir, `${tag}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
  if (!apply) return;
  await request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ content: next, status: 'publish' }) });
  const fresh = await request(`/wp-json/wp/v2/pages/${page.id}?context=edit`);
  const body = rendered(fresh.content);
  if (!body.includes(styleId) || !body.includes('data-dtf-learning-v4=')) throw new Error(`${tag}: V4 learning layer did not persist`);
}

const results = [];
const learnPage = await getPage('learn', 'data-dtf-layout="learn-v3"');
let learnContent = stripV4(rendered(learnPage.content));
if (!learnContent.includes('data-dtf-layout="learn-v3"')) throw new Error('Learn is not currently owned by the V3 learning experience; refusing to layer V4 over an unknown page');
await writePage(learnPage, insertAfterHero(learnContent, learnBlock()), 'learn');
results.push({ id: 'learn', route: '/learn/', pageId: learnPage.id });

for (const id of Object.keys(guide.topics)) {
  const topic = topicIndex.get(id);
  const slug = String(topic.route || '').split('/').filter(Boolean).at(-1);
  if (!slug) throw new Error(`${id}: canonical route is invalid`);
  const ownerMarker = `data-dtf-topic="${id}"`;
  const page = await getPage(slug, ownerMarker);
  let content = stripV4(rendered(page.content));
  if (!content.includes(ownerMarker)) throw new Error(`${id}: current WordPress subject page is not the expected V3 topic owner`);
  await writePage(page, insertAfterHero(content, topicBlock(id)), `topic-${id}`);
  results.push({ id, route: topic.route, pageId: page.id });
}

const report = { generatedAt: new Date().toISOString(), apply, guidePath, topicCount: Object.keys(guide.topics).length, trackCount: guide.tracks.length, results };
await writeFile(join(backupRoot, 'learning-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupDir, 'learning-v4-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
