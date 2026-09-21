import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const config = JSON.parse(await readFile(process.env.TECH1_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech1-courses-public-v1.json', 'utf8'));
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const configuredSourceRef = String(config.source?.ref || 'main');
const sourceRef = String(process.env.THC_LEARNING_SOURCE_SHA || configuredSourceRef).trim();
if (process.env.THC_LEARNING_SOURCE_SHA && !/^[0-9a-f]{40}$/i.test(sourceRef)) throw new Error('THC_LEARNING_SOURCE_SHA must be a full 40-character Git commit SHA.');
const rawBase = `https://raw.githubusercontent.com/${config.source.repository}/${encodeURIComponent(sourceRef)}`;
const must = (value, message) => { if (!value) throw new Error(message); };
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

must(auth, 'WordPress credentials required for verification.');
must(config.source?.repository === 'dtfgenetics/Thc-learning-courses-', 'Unexpected Technician I source repository.');

async function wp(endpoint) {
  const response = await fetch(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//, '')}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
async function find(slug, parent = null) {
  const parentQuery = parent === null ? '' : `&parent=${parent}`;
  const rows = await wp(`pages?slug=${encodeURIComponent(slug)}${parentQuery}&context=edit&per_page=100`);
  return rows[0] || null;
}
async function sourceJson(rel) {
  const response = await fetch(`${rawBase}/${rel}`, { headers: { 'User-Agent': 'DTF-Tech1-Public-Courses-Verify/2.0' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${rel} source returned ${response.status}`);
  return response.json();
}
function expectedAssetIds(lesson) {
  return (lesson?.content?.blocks || []).flatMap(block => {
    if (block?.type === 'image' && block.assetId && (block.src || block.url)) return [block.assetId];
    if (block?.type === 'resource' && block.extensions?.assetId && block.href) return [block.extensions.assetId];
    return [];
  });
}
async function anonymousHtml(route, label) {
  let last = '';
  for (let attempt = 1; attempt <= 8; attempt++) {
    const nonce = `${Date.now()}-${attempt}-${Math.random().toString(36).slice(2)}`;
    try {
      const response = await fetch(`${site}${route}${route.includes('?') ? '&' : '?'}verify=${nonce}`, { headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      last = await response.text();
      if (response.ok && last.includes('dtf-tech1-public-courses-v2')) return last;
    } catch (error) { last = String(error?.message || error); }
    if (attempt < 8) await sleep(3000);
  }
  throw new Error(`${label}: anonymous visitor-facing page did not become readable with v2 UI marker. Last response: ${String(last).slice(0, 240)}`);
}

const program = await find(config.program.slug, null);
must(program && program.status === 'publish', 'Technician I program parent is not published.');
const verified = [];

for (const entry of config.courses) {
  const release = await sourceJson(`content/public-releases/${entry.releaseId}.json`);
  must(release.courseId === entry.id && release.publicationState === 'published', `${entry.id}: source public release is not published.`);
  const module = await sourceJson(`content/modules/${release.publicScope.modules[0]}.json`);
  must((module.lessons || []).length === 4, `${entry.id}: source module must contain four lessons.`);

  const root = await find(entry.slug, program.id);
  must(root && root.status === 'publish', `${entry.id}: course root missing or not published.`);
  const rootHtml = rendered(root.content);
  must(rootHtml.includes('dtf-tech1-public-courses-v2'), `${entry.id}: v2 public UI marker missing.`);
  must(rootHtml.includes(sourceRef), `${entry.id}: exact source snapshot marker missing from root.`);

  const rootRoute = `${config.program.route}${entry.slug}/`;
  const anonymousRoot = await anonymousHtml(rootRoute, `${entry.id} root`);
  must(anonymousRoot.includes(`Course ${entry.number}`), `${entry.id}: anonymous root missing course number.`);
  must(anonymousRoot.includes(sourceRef), `${entry.id}: anonymous root missing exact source snapshot.`);

  let expectedAssets = 0;
  for (let index = 0; index < module.lessons.length; index++) {
    const lessonId = module.lessons[index];
    const sourceLesson = await sourceJson(`content/lessons/${lessonId}.json`);
    const ids = expectedAssetIds(sourceLesson);
    expectedAssets += ids.length;

    const lesson = await find(`lesson-${String(index + 1).padStart(2, '0')}`, root.id);
    must(lesson && lesson.status === 'publish', `${entry.id}: lesson ${index + 1} missing or not published.`);
    const lessonHtml = rendered(lesson.content);
    must(lessonHtml.includes('dtf-tech1-public-courses-v2'), `${entry.id}: lesson ${index + 1} v2 UI marker missing.`);
    must(lessonHtml.includes(sourceRef), `${entry.id}: lesson ${index + 1} exact source snapshot marker missing.`);
    for (const id of ids) must(lessonHtml.includes(id), `${entry.id}: lesson ${index + 1} missing governed learner asset marker ${id}.`);
    if (ids.length) must(lessonHtml.includes(rawBase), `${entry.id}: lesson ${index + 1} governed asset URLs are not pinned to the source snapshot.`);

    const lessonRoute = `${rootRoute}lesson-${String(index + 1).padStart(2, '0')}/`;
    const publicLesson = await anonymousHtml(lessonRoute, `${entry.id} lesson ${index + 1}`);
    for (const id of ids) must(publicLesson.includes(id), `${entry.id}: anonymous lesson ${index + 1} missing governed learner asset marker ${id}.`);
  }

  const knowledgeSlug = entry.number === 7 ? 'readiness-check' : 'knowledge-check';
  const knowledge = await find(knowledgeSlug, root.id);
  must(knowledge && knowledge.status === 'publish', `${entry.id}: ${knowledgeSlug} missing.`);
  must(rendered(knowledge.content).includes('dtf-tech1-public-courses-v2'), `${entry.id}: ${knowledgeSlug} does not use v2 publication surface.`);
  if (entry.number < 7) {
    const final = await find('course-assessment', root.id);
    must(final && final.status === 'publish', `${entry.id}: course assessment missing.`);
    must(rendered(final.content).includes('dtf-tech1-public-courses-v2'), `${entry.id}: course assessment does not use v2 publication surface.`);
  }

  verified.push({ courseId: entry.id, route: rootRoute, rootPageId: root.id, lessons: 4, anonymousRoot: true, anonymousLessons: 4, sourceRef, governedAssetReferencesVerified: expectedAssets });
}

console.log(JSON.stringify({ result: 'success', sourceRepository: config.source.repository, sourceRef, verified }, null, 2));
