import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const config = JSON.parse(await readFile(process.env.TECH2_PUBLIC_COURSES_PATH || 'site/wordpress/education/tech2-courses-public-v1.json', 'utf8'));
const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` : '';
const must = (value, message) => { if (!value) throw new Error(message); };
const rendered = value => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const transientCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']);
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

must(auth, 'WordPress credentials required for verification.');

async function fetchRetry(url, options = {}, label = url) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (response.ok || !transientStatuses.has(response.status)) return response;
      last = new Error(`${label} returned transient HTTP ${response.status}`);
    } catch (error) {
      last = error;
      const code = error?.cause?.code || error?.code;
      if (code && !transientCodes.has(code) && error?.name !== 'TimeoutError') throw error;
    }
    if (attempt < 6) await sleep(Math.min(10000, attempt * 900));
  }
  throw last;
}
async function wp(endpoint) {
  const response = await fetchRetry(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//, '')}`, { headers: { Authorization: auth } }, `WordPress ${endpoint}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
async function find(slug, parent = null) {
  const parentQuery = parent === null ? '' : `&parent=${parent}`;
  const rows = await wp(`pages?slug=${encodeURIComponent(slug)}${parentQuery}&context=edit&per_page=100`);
  return rows[0] || null;
}
async function anonymousPage(path, marker, textMarker) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const nonce = `${Date.now()}-${attempt}-${Math.random().toString(16).slice(2)}`;
    try {
      const response = await fetchRetry(`${site}${path}${path.includes('?') ? '&' : '?'}verify=${nonce}`, {
        headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
        redirect: 'follow',
      }, `anonymous ${path}`);
      const html = await response.text();
      if (response.ok && html.includes(marker) && (!textMarker || html.includes(textMarker))) return true;
    } catch {}
    await sleep(3000);
  }
  return false;
}

const program = await find(config.program.slug, null);
must(program && program.status === 'publish', 'Technician II program parent is not published.');
must(rendered(program.content).includes('dtf-tech2-public-courses-v1'), 'Technician II program UI marker missing.');
must(await anonymousPage(config.program.route, 'dtf-tech2-public-courses-v1', 'THC Cultivation Technician II'), 'Technician II program page is not anonymously readable.');

const verified = [];
for (const entry of config.courses) {
  const root = await find(entry.slug, program.id);
  must(root, `${entry.id}: course root missing.`);
  must(root.status === 'publish', `${entry.id}: root is not publish status.`);
  const rootHtml = rendered(root.content);
  must(rootHtml.includes('dtf-tech2-public-courses-v1'), `${entry.id}: public UI marker missing.`);
  must(rootHtml.includes(`Course ${entry.number}`), `${entry.id}: course number marker missing.`);

  for (let i = 1; i <= 4; i++) {
    const lesson = await find(`lesson-${String(i).padStart(2, '0')}`, root.id);
    must(lesson && lesson.status === 'publish', `${entry.id}: lesson ${i} missing or not published.`);
    const lessonHtml = rendered(lesson.content);
    must(lessonHtml.includes('dtf-tech2-public-courses-v1'), `${entry.id}: lesson ${i} UI marker missing.`);
    must(lessonHtml.includes('Learning objectives'), `${entry.id}: lesson ${i} objective section missing.`);
  }

  const knowledgeSlug = entry.number === 8 ? 'readiness-check' : 'knowledge-check';
  const knowledge = await find(knowledgeSlug, root.id);
  must(knowledge && knowledge.status === 'publish', `${entry.id}: ${knowledgeSlug} missing.`);
  const knowledgeHtml = rendered(knowledge.content);
  must(knowledgeHtml.includes('Formative learning check:'), `${entry.id}: formative learning boundary missing.`);
  must(knowledgeHtml.includes('Check answer and rationale') || entry.number === 8, `${entry.id}: expected formative study feedback is missing.`);
  if (entry.number < 8) {
    const final = await find('course-assessment', root.id);
    must(final && final.status === 'publish', `${entry.id}: course assessment missing.`);
    const finalHtml = rendered(final.content);
    must(finalHtml.includes('Graded assessment:'), `${entry.id}: final is not routed to the authenticated graded runtime.`);
    must(!finalHtml.includes('Check answer and rationale'), `${entry.id}: summative final exposes self-check answer panels.`);
    must(!/<strong>Answer:<\/strong>/i.test(finalHtml), `${entry.id}: summative final exposes answer-key content.`);
    must(finalHtml.includes(`course=${entry.id}`), `${entry.id}: summative final must deep-link to its own Academy course.`);
    must(finalHtml.includes('view=final'), `${entry.id}: summative final deep link must target the graded-final view.`);
  } else {
    const final = await find('course-assessment', root.id);
    must(!final, `${entry.id}: Course 8 must not expose a fabricated course final assessment.`);
  }

  const route = `${config.program.route}${entry.slug}/`;
  must(await anonymousPage(route, 'dtf-tech2-public-courses-v1', `Course ${entry.number}`), `${entry.id}: anonymous visitor-facing course root did not become readable.`);
  verified.push({ courseId: entry.id, route, rootPageId: root.id, lessons: 4, anonymousPublic: true });
}

console.log(JSON.stringify({ result: 'success', programAnonymousPublic: true, verified }, null, 2));
