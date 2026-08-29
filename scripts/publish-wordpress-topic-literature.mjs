import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-infographic-backups';
const literaturePath = process.env.TOPIC_LITERATURE_CONFIG || join(process.cwd(), 'site/wordpress/education/topic-literature.json');
const guidePath = process.env.INFOGRAPHIC_LEARNING_GUIDES || join(process.cwd(), 'site/wordpress/assets/infographics/infographic-learning-guides.json');
const placementPath = process.env.INFOGRAPHIC_PLACEMENT_CONFIG || join(process.cwd(), 'site/wordpress/assets/infographics/placement-rules.json');
const exclusionsPath = process.env.INFOGRAPHIC_EXCLUSIONS || join(process.cwd(), 'site/wordpress/assets/infographics/infographic-exclusions.json');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `topic-literature-${stamp}`);
await mkdir(backupDir, { recursive: true });

const literature = JSON.parse(await readFile(literaturePath, 'utf8'));
const learning = JSON.parse(await readFile(guidePath, 'utf8'));
const placement = JSON.parse(await readFile(placementPath, 'utf8'));
const exclusions = JSON.parse(await readFile(exclusionsPath, 'utf8'));
if (!Array.isArray(literature.topics) || literature.topics.length < 10) throw new Error('Topic literature catalog is incomplete');
if (!Array.isArray(learning.guides) || learning.guides.length < 10) throw new Error('Infographic learning guide catalog is incomplete');
if (!Array.isArray(learning.learningPaths) || learning.learningPaths.length < 4) throw new Error('Infographic learning paths are incomplete');
if (!Array.isArray(learning.libraryPrinciples) || learning.libraryPrinciples.length < 4) throw new Error('Infographic library principles are incomplete');
if (!Array.isArray(placement.categories) || placement.categories.length < 10) throw new Error('Infographic placement catalog is incomplete');
if (!exclusions.neverUseOnInfographicSurfaces) throw new Error('Infographic exclusion policy is not enforced');

