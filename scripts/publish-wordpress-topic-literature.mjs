import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-infographic-backups';
const literaturePath = process.env.TOPIC_LITERATURE_CONFIG || join(process.cwd(), 'site/wordpress/education/topic-literature.json');
const placementPath = process.env.INFOGRAPHIC_PLACEMENT_CONFIG || join(process.cwd(), 'site/wordpress/assets/infographics/placement-rules.json');
const exclusionsPath = process.env.INFOGRAPHIC_EXCLUSIONS || join(process.cwd(), 'site/wordpress/assets/infographics/infographic-exclusions.json');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `topic-literature-${stamp}`);
await mkdir(backupDir, { recursive: true });

const literature = JSON.parse(await readFile(literaturePath, 'utf8'));
const placement = JSON.parse(await readFile(placementPath, 'utf8'));
const exclusions = JSON.parse(await readFile(exclusionsPath, 'utf8'));
if (!Array.isArray(literature.topics) || literature.topics.length < 10) throw new Error('Topic literature catalog is incomplete');
if (!Array.isArray(placement.categories) || placement.categories.length < 10) throw new Error('Infographic placement catalog is incomplete');
if (!exclusions.neverUseOnInfographicSurfaces) throw new Error('Infographic exclusion policy is not enforced');

const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'DTFSeeds-LiteratureFirst-Publisher/1.0'
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

function visualTitle(record) {
  return strip(rendered(record.media.title)) || strip(record.media.alt_text) || 'THC educational infographic';
}
function visualUrl(record) {
  return record.media.source_url || record.media.guid?.rendered || '';
}
function visualCard(record, topicRoute) {
  const title = visualTitle(record);
  const url = visualUrl(record);
  return `<article class="thc-visual-card"><a class="thc-visual-image" href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" loading="lazy" decoding="async" alt="${esc(title)}"></a><div class="thc-visual-body"><strong>${esc(title)}</strong><div class="thc-visual-links"><a href="${esc(topicRoute)}">Read companion literature</a><a href="${esc(url)}" target="_blank" rel="noopener">Full-size visual</a></div></div></article>`;
}
const style = `<style>
.thc-topic{--deep:#0d2f1b;--green:#196a3c;--soft:#eef6f0;--ink:#163623;--muted:#556b5d;--line:#d4e4d8;color:var(--ink)}.thc-topic *{box-sizing:border-box}.thc-topic a{color:#176b3b}.thc-hero{background:linear-gradient(135deg,#0b2b18,#195538);color:#fff;border-radius:24px;padding:clamp(28px,5vw,58px);margin:12px 0 30px}.thc-hero .eyebrow{font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:.76rem;color:#c9e6d1}.thc-hero h1{font-size:clamp(2.2rem,5vw,4.3rem);line-height:1;margin:10px 0 14px}.thc-hero p{max-width:900px;color:#dcebe0;font-size:1.06rem;line-height:1.75}.thc-jump{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.thc-jump a{background:#fff;color:#173b26;text-decoration:none;padding:9px 12px;border-radius:999px;font-weight:800}.thc-literature{max-width:980px;margin:auto}.thc-section{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(22px,4vw,38px);margin:18px 0;box-shadow:0 10px 26px rgba(17,55,31,.05)}.thc-section h2{font-size:clamp(1.45rem,3vw,2.15rem);margin:0 0 14px}.thc-section p{font-size:1.02rem;line-height:1.78;color:#304c3a}.thc-section ul{line-height:1.7;background:var(--soft);border-radius:14px;padding:16px 18px 16px 38px}.thc-visuals{margin:48px 0}.thc-visuals-head{max-width:850px;margin-bottom:18px}.thc-visual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.thc-visual-card{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 10px 25px rgba(17,55,31,.07)}.thc-visual-image{display:flex;aspect-ratio:4/5;padding:10px;background:#f3f7f4;align-items:center;justify-content:center}.thc-visual-image img{width:100%;height:100%;object-fit:contain}.thc-visual-body{padding:15px}.thc-visual-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:.86rem}.thc-visual-links a{font-weight:800}.thc-note{background:#eff6f0;border-left:4px solid #2c7a4c;padding:16px 18px;border-radius:10px;line-height:1.65}.thc-library-search{margin:24px 0;padding:18px;background:#fff;border:1px solid var(--line);border-radius:18px}.thc-library-search input{width:100%;padding:14px 16px;border:1px solid #abc7b3;border-radius:12px;font-size:1rem}.thc-library-card[hidden]{display:none!important}
</style>`;

