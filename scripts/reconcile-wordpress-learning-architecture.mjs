import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_LEARNING_ARCHITECTURE || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-architecture';
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rendered = (value) => typeof value === 'string' ? value : (value?.raw || value?.rendered || '');
const must = (value, message) => { if (!value) throw new Error(message); };

must(user && pass, 'WordPress application credentials are required.');

async function wp(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 7; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          'User-Agent': 'DTF-Learning-Architecture-Reconciler/1.1',
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 7) {
        await sleep(attempt * 1200);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 7) await sleep(attempt * 1200);
    }
  }
  throw last;
}

async function readLearn() {
  const rows = await wp('/wp-json/wp/v2/pages?slug=learn&context=edit&status=publish&per_page=100');
  must(Array.isArray(rows), 'WordPress did not return a page array for /learn/.');
  must(rows.length === 1, `Expected exactly one published /learn/ page; found ${rows.length}.`);
  return rows[0];
}

const legacyIntro = 'Start with a goal, learn the foundations, move into specialized subjects, then choose the depth you need: pathway, subject literature, visual reference, Academy, or Encyclopedia.';
const currentIntro = 'Start with a goal, learn the foundations, move into specialized subjects, then choose the system that fits your purpose: the THC Learning Academy for broad guided study, the THC Learning Hub for credential-aligned courses and tests, or the Encyclopedia and visual references for deeper lookup.';
const legacyAcademyCard = '<span class="pill">Course</span><h3>THC Academy</h3><p>Structured learning sequences and course-based progression.</p>';
const currentAcademyCard = '<span class="pill">Academy</span><h3>THC Learning Academy</h3><p>Comprehensive cannabis plant science and cultivation education organized into guided study sequences.</p>';
const learningHubStart = '<!-- DTF_LEARNING_HUB_COURSE1_START -->';
const learningHubEnd = '<!-- DTF_LEARNING_HUB_COURSE1_END -->';
const learningHubMarker = 'DTF_LEARNING_HUB_COURSE1_START';
const learningHubRoute = '/learn/learning-hub/';
const learningHubCourseRoute = '/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/';
const learningHubBlock = `${learningHubStart}<section id="thc-learning-hub-course1"><h2>Professional certification learning paths</h2><p>The THC Learning Hub contains purpose-built professional courses, practicals, and course tests. Start with <a href="${learningHubCourseRoute}"><strong>Cultivation Technician I — Course 1: Safety, Responsible Practice &amp; Cultivation Workflows</strong></a>.</p></section>${learningHubEnd}`;

function reconcile(content) {
  let next = String(content || '');
  next = next.replaceAll(legacyIntro, currentIntro);
  next = next.replaceAll(legacyAcademyCard, currentAcademyCard);

  const starts = (next.match(/DTF_LEARNING_HUB_COURSE1_START/g) || []).length;
  const ends = (next.match(/DTF_LEARNING_HUB_COURSE1_END/g) || []).length;
  must(starts <= 1 && ends <= 1, `Refusing to reconcile ambiguous Learning Hub markers: start=${starts}, end=${ends}.`);
  must(starts === ends, `Refusing to reconcile an incomplete Learning Hub marker pair: start=${starts}, end=${ends}.`);

  if (starts === 0) next = `${next.trimEnd()}\n${learningHubBlock}\n`;
  return next;
}

function verify(content, label) {
  must(content.includes(currentIntro), `${label}: current three-layer Learn introduction is missing.`);
  must(content.includes(currentAcademyCard), `${label}: THC Learning Academy card is missing.`);
  must(!content.includes(legacyIntro), `${label}: legacy Learn introduction is still present.`);
  must(!content.includes(legacyAcademyCard), `${label}: legacy Academy-as-Course card is still present.`);
  must(content.includes(learningHubMarker), `${label}: released Learning Hub marker is missing.`);
  must(content.includes(learningHubRoute), `${label}: Learning Hub route is missing.`);
  must(content.includes(learningHubCourseRoute), `${label}: Course 1 Learning Hub route is missing.`);
  must(content.includes(learningHubEnd), `${label}: Learning Hub end marker is missing.`);
  must((content.match(/DTF_LEARNING_HUB_COURSE1_START/g) || []).length === 1, `${label}: Learning Hub start marker must occur exactly once.`);
  must((content.match(/DTF_LEARNING_HUB_COURSE1_END/g) || []).length === 1, `${label}: Learning Hub end marker must occur exactly once.`);
}

const before = await readLearn();
const beforeContent = rendered(before.content);
const afterContent = reconcile(beforeContent);
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `architecture-${stamp}`);
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupDir, `page-${before.id}-learn-before.json`), `${JSON.stringify(before, null, 2)}\n`);

if (afterContent !== beforeContent) {
  if (!apply) {
    console.log(JSON.stringify({ result: 'change-required', pageId: before.id, apply: false }, null, 2));
    process.exit(2);
  }
  await wp(`/wp-json/wp/v2/pages/${before.id}`, {
    method: 'POST',
    body: JSON.stringify({ content: afterContent, status: 'publish' })
  });
}

const after = await readLearn();
const stored = rendered(after.content);
verify(stored, 'Stored /learn/');
await writeFile(join(backupDir, 'verification.json'), `${JSON.stringify({
  verifiedAt: new Date().toISOString(),
  site,
  pageId: after.id,
  changed: afterContent !== beforeContent,
  learningAcademy: 'comprehensive-guided-study',
  learningHub: 'credential-aligned-courses-tests',
  course1EntryPreserved: true,
  credentialGovernance: 'separate-controlled-system',
  result: 'success'
}, null, 2)}\n`);

console.log(JSON.stringify({
  pageId: after.id,
  changed: afterContent !== beforeContent,
  academyCard: 'THC Learning Academy',
  learningHubRoute,
  course1EntryPreserved: true,
  result: 'success'
}, null, 2));
