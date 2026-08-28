import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const canonicalDir = resolve(root, 'games/high-iq/data');
const publicDir = resolve(root, 'site/public-route-patch/games/high-iq/data');
const runtimeDir = resolve(root, 'site/public-route-patch/games/high-iq');

async function readJson(path) {
  const text = await readFile(path, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${path}: ${error.message}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNonEmpty(path) {
  const text = await readFile(path, 'utf8');
  assert(text.trim().length > 0, `Runtime file is empty: ${path}`);
  return text;
}

async function loadChunks(dir, names) {
  const groups = await Promise.all(names.map((name) => readJson(resolve(dir, name))));
  for (let index = 0; index < groups.length; index += 1) {
    assert(Array.isArray(groups[index]), `Chunk must be an array: ${names[index]}`);
  }
  return groups.flat();
}

const canonicalManifest = await readJson(resolve(canonicalDir, 'manifest.json'));
const publicManifest = await readJson(resolve(publicDir, 'manifest.json'));

assert(
  JSON.stringify(stable(publicManifest)) === JSON.stringify(stable(canonicalManifest)),
  'Public High IQ manifest has drifted from canonical data manifest.'
);

assert(canonicalManifest.datasetVersion === '2.2', `Unexpected High IQ dataset version: ${canonicalManifest.datasetVersion}`);
assert(canonicalManifest.questionCount === 80, `Expected 80 questions, found ${canonicalManifest.questionCount}`);
assert(canonicalManifest.sourceCount === 50, `Expected 50 sources, found ${canonicalManifest.sourceCount}`);
assert(Array.isArray(canonicalManifest.questionChunks) && canonicalManifest.questionChunks.length === 8, 'Expected 8 question chunks.');
assert(Array.isArray(canonicalManifest.sourceChunks) && canonicalManifest.sourceChunks.length === 2, 'Expected 2 source chunks.');

for (const name of [...canonicalManifest.questionChunks, ...canonicalManifest.sourceChunks]) {
  const canonical = await readFile(resolve(canonicalDir, name), 'utf8');
  const published = await readFile(resolve(publicDir, name), 'utf8');
  assert(canonical === published, `Public data chunk differs from canonical source: ${name}`);
}

const questions = await loadChunks(publicDir, canonicalManifest.questionChunks);
const sources = await loadChunks(publicDir, canonicalManifest.sourceChunks);
assert(questions.length === canonicalManifest.questionCount, `Public runtime loaded ${questions.length} questions; expected ${canonicalManifest.questionCount}.`);
assert(sources.length === canonicalManifest.sourceCount, `Public runtime loaded ${sources.length} sources; expected ${canonicalManifest.sourceCount}.`);

const questionIds = new Set();
const sourceIds = new Set();
for (const source of sources) {
  assert(source && typeof source === 'object', 'Source record must be an object.');
  assert(typeof source.id === 'string' && source.id, 'Source record missing id.');
  assert(!sourceIds.has(source.id), `Duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  assert(typeof source.url === 'string' && /^https?:\/\//i.test(source.url), `Invalid source URL for ${source.id}`);
}

const categoryCounts = {};
const difficultyCounts = {};
for (const question of questions) {
  assert(question && typeof question === 'object', 'Question record must be an object.');
  assert(typeof question.id === 'string' && question.id, 'Question missing id.');
  assert(!questionIds.has(question.id), `Duplicate question id: ${question.id}`);
  questionIds.add(question.id);
  assert(question.status === canonicalManifest.requiredStatus, `${question.id} status is ${question.status}; expected ${canonicalManifest.requiredStatus}`);
  assert(question.audit === canonicalManifest.requiredAudit, `${question.id} audit is ${question.audit}; expected ${canonicalManifest.requiredAudit}`);
  assert(canonicalManifest.allowedDifficulties.includes(question.difficulty), `${question.id} has unsupported difficulty ${question.difficulty}`);
  assert(question.choices && typeof question.choices === 'object', `${question.id} missing choices`);
  assert(['A','B','C','D'].includes(question.correctLetter), `${question.id} has invalid correctLetter ${question.correctLetter}`);
  assert(question.choices[question.correctLetter] === question.correctAnswer, `${question.id} correctLetter does not map to correctAnswer`);
  assert(Number.isFinite(question.points) && question.points >= 1 && question.points <= 4, `${question.id} has invalid points`);
  assert(typeof question.explanation === 'string' && question.explanation.trim(), `${question.id} missing explanation`);
  assert(typeof question.context === 'string' && question.context.trim(), `${question.id} missing context`);
  assert(Array.isArray(question.sourceIds) && question.sourceIds.length > 0, `${question.id} missing sourceIds`);
  for (const sourceId of question.sourceIds) assert(sourceIds.has(sourceId), `${question.id} references missing source ${sourceId}`);
  categoryCounts[question.category] = (categoryCounts[question.category] || 0) + 1;
  difficultyCounts[question.difficulty] = (difficultyCounts[question.difficulty] || 0) + 1;
}

assert(JSON.stringify(stable(categoryCounts)) === JSON.stringify(stable(canonicalManifest.categoryCounts)), 'Public category distribution does not match manifest.');
assert(JSON.stringify(stable(difficultyCounts)) === JSON.stringify(stable(canonicalManifest.difficultyCounts)), 'Public difficulty distribution does not match manifest.');

const indexHtml = await assertNonEmpty(resolve(runtimeDir, 'index.html'));
const appJs = await assertNonEmpty(resolve(runtimeDir, 'app.js'));
await assertNonEmpty(resolve(runtimeDir, 'high-iq.css'));

assert(indexHtml.includes('Build your High IQ run'), 'Public High IQ HTML is missing the upgraded challenge console marker.');
assert(indexHtml.includes('https://dtfseeds.com/games/high-iq/'), 'Public High IQ HTML is missing its canonical production URL.');
assert(appJs.includes('/games/high-iq/data'), 'Public High IQ loader is missing the canonical data route.');
assert(appJs.includes('non-JSON content'), 'Public High IQ loader is missing the non-JSON response guard.');

console.log(JSON.stringify({
  ok: true,
  datasetVersion: canonicalManifest.datasetVersion,
  questions: questions.length,
  sources: sources.length,
  categories: Object.keys(categoryCounts).length,
  runtime: 'site/public-route-patch/games/high-iq'
}, null, 2));