const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'DTFSeeds-LiteratureFirst-Publisher/2.0'
};
const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const strip = (v = '') => String(v).replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
const rendered = (v) => typeof v === 'string' ? v : (v && typeof v === 'object' ? (v.rendered || v.raw || '') : '');
const norm = (v = '') => String(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replaceAll('\\', '/').replace(/[_-]+/g, ' ').replace(/[^a-z0-9/. ]+/g, ' ').replace(/\s+/g, ' ').trim();
const routeSlug = (route = '') => String(route).split('/').filter(Boolean).at(-1) || 'reference';
function hasAny(value, fragments = []) {
  const n = norm(value);
  const words = new Set(n.split(' '));
  return fragments.some((fragment) => {
    const f = norm(fragment);
    if (!f) return false;
    return f.length <= 3 && !f.includes(' ') ? words.has(f) : n.includes(f);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function getLearn() {
  const rows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected exactly one Learn page; found ${Array.isArray(rows) ? rows.length : 'invalid response'}`);
  return rows[0];
}
async function getChild(parentId, route) {
  const slug = routeSlug(route);
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&parent=${parentId}&context=edit&per_page=10`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected page response for ${route}`);
  if (rows.length > 1) throw new Error(`Multiple WordPress pages found for ${route}`);
  return rows[0] || null;
}
async function upsertChild(parentId, topic, content, featuredMedia = 0) {
  const existing = await getChild(parentId, topic.route);
  const slug = routeSlug(topic.route);
  if (existing) await writeFile(join(backupDir, `before-${slug}.json`), `${JSON.stringify(existing, null, 2)}\n`);
  const payload = {
    slug,
    parent: parentId,
    title: topic.title,
    content,
    status: 'publish',
    ...(featuredMedia > 0 ? { featured_media: featuredMedia } : {})
  };
  const page = existing
    ? await request(`/wp-json/wp/v2/pages/${existing.id}`, { method: 'POST', body: JSON.stringify(payload) })
    : await request('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(payload) });
  if (!page?.id || page?.status !== 'publish') throw new Error(`WordPress did not confirm ${topic.route}`);
  return page;
}

async function allEducationMedia() {
  const out = [];
  for (let page = 1; page <= 12; page += 1) {
    try {
      const rows = await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if (!Array.isArray(rows) || !rows.length) break;
      out.push(...rows);
      if (rows.length < 100) break;
    } catch (error) {
      if (/invalid_page|400/i.test(error.message)) break;
      throw error;
    }
  }
  return out.filter((m) => String(m.slug || '').startsWith('dtf-edu-') && (m.source_url || m.guid?.rendered));
}
function mediaText(media) {
  return `${media.slug || ''} ${strip(rendered(media.title))} ${strip(rendered(media.caption))} ${strip(rendered(media.description))} ${media.alt_text || ''}`;
}
function mediaSourcePath(media) {
  const description = strip(rendered(media.description));
  const match = description.match(/Repository path:\s*([^]+?)(?:\.\s*SHA-256:|$)/i);
  return match ? match[1].trim() : '';
}
function isExcludedMedia(media) {
  const sourcePath = mediaSourcePath(media);
  const text = `${sourcePath} ${mediaText(media)}`;
  const allowed = (exclusions.allowedExceptions || []).some((value) => hasAny(text, [value]));
  if (allowed) return false;
  return (exclusions.excludePathFragments || []).some((fragment) => hasAny(text, [fragment]));
}
const categoryById = new Map(placement.categories.map((c) => [c.id, c]));
const fallback = placement.categories.find((c) => c.id === 'general-reference') || placement.categories.at(-1);
function classifyMedia(media) {
  const value = `${mediaSourcePath(media)} ${mediaText(media)}`;
  const override = (placement.primaryOverrides || []).find((rule) => hasAny(value, rule.match || []) && categoryById.has(rule.categoryId));
  const primary = override
    ? categoryById.get(override.categoryId)
    : (placement.categories.find((c) => c.id !== fallback.id && hasAny(value, c.primaryMatch || [])) || fallback);
  const ids = new Set([primary.id]);
  for (const rule of placement.relatedPlacementRules || []) {
    if (hasAny(value, rule.match || [])) for (const id of rule.categoryIds || []) if (categoryById.has(id)) ids.add(id);
  }
  return { media, primaryCategoryId: primary.id, placementCategoryIds: [...ids] };
}

const allMedia = await allEducationMedia();
const excludedMedia = allMedia.filter(isExcludedMedia);
const eligibleMedia = allMedia.filter((m) => !isExcludedMedia(m)).map(classifyMedia);
if (eligibleMedia.length < 20) throw new Error(`Only ${eligibleMedia.length} eligible infographic media items remain after quality filtering`);

const guideById = new Map(learning.guides.map((guide) => [guide.id, guide]));
const topicById = new Map(literature.topics.map((topic) => [topic.id, topic]));
for (const topic of literature.topics) {
  if (!categoryById.has(topic.id)) throw new Error(`Literature topic ${topic.id} has no infographic placement category`);
  const guide = guideById.get(topic.id);
  if (!guide) throw new Error(`Literature topic ${topic.id} has no infographic learning guide`);
  if (!Array.isArray(guide.studyQuestions) || guide.studyQuestions.length < 3) throw new Error(`Learning guide ${topic.id} needs at least three study questions`);
  if (!Array.isArray(guide.measurements) || guide.measurements.length < 3) throw new Error(`Learning guide ${topic.id} needs at least three measurements`);
  if (!guide.whyItMatters || !guide.commonTrap) throw new Error(`Learning guide ${topic.id} is missing teaching context`);
}
for (const path of learning.learningPaths) {
  if (!path.title || !path.summary || !Array.isArray(path.topicIds) || path.topicIds.length < 2 || !Array.isArray(path.steps) || path.steps.length < 3) {
    throw new Error(`Invalid infographic learning path: ${path.title || 'untitled'}`);
  }
  for (const id of path.topicIds) if (!topicById.has(id)) throw new Error(`Learning path ${path.title} references unknown topic ${id}`);
}

function visualTitle(record) {
  return strip(rendered(record.media.title)) || strip(record.media.alt_text) || 'THC educational infographic';
}
function displayVisualTitle(record) {
  const original = visualTitle(record);
  if (!/^(?:THC[\s_-]*)?(?:ENC|C)[\s_-]*\d+/i.test(original)) return original.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = original
    .replace(/^THC[\s_-]*/i, '')
    .replace(/^(?:ENC|C)[\s_-]*\d+[\s_-]*/i, '')
    .replace(/^(?:VIS|ASSET)[\s_-]*\d+[\s_-]*/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || original;
}
function visualUrl(record) {
  return record.media.source_url || record.media.guid?.rendered || '';
}
function topicLabel(topicId) {
  return topicById.get(topicId)?.title || categoryById.get(topicId)?.title || 'Plant Science Reference';
}
function guideFor(topicId) {
  return guideById.get(topicId) || guideById.get('general-reference');
}
function countPrimary(records, topicId) {
  return records.filter((r) => r.primaryCategoryId === topicId).length;
}
function linkForTopic(topicId) {
  const topic = topicById.get(topicId);
  return topic ? `<a href="${esc(topic.route)}">${esc(topic.title)}</a>` : '';
}

function visualCard(record, topicRoute, { library = false } = {}) {
  const title = displayVisualTitle(record);
  const rawTitle = visualTitle(record);
  const url = visualUrl(record);
  const topic = topicById.get(record.primaryCategoryId) || topicById.get('general-reference');
  const guide = guideFor(record.primaryCategoryId);
  const cue = guide?.studyQuestions?.[0] || 'What relationship is this visual trying to explain?';
  const classes = library ? 'thc-visual-card thc-library-card' : 'thc-visual-card';
  const data = library ? ` data-search="${esc(norm([rawTitle, title, topic?.title, ...(topic?.keywords || []), guide?.whyItMatters || '', ...(guide?.measurements || [])].join(' ')))}" data-topic="${esc(topic?.id || record.primaryCategoryId)}"` : '';
  return `<article class="${classes}"${data}><a class="thc-visual-image" href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" loading="lazy" decoding="async" alt="${esc(title)}"></a><div class="thc-visual-body">${library ? `<span class="thc-topic-label">${esc(topic?.title || topicLabel(record.primaryCategoryId))}</span>` : ''}<strong>${esc(title)}</strong>${library ? `<p class="thc-card-cue"><b>Study question:</b> ${esc(cue)}</p>` : ''}<div class="thc-visual-links"><a href="${esc(topicRoute)}">${library ? 'Read topic literature' : 'Read companion literature'}</a><a href="${esc(url)}" target="_blank" rel="noopener">Full-size${library ? '' : ' visual'}</a></div></div></article>`;
}

const style = `<style>
.thc-topic{--deep:#0d2f1b;--deep2:#163f29;--green:#196a3c;--soft:#eef6f0;--cream:#fbfaf5;--gold:#c9a84b;--ink:#163623;--muted:#556b5d;--line:#d4e4d8;color:var(--ink)}.thc-topic *{box-sizing:border-box}.thc-topic a{color:#176b3b}.thc-hero{background:linear-gradient(135deg,#0b2b18,#195538);color:#fff;border-radius:24px;padding:clamp(28px,5vw,58px);margin:12px 0 30px;box-shadow:0 18px 50px rgba(9,39,22,.16)}.thc-hero .eyebrow{font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:.76rem;color:#c9e6d1}.thc-hero h1{font-size:clamp(2.2rem,5vw,4.3rem);line-height:1;margin:10px 0 14px}.thc-hero p{max-width:900px;color:#dcebe0;font-size:1.06rem;line-height:1.75}.thc-hero-stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.thc-stat{min-width:132px;padding:12px 14px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.08)}.thc-stat b{display:block;font-size:1.28rem;color:#fff}.thc-stat span{font-size:.78rem;color:#dcebe0}.thc-jump{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.thc-jump a{background:#fff;color:#173b26;text-decoration:none;padding:9px 12px;border-radius:999px;font-weight:800}.thc-literature{max-width:1020px;margin:auto}.thc-section{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(22px,4vw,38px);margin:18px 0;box-shadow:0 10px 26px rgba(17,55,31,.05)}.thc-section h2{font-size:clamp(1.45rem,3vw,2.15rem);margin:0 0 14px}.thc-section p{font-size:1.02rem;line-height:1.78;color:#304c3a}.thc-section ul{line-height:1.7;background:var(--soft);border-radius:14px;padding:16px 18px 16px 38px}.thc-note{background:#eff6f0;border-left:4px solid #2c7a4c;padding:16px 18px;border-radius:10px;line-height:1.65}.thc-study-guide{margin:22px 0 30px;padding:clamp(22px,4vw,36px);border-radius:22px;background:linear-gradient(145deg,#f8f6ec,#eef5ef);border:1px solid #d9e5dc}.thc-study-guide h2,.thc-learning-system h2{margin-top:0}.thc-study-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:18px}.thc-study-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px}.thc-study-panel h3{margin:0 0 10px;font-size:1.05rem}.thc-study-panel ul{margin:0;padding-left:20px;line-height:1.65}.thc-warning{border-left:4px solid var(--gold)}.thc-connected{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.thc-connected a{display:inline-flex;padding:8px 10px;border-radius:999px;background:#fff;border:1px solid var(--line);font-weight:800;text-decoration:none;font-size:.86rem}.thc-visuals{margin:48px 0}.thc-visuals-head{max-width:850px;margin-bottom:18px}.thc-visual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:18px}.thc-visual-card{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 25px rgba(17,55,31,.07)}.thc-visual-image{display:flex;aspect-ratio:4/5;padding:10px;background:#f3f7f4;align-items:center;justify-content:center}.thc-visual-image img{width:100%;height:100%;object-fit:contain}.thc-visual-body{padding:15px}.thc-visual-body>strong{display:block;line-height:1.35}.thc-topic-label{display:block;color:#28744a;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}.thc-card-cue{color:#51665a;font-size:.86rem;line-height:1.5;margin:9px 0 0}.thc-visual-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:.86rem}.thc-visual-links a{font-weight:800}.thc-learning-system{margin:0 0 28px}.thc-principles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0 26px}.thc-principle{padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:16px;line-height:1.6}.thc-path-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.thc-path{padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--cream)}.thc-path h3{margin:0 0 8px}.thc-path p{color:#4c6355;line-height:1.55}.thc-path ol{padding-left:20px;line-height:1.55;font-size:.9rem}.thc-path-links{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.thc-path-links a{font-size:.8rem;font-weight:800}.thc-library-search{margin:26px 0;padding:20px;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 8px 26px rgba(17,55,31,.04)}.thc-search-controls{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-top:9px}.thc-library-search input,.thc-library-search select{width:100%;padding:14px 16px;border:1px solid #abc7b3;border-radius:12px;font-size:1rem;background:#fff;color:#163623}.thc-library-card[hidden]{display:none!important}.thc-topic-directory{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:12px;margin-bottom:34px}.thc-topic-directory a{display:block;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;text-decoration:none;box-shadow:0 8px 22px rgba(17,55,31,.04)}.thc-topic-directory strong{display:block}.thc-topic-directory span{display:block;color:#5b6e61;font-size:.88rem;margin-top:5px;line-height:1.45}.thc-topic-directory em{display:block;color:#2b6343;font-style:normal;font-size:.82rem;margin-top:9px}.thc-empty{padding:24px;border:1px dashed #a9c3b1;border-radius:16px;background:#f7faf7}.thc-library-foot{margin-top:32px}.thc-library-foot-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px}.thc-library-foot-links a{font-weight:800}
@media(max-width:760px){.thc-study-grid,.thc-search-controls,.thc-principles{grid-template-columns:1fr}.thc-hero{border-radius:18px}.thc-stat{min-width:calc(50% - 5px)}.thc-visual-grid{grid-template-columns:1fr}}
</style>`;

function studyGuideHtml(topic) {
  const guide = guideFor(topic.id);
  const connected = (guide.connectedTopicIds || []).map(linkForTopic).filter(Boolean).join('');
  return `<section class="thc-study-guide" aria-labelledby="study-${esc(topic.id)}"><h2 id="study-${esc(topic.id)}">How to study ${esc(topic.title)}</h2><p>${esc(guide.whyItMatters)}</p><div class="thc-study-grid"><div class="thc-study-panel"><h3>Questions to answer</h3><ul>${guide.studyQuestions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div><div class="thc-study-panel"><h3>Measurements and context to record</h3><ul>${guide.measurements.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div></div><div class="thc-study-panel thc-warning" style="margin-top:18px"><h3>Common interpretation trap</h3><p>${esc(guide.commonTrap)}</p></div>${connected ? `<h3 style="margin-bottom:8px">Connected subjects</h3><div class="thc-connected">${connected}</div>` : ''}</section>`;
}

function topicContent(topic, records) {
  const direct = records.filter((r) => r.primaryCategoryId === topic.id);
  const related = records.filter((r) => r.primaryCategoryId !== topic.id && r.placementCategoryIds.includes(topic.id));
  const visuals = [...direct, ...related].sort((a, b) => displayVisualTitle(a).localeCompare(displayVisualTitle(b)));
  const jumps = `<a href="#study-${topic.id}">Study guide</a>` + topic.sections.map((s, i) => `<a href="#lit-${topic.id}-${i + 1}">${esc(s.heading)}</a>`).join('') + `<a href="#infographics">Infographics</a>`;
  const sections = topic.sections.map((section, index) => `<section class="thc-section" id="lit-${esc(topic.id)}-${index + 1}"><h2>${esc(section.heading)}</h2>${(section.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}${section.checkpoints?.length ? `<h3>Use this in practice</h3><ul>${section.checkpoints.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}</section>`).join('');
  const gallery = visuals.length ? `<div class="thc-visual-grid">${visuals.map((r) => visualCard(r, topic.route)).join('')}</div>` : '<div class="thc-empty"><p>No finished infographic is assigned to this topic yet. The literature remains available while the visual is developed and reviewed.</p></div>';
  return `${style}<div class="thc-topic"><section class="thc-hero"><span class="eyebrow">Teaching Healthy Cultivation · Companion literature</span><h1>${esc(topic.title)}</h1><p>${esc(topic.summary)}</p><div class="thc-hero-stats"><div class="thc-stat"><b>${direct.length}</b><span>primary infographics</span></div><div class="thc-stat"><b>${related.length}</b><span>related visuals</span></div><div class="thc-stat"><b>${topic.sections.length}</b><span>literature sections</span></div></div><div class="thc-jump">${jumps}</div></section><main class="thc-literature"><p class="thc-note"><strong>Literature first:</strong> this page is the canonical subject explanation. Infographics summarize and reinforce the material below; they are not substitutes for the written context, measurements, or evidence.</p>${studyGuideHtml(topic)}${sections}<section class="thc-visuals" id="infographics"><div class="thc-visuals-head"><span class="eyebrow" style="color:#28744a">Visual learning</span><h2>Infographics for ${esc(topic.title)}</h2><p>Use each visual as a model-building aid, then return to the study questions and measurements above. Only finished infographic-style visuals are shown here; simple reference images, PDF page extractions, and supporting lesson art are excluded from infographic reuse.</p></div>${gallery}</section><p><a href="/learn/infographics/"><strong>Search the full infographic library →</strong></a> &nbsp; <a href="/learn/"><strong>Back to Learn →</strong></a></p></main></div>`;
}

function learningSystemHtml(topics) {
  const principles = learning.libraryPrinciples.map((item, index) => `<div class="thc-principle"><strong>${String(index + 1).padStart(2, '0')}</strong><br>${esc(item)}</div>`).join('');
  const paths = learning.learningPaths.map((path) => {
    const links = path.topicIds.map(linkForTopic).filter(Boolean).join('');
    return `<article class="thc-path"><h3>${esc(path.title)}</h3><p>${esc(path.summary)}</p><ol>${path.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol><div class="thc-path-links">${links}</div></article>`;
  }).join('');
  return `<section class="thc-learning-system"><h2>Use the library as a learning system</h2><p>These visuals work best when they help you ask better questions. Build the concept first, collect the measurements that describe the real plant, then compare the evidence before changing a practice.</p><div class="thc-principles">${principles}</div><h2>Choose a learning path</h2><div class="thc-path-grid">${paths}</div></section>`;
}

function libraryContent(topics, records) {
  const cards = [];
  for (const record of [...records].sort((a, b) => displayVisualTitle(a).localeCompare(displayVisualTitle(b)))) {
    const topic = topics.find((t) => t.id === record.primaryCategoryId) || topics.find((t) => t.id === 'general-reference');
    if (!topic) continue;
    cards.push(visualCard(record, topic.route, { library: true }));
  }
  const topicOptions = topics.map((topic) => `<option value="${esc(topic.id)}">${esc(topic.title)} (${countPrimary(records, topic.id)})</option>`).join('');
  const topicLinks = topics.map((topic) => {
    const guide = guideFor(topic.id);
    const count = countPrimary(records, topic.id);
    const concept = guide.measurements.slice(0, 3).join(' · ');
    return `<a href="${esc(topic.route)}"><strong>${esc(topic.title)}</strong><span>${count} infographic${count === 1 ? '' : 's'} · ${esc(topic.summary)}</span><em>Record: ${esc(concept)}</em></a>`;
  }).join('');
  return `${style}<div class="thc-topic"><section class="thc-hero"><span class="eyebrow">Teaching Healthy Cultivation</span><h1>Searchable Infographic Library</h1><p>Study finished educational infographics by title, subject, or keyword, then continue into companion literature that explains the biology, measurements, limits, and practical context behind the visual.</p><div class="thc-hero-stats"><div class="thc-stat"><b>${cards.length}</b><span>finished infographics</span></div><div class="thc-stat"><b>${topics.length}</b><span>subject libraries</span></div><div class="thc-stat"><b>${learning.learningPaths.length}</b><span>guided learning paths</span></div></div></section><main>${learningSystemHtml(topics)}<section class="thc-library-search"><label for="thc-infographic-search"><strong>Search infographics and topics</strong></label><div class="thc-search-controls"><input id="thc-infographic-search" type="search" placeholder="Try: VPD, roots, nutrients, trichomes, IPM, genetics…" autocomplete="off"><select id="thc-infographic-topic" aria-label="Filter infographics by subject"><option value="">All subjects</option>${topicOptions}</select></div><p id="thc-search-status" aria-live="polite">Showing ${cards.length} finished infographics.</p></section><section><h2>Browse by topic</h2><p>Each subject page combines written literature, a focused study guide, measurements to record, common interpretation traps, and the visuals mapped to that system.</p><div class="thc-topic-directory">${topicLinks}</div></section><section><h2>Finished infographic index</h2><div id="thc-infographic-grid" class="thc-visual-grid">${cards.join('')}</div></section><section class="thc-library-foot"><p class="thc-note"><strong>Quality rule:</strong> an infographic is a finished teaching visual that communicates a concept, process, comparison, or decision framework. Simple reference pictures, decorative images, isolated support panels, and PDF page extractions are not reused here.</p><div class="thc-library-foot-links"><a href="/learn/">Teaching Healthy Cultivation home →</a><a href="/learn/research-methods/">Evidence &amp; measurement →</a><a href="/thc-grow-doc/">Plant-health evidence screening →</a></div></section></main><script>(function(){const q=document.getElementById('thc-infographic-search');const topic=document.getElementById('thc-infographic-topic');const cards=[...document.querySelectorAll('.thc-library-card')];const status=document.getElementById('thc-search-status');if(!q||!topic||!status)return;function apply(){const term=q.value.toLowerCase().trim();const selected=topic.value;let shown=0;for(const card of cards){const textOk=!term||card.dataset.search.includes(term);const topicOk=!selected||card.dataset.topic===selected;const ok=textOk&&topicOk;card.hidden=!ok;if(ok)shown++;}status.textContent='Showing '+shown+' of '+cards.length+' finished infographics'+(selected?' in '+topic.options[topic.selectedIndex].text.replace(/ \(\d+\)$/,''):'')+'.';}q.addEventListener('input',apply);topic.addEventListener('change',apply);})();</script></div>`;
}

const learn = await getLearn();
const topicResults = [];
for (const topic of literature.topics) {
  const records = eligibleMedia.filter((r) => r.placementCategoryIds.includes(topic.id));
  const featured = records.find((r) => r.primaryCategoryId === topic.id)?.media?.id || records[0]?.media?.id || 0;
  const page = await upsertChild(learn.id, topic, topicContent(topic, eligibleMedia), featured);
  topicResults.push({ id: topic.id, route: topic.route, pageId: page.id, infographicCount: records.length, literatureSections: topic.sections.length, featuredMedia: featured, studyGuide: true });
}

const libraryTopic = { route: '/learn/infographics/', title: 'THC Searchable Infographic Library' };
const existingLibrary = await getChild(learn.id, libraryTopic.route);
if (existingLibrary) await writeFile(join(backupDir, 'before-infographics.json'), `${JSON.stringify(existingLibrary, null, 2)}\n`);
const libraryFeatured = eligibleMedia[0]?.media?.id || 0;
const libraryPayload = {
  slug: 'infographics',
  parent: learn.id,
  title: libraryTopic.title,
  content: libraryContent(literature.topics, eligibleMedia),
  status: 'publish',
  ...(libraryFeatured > 0 ? { featured_media: libraryFeatured } : {})
};
const libraryPage = existingLibrary
  ? await request(`/wp-json/wp/v2/pages/${existingLibrary.id}`, { method: 'POST', body: JSON.stringify(libraryPayload) })
  : await request('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(libraryPayload) });
if (!libraryPage?.id || libraryPage?.status !== 'publish') throw new Error('WordPress did not confirm searchable infographic library publication');

const report = {
  generatedAt: new Date().toISOString(),
  learnPageId: learn.id,
  libraryPageId: libraryPage.id,
  totalEducationMedia: allMedia.length,
  excludedSimpleReferenceMedia: excludedMedia.length,
  eligibleInfographics: eligibleMedia.length,
  learningPathCount: learning.learningPaths.length,
  studyGuideCount: learning.guides.length,
  topicPages: topicResults,
  excludedMedia: excludedMedia.map((m) => ({ id: m.id, title: strip(rendered(m.title)), sourcePath: mediaSourcePath(m) }))
};
await writeFile(join(backupDir, 'topic-literature-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'topic-literature-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
