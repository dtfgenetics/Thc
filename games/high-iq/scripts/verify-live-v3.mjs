const origin = (process.env.HIGH_IQ_LIVE_ORIGIN || 'https://dtfseeds.com').replace(/\/$/, '');
const cacheBust = `hiq_live_verify=${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(`High IQ live verification failed: ${message}`);
}

function withBust(path) {
  return `${origin}${path}${path.includes('?') ? '&' : '?'}${cacheBust}`;
}

async function getText(path, accept = 'text/html,*/*;q=0.8') {
  const response = await fetch(withBust(path), {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      Accept: accept,
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache'
    }
  });
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response.text();
}

async function getJson(path) {
  const text = await getText(path, 'application/json');
  const trimmed = text.trim();
  assert(trimmed.startsWith('{') || trimmed.startsWith('['), `${path} returned non-JSON content`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`High IQ live verification failed: ${path} returned invalid JSON: ${error.message}`);
  }
}

const html = await getText('/games/high-iq/');
for (const marker of [
  'High IQ — Test Higher Cognition',
  "Today's Daily 10",
  'Missed-question review',
  './app-v3.js',
  './high-iq-v3.css'
]) {
  assert(html.includes(marker), `live HTML is missing marker: ${marker}`);
}

const app = await getText('/games/high-iq/app-v3.js', 'text/javascript,*/*;q=0.8');
assert(app.includes("from './game-core.mjs'"), 'app-v3.js does not import game-core.mjs');
assert(app.includes('High IQ v3 runtime initialized'), 'app-v3.js is missing the v3 runtime marker');
assert(app.includes('practiceMissedQuestions'), 'app-v3.js is missing missed-question practice');
assert(app.includes('startDaily'), 'app-v3.js is missing Daily 10');

const core = await getText('/games/high-iq/game-core.mjs', 'text/javascript,*/*;q=0.8');
assert(core.includes('export function balancedSample'), 'game-core.mjs is missing balancedSample');
assert(core.includes('export function seededShuffle'), 'game-core.mjs is missing seededShuffle');

const v3Css = await getText('/games/high-iq/high-iq-v3.css', 'text/css,*/*;q=0.8');
assert(v3Css.includes('prefers-reduced-motion'), 'high-iq-v3.css is missing reduced-motion support');
assert(v3Css.includes('missed-review-list'), 'high-iq-v3.css is missing missed-review styling');

const manifest = await getJson('/games/high-iq/data/manifest.json');
assert(manifest.datasetVersion === '2.2', `expected dataset v2.2, got ${manifest.datasetVersion}`);
assert(manifest.questionCount === 80, `expected 80 questions, got ${manifest.questionCount}`);
assert(manifest.sourceCount === 50, `expected 50 sources, got ${manifest.sourceCount}`);
assert(Array.isArray(manifest.questionChunks) && manifest.questionChunks.length === 8, 'manifest must list 8 question chunks');
assert(Array.isArray(manifest.sourceChunks) && manifest.sourceChunks.length === 2, 'manifest must list 2 source chunks');

let questions = 0;
const questionIds = new Set();
for (const chunk of manifest.questionChunks) {
  const rows = await getJson(`/games/high-iq/data/${encodeURIComponent(chunk)}`);
  assert(Array.isArray(rows), `${chunk} is not an array`);
  for (const row of rows) {
    assert(row?.id, `${chunk} contains a question without an ID`);
    assert(!questionIds.has(row.id), `duplicate live question ID: ${row.id}`);
    questionIds.add(row.id);
  }
  questions += rows.length;
}

let sources = 0;
const sourceIds = new Set();
for (const chunk of manifest.sourceChunks) {
  const rows = await getJson(`/games/high-iq/data/${encodeURIComponent(chunk)}`);
  assert(Array.isArray(rows), `${chunk} is not an array`);
  for (const row of rows) {
    assert(row?.id, `${chunk} contains a source without an ID`);
    assert(!sourceIds.has(row.id), `duplicate live source ID: ${row.id}`);
    sourceIds.add(row.id);
  }
  sources += rows.length;
}

assert(questions === manifest.questionCount, `loaded ${questions} questions; expected ${manifest.questionCount}`);
assert(sources === manifest.sourceCount, `loaded ${sources} sources; expected ${manifest.sourceCount}`);

console.log(JSON.stringify({
  ok: true,
  origin,
  runtime: 'High IQ v3',
  datasetVersion: manifest.datasetVersion,
  questions,
  sources,
  questionChunks: manifest.questionChunks.length,
  sourceChunks: manifest.sourceChunks.length
}, null, 2));