function topicContent(topic, records) {
  const direct = records.filter((r) => r.primaryCategoryId === topic.id);
  const related = records.filter((r) => r.primaryCategoryId !== topic.id && r.placementCategoryIds.includes(topic.id));
  const visuals = [...direct, ...related].sort((a, b) => visualTitle(a).localeCompare(visualTitle(b)));
  const jumps = topic.sections.map((s, i) => `<a href="#lit-${topic.id}-${i + 1}">${esc(s.heading)}</a>`).join('') + `<a href="#infographics">Infographics</a>`;
  const sections = topic.sections.map((section, index) => `<section class="thc-section" id="lit-${esc(topic.id)}-${index + 1}"><h2>${esc(section.heading)}</h2>${(section.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}${section.checkpoints?.length ? `<h3>Use this in practice</h3><ul>${section.checkpoints.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}</section>`).join('');
  const gallery = visuals.length ? `<div class="thc-visual-grid">${visuals.map((r) => visualCard(r, topic.route)).join('')}</div>` : '<p>No finished infographic is assigned to this topic yet. The literature remains available while the visual is developed and reviewed.</p>';
  return `${style}<div class="thc-topic"><section class="thc-hero"><span class="eyebrow">Teaching Healthy Cultivation · Companion literature</span><h1>${esc(topic.title)}</h1><p>${esc(topic.summary)}</p><div class="thc-jump">${jumps}</div></section><main class="thc-literature"><p class="thc-note"><strong>Literature first:</strong> this page is the canonical subject explanation. Infographics summarize and reinforce the material below; they are not substitutes for the written context, measurements, or evidence.</p>${sections}<section class="thc-visuals" id="infographics"><div class="thc-visuals-head"><span class="eyebrow" style="color:#28744a">Visual learning</span><h2>Infographics for ${esc(topic.title)}</h2><p>Only finished infographic-style visuals are shown here. Simple reference images, PDF page extractions, and supporting lesson art are excluded from infographic reuse.</p></div>${gallery}</section><p><a href="/learn/infographics/"><strong>Search the full infographic library →</strong></a> &nbsp; <a href="/learn/"><strong>Back to Learn →</strong></a></p></main></div>`;
}

function libraryContent(topics, records) {
  const cards = [];
  for (const record of records.sort((a, b) => visualTitle(a).localeCompare(visualTitle(b)))) {
    const topic = topics.find((t) => t.id === record.primaryCategoryId) || topics.find((t) => t.id === 'general-reference');
    if (!topic) continue;
    const title = visualTitle(record);
    const url = visualUrl(record);
    const search = [title, topic.title, ...(topic.keywords || [])].join(' ');
    cards.push(`<article class="thc-visual-card thc-library-card" data-search="${esc(norm(search))}" data-topic="${esc(topic.id)}"><a class="thc-visual-image" href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" loading="lazy" decoding="async" alt="${esc(title)}"></a><div class="thc-visual-body"><span style="display:block;color:#28744a;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">${esc(topic.title)}</span><strong>${esc(title)}</strong><div class="thc-visual-links"><a href="${esc(topic.route)}">Read topic literature</a><a href="${esc(url)}" target="_blank" rel="noopener">Full-size</a></div></div></article>`);
  }
  const topicLinks = topics.map((topic) => `<a href="${esc(topic.route)}" style="display:block;background:#fff;border:1px solid #d4e4d8;border-radius:14px;padding:14px;text-decoration:none"><strong>${esc(topic.title)}</strong><span style="display:block;color:#5b6e61;font-size:.88rem;margin-top:4px">${records.filter((r) => r.primaryCategoryId === topic.id).length} infographic${records.filter((r) => r.primaryCategoryId === topic.id).length === 1 ? '' : 's'} · companion literature</span></a>`).join('');
  return `${style}<div class="thc-topic"><section class="thc-hero"><span class="eyebrow">Teaching Healthy Cultivation</span><h1>Searchable Infographic Library</h1><p>Search finished educational infographics by title, subject, or keyword. Every visual belongs to a subject area with companion literature; supporting images and recovered PDF pages are intentionally kept out of this infographic index.</p></section><main><section class="thc-library-search"><label for="thc-infographic-search"><strong>Search infographics and topics</strong></label><input id="thc-infographic-search" type="search" placeholder="Try: VPD, roots, nutrients, trichomes, IPM, genetics…" autocomplete="off"><p id="thc-search-status" aria-live="polite">Showing ${cards.length} finished infographics.</p></section><section><h2>Browse by topic</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:34px">${topicLinks}</div></section><section><h2>Finished infographic index</h2><div id="thc-infographic-grid" class="thc-visual-grid">${cards.join('')}</div></section><p class="thc-note" style="margin-top:32px"><strong>Quality rule:</strong> an infographic is a finished teaching visual that communicates a concept, process, comparison, or decision framework. Simple reference pictures, decorative images, isolated support panels, and PDF page extractions are not reused here.</p></main><script>(function(){const q=document.getElementById('thc-infographic-search');const cards=[...document.querySelectorAll('.thc-library-card')];const status=document.getElementById('thc-search-status');if(!q)return;function apply(){const term=q.value.toLowerCase().trim();let shown=0;for(const card of cards){const ok=!term||card.dataset.search.includes(term);card.hidden=!ok;if(ok)shown++;}status.textContent='Showing '+shown+' of '+cards.length+' finished infographics.';}q.addEventListener('input',apply);})();</script></div>`;
}

const learn = await getLearn();
const topicResults = [];
for (const topic of literature.topics) {
  if (!categoryById.has(topic.id)) throw new Error(`Literature topic ${topic.id} has no infographic placement category`);
  const records = eligibleMedia.filter((r) => r.placementCategoryIds.includes(topic.id));
  const featured = records.find((r) => r.primaryCategoryId === topic.id)?.media?.id || records[0]?.media?.id || 0;
  const page = await upsertChild(learn.id, topic, topicContent(topic, eligibleMedia), featured);
  topicResults.push({ id: topic.id, route: topic.route, pageId: page.id, infographicCount: records.length, literatureSections: topic.sections.length, featuredMedia: featured });
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
  topicPages: topicResults,
  excludedMedia: excludedMedia.map((m) => ({ id: m.id, title: strip(rendered(m.title)), sourcePath: mediaSourcePath(m) }))
};
await writeFile(join(backupDir, 'topic-literature-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'topic-literature-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));
