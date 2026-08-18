import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
const publicDataDir = path.resolve(here, '../../../site/public-route-patch/games/high-iq/data');

async function readText(directory, filename) {
  return readFile(path.join(directory, filename), 'utf8');
}

async function readJson(filename) {
  return JSON.parse(await readText(dataDir, filename));
}

function fail(message) {
  throw new Error(`High IQ data validation failed: ${message}`);
}

function countBy(records, field) {
  return records.reduce((counts, record) => {
    const key = record[field];
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function assertSameCounts(actual, expected, label) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    fail(`${label} keys differ: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) fail(`${label} ${key}: expected ${expected[key]}, got ${actual[key]}`);
  }
}

const manifest = await readJson('manifest.json');
const questionGroups = await Promise.all(manifest.questionChunks.map(readJson));
const sourceGroups = await Promise.all(manifest.sourceChunks.map(readJson));
const questions = questionGroups.flat();
const sources = sourceGroups.flat();

if (questions.length !== manifest.questionCount) fail(`expected ${manifest.questionCount} questions, got ${questions.length}`);
if (sources.length !== manifest.sourceCount) fail(`expected ${manifest.sourceCount} sources, got ${sources.length}`);

const questionIds = new Set();
const sourceIds = new Set();

for (const source of sources) {
  if (!source?.id || typeof source.id !== 'string') fail('source missing string id');
  if (sourceIds.has(source.id)) fail(`duplicate source id ${source.id}`);
  sourceIds.add(source.id);
  if (!source.title || !source.organizationType || !source.verificationUse) fail(`source ${source.id} is missing required provenance fields`);
  let url;
  try { url = new URL(source.url); } catch { fail(`source ${source.id} has invalid URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) fail(`source ${source.id} must use HTTP/HTTPS`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedOn || '')) fail(`source ${source.id} has invalid checkedOn date`);
}

for (const question of questions) {
  if (!question?.id || typeof question.id !== 'string') fail('question missing string id');
  if (questionIds.has(question.id)) fail(`duplicate question id ${question.id}`);
  questionIds.add(question.id);

  if (question.status !== manifest.requiredStatus) fail(`${question.id} status must be ${manifest.requiredStatus}`);
  if (question.audit !== manifest.requiredAudit) fail(`${question.id} audit must be ${manifest.requiredAudit}`);
  if (question.version !== manifest.datasetVersion) fail(`${question.id} version must be ${manifest.datasetVersion}`);
  if (!manifest.allowedDifficulties.includes(question.difficulty)) fail(`${question.id} has invalid difficulty ${question.difficulty}`);
  if (!Number.isInteger(question.points) || question.points < 1 || question.points > 4) fail(`${question.id} has invalid points`);
  if (!question.question || !question.explanation || !question.context) fail(`${question.id} is missing question/explanation/context text`);

  const letters = ['A', 'B', 'C', 'D'];
  if (!question.choices || letters.some((letter) => !String(question.choices[letter] || '').trim())) fail(`${question.id} must contain A-D choices`);
  if (!letters.includes(question.correctLetter)) fail(`${question.id} has invalid correctLetter`);
  if (question.correctAnswer !== question.choices[question.correctLetter]) fail(`${question.id} correctAnswer does not match ${question.correctLetter}`);
  if (!Array.isArray(question.sourceIds) || question.sourceIds.length === 0) fail(`${question.id} has no sources`);
  for (const sourceId of question.sourceIds) {
    if (!sourceIds.has(sourceId)) fail(`${question.id} references missing source ${sourceId}`);
  }
}

assertSameCounts(countBy(questions, 'difficulty'), manifest.difficultyCounts, 'difficulty counts');
assertSameCounts(countBy(questions, 'category'), manifest.categoryCounts, 'category counts');

const sortedIds = [...questionIds].sort();
if (sortedIds[0] !== 'HIQ-S1-001' || sortedIds.at(-1) !== 'HIQ-S1-080') {
  fail(`unexpected question ID range ${sortedIds[0]}..${sortedIds.at(-1)}`);
}

for (const filename of ['manifest.json', ...manifest.questionChunks, ...manifest.sourceChunks]) {
  const canonical = await readText(dataDir, filename);
  let publicCopy;
  try {
    publicCopy = await readText(publicDataDir, filename);
  } catch {
    fail(`public runtime copy is missing ${filename}`);
  }
  if (canonical !== publicCopy) fail(`public runtime copy drifted from canonical data: ${filename}`);
}

console.log(`High IQ dataset ${manifest.datasetVersion}: ${questions.length} Approved/PASS questions and ${sources.length} sources validated; public runtime copies match byte-for-byte.`);
