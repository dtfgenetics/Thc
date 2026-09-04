import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const dataDir = resolve(repoRoot, 'games/high-iq/data');
const publicDataDir = resolve(repoRoot, 'site/public-route-patch/games/high-iq/data');
const manifestPath = resolve(dataDir, 'manifest.json');
const publicManifestPath = resolve(publicDataDir, 'manifest.json');
const LETTERS = ['A', 'B', 'C', 'D'];
const DIFFICULTY_POINTS = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 };

function fail(message) {
  throw new Error(`High IQ question bank: ${message}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function questionNumber(id) {
  const match = /^HIQ-S1-(\d{3,})$/.exec(String(id || ''));
  return match ? Number(match[1]) : NaN;
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    const key = row[field];
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

async function loadBank() {
  const manifest = await readJson(manifestPath);
  const sourceGroups = await Promise.all(manifest.sourceChunks.map((name) => readJson(resolve(dataDir, name))));
  const sourceIds = new Set(sourceGroups.flat().map((source) => source.id));
  const chunks = [];
  for (const name of manifest.questionChunks) {
    const rows = await readJson(resolve(dataDir, name));
    chunks.push({ name, rows });
  }
  return { manifest, sourceIds, chunks, questions: chunks.flatMap((chunk) => chunk.rows) };
}

function validateQuestion(question, manifest, sourceIds, { allowMissingId = false } = {}) {
  if (!allowMissingId && !Number.isFinite(questionNumber(question.id))) fail('question id must match HIQ-S1-###');
  if (!String(question.question || '').trim()) fail('question text is required');
  if (!String(question.category || '').trim()) fail('category is required');
  if (!manifest.allowedDifficulties.includes(question.difficulty)) fail(`unsupported difficulty: ${question.difficulty}`);
  if (!question.choices || LETTERS.some((letter) => !String(question.choices[letter] || '').trim())) fail('choices A-D are required');
  if (!LETTERS.includes(question.correctLetter)) fail('correctLetter must be A, B, C, or D');
  if (question.correctAnswer !== question.choices[question.correctLetter]) fail('correctAnswer must exactly match the selected choice');
  if (!String(question.explanation || '').trim()) fail('explanation is required');
  if (!String(question.context || '').trim()) fail('context is required');
  if (!Array.isArray(question.sourceIds) || question.sourceIds.length === 0) fail('at least one sourceId is required');
  for (const id of question.sourceIds) if (!sourceIds.has(id)) fail(`unknown sourceId: ${id}`);
  if (question.status !== manifest.requiredStatus) fail(`status must be ${manifest.requiredStatus} before promotion`);
  if (question.audit !== manifest.requiredAudit) fail(`audit must be ${manifest.requiredAudit} before promotion`);
  if (!Number.isInteger(question.points) || question.points !== DIFFICULTY_POINTS[question.difficulty]) {
    fail(`points must be ${DIFFICULTY_POINTS[question.difficulty]} for ${question.difficulty}`);
  }
}

function normalizeQuestion(input, manifest, id) {
  const difficulty = input.difficulty;
  const choices = { A: input.choices?.A, B: input.choices?.B, C: input.choices?.C, D: input.choices?.D };
  const correctLetter = input.correctLetter;
  return {
    id,
    status: input.status,
    batch: Number.isInteger(input.batch) ? input.batch : Math.ceil(questionNumber(id) / 10),
    category: input.category,
    difficulty,
    points: Number.isInteger(input.points) ? input.points : DIFFICULTY_POINTS[difficulty],
    question: input.question,
    choices,
    correctLetter,
    correctAnswer: input.correctAnswer || choices[correctLetter],
    sourceIds: input.sourceIds,
    explanation: input.explanation,
    context: input.context,
    audit: input.audit,
    version: input.version || manifest.datasetVersion
  };
}

function nextId(questions) {
  const max = Math.max(0, ...questions.map((question) => questionNumber(question.id)).filter(Number.isFinite));
  return `HIQ-S1-${String(max + 1).padStart(3, '0')}`;
}

function futureChunkName(number, version) {
  const start = Math.floor((number - 1) / 20) * 20 + 1;
  const end = start + 19;
  return `questions-${String(start).padStart(3, '0')}-${String(end).padStart(3, '0')}.v${version}.json`;
}

async function syncFile(name) {
  const source = await readFile(resolve(dataDir, name), 'utf8');
  await mkdir(publicDataDir, { recursive: true });
  await writeFile(resolve(publicDataDir, name), source, 'utf8');
}

async function saveManifest(manifest, questions) {
  manifest.questionCount = questions.length;
  manifest.categoryCounts = countBy(questions, 'category');
  manifest.difficultyCounts = countBy(questions, 'difficulty');
  manifest.recordVersions = [...new Set(questions.map((question) => question.version))].sort();
  await writeJson(manifestPath, manifest);
  await writeJson(publicManifestPath, manifest);
}

function runNode(path, label) {
  const result = spawnSync(process.execPath, [path], { stdio: 'inherit', cwd: repoRoot });
  if (result.status !== 0) fail(`${label} failed`);
}

async function validateRepo() {
  runNode(resolve(here, 'sync-runtime-shell.mjs'), 'runtime shell sync');
  runNode(resolve(here, 'validate-data.mjs'), 'dataset validation');
  runNode(resolve(here, 'validate-public-runtime.mjs'), 'public runtime validation');
}

function template(manifest) {
  return {
    status: manifest.requiredStatus,
    audit: manifest.requiredAudit,
    category: 'Plant Biology',
    difficulty: 'Medium',
    points: 2,
    question: 'Write one clear, source-backed question here.',
    choices: {
      A: 'Plausible answer A',
      B: 'Plausible answer B',
      C: 'Plausible answer C',
      D: 'Plausible answer D'
    },
    correctLetter: 'A',
    correctAnswer: 'Plausible answer A',
    sourceIds: ['SRC-016'],
    explanation: 'Explain why the correct answer is correct.',
    context: 'Add nuance, limits, or wording context that improves learning.',
    version: manifest.datasetVersion
  };
}

async function commandTemplate(bank, outputPath) {
  const record = template(bank.manifest);
  if (!outputPath) {
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  const path = resolve(process.cwd(), outputPath);
  await writeJson(path, record);
  console.log(`Created ${path}`);
}

async function commandGet(bank, id) {
  for (const chunk of bank.chunks) {
    const question = chunk.rows.find((row) => row.id === id);
    if (question) {
      console.log(JSON.stringify({ chunk: chunk.name, question }, null, 2));
      return;
    }
  }
  fail(`question not found: ${id}`);
}

async function commandList(bank, searchText = '') {
  const query = searchText.trim().toLowerCase();
  const rows = bank.questions
    .filter((question) => !query || [question.id, question.category, question.difficulty, question.question].some((value) => String(value).toLowerCase().includes(query)))
    .sort((a, b) => questionNumber(a.id) - questionNumber(b.id));
  for (const question of rows) console.log(`${question.id}\t${question.difficulty}\t${question.category}\t${question.question}`);
  console.error(`${rows.length} matching question${rows.length === 1 ? '' : 's'}`);
}

async function commandPromote(bank, inputPath) {
  if (!inputPath) fail('promote requires a JSON file');
  const input = await readJson(resolve(process.cwd(), inputPath));
  const id = input.id || nextId(bank.questions);
  if (bank.questions.some((question) => question.id === id)) fail(`duplicate question id: ${id}`);
  const question = normalizeQuestion(input, bank.manifest, id);
  validateQuestion(question, bank.manifest, bank.sourceIds);
  if (bank.questions.some((row) => row.question.trim().toLowerCase() === question.question.trim().toLowerCase())) fail('duplicate question text');

  const number = questionNumber(id);
  let chunk = bank.chunks.find((entry) => entry.name === futureChunkName(number, question.version));
  if (!chunk) {
    const name = futureChunkName(number, question.version);
    chunk = { name, rows: [] };
    bank.chunks.push(chunk);
    bank.manifest.questionChunks.push(name);
  }
  chunk.rows.push(question);
  chunk.rows.sort((a, b) => questionNumber(a.id) - questionNumber(b.id));
  await writeJson(resolve(dataDir, chunk.name), chunk.rows);
  await syncFile(chunk.name);

  const questions = bank.chunks.flatMap((entry) => entry.rows);
  await saveManifest(bank.manifest, questions);
  await validateRepo();
  console.log(`Promoted ${id} into ${chunk.name}. Bank now contains ${questions.length} questions.`);
}

async function commandEdit(bank, id, patchPath) {
  if (!id || !patchPath) fail('edit requires an ID and a JSON patch file');
  const chunk = bank.chunks.find((entry) => entry.rows.some((row) => row.id === id));
  if (!chunk) fail(`question not found: ${id}`);
  const index = chunk.rows.findIndex((row) => row.id === id);
  const current = chunk.rows[index];
  const patch = await readJson(resolve(process.cwd(), patchPath));
  const mergedInput = {
    ...current,
    ...patch,
    choices: { ...current.choices, ...(patch.choices || {}) },
    id
  };
  const updated = normalizeQuestion(mergedInput, bank.manifest, id);
  validateQuestion(updated, bank.manifest, bank.sourceIds);
  if (bank.questions.some((row) => row.id !== id && row.question.trim().toLowerCase() === updated.question.trim().toLowerCase())) fail('duplicate question text');
  chunk.rows[index] = updated;
  await writeJson(resolve(dataDir, chunk.name), chunk.rows);
  await syncFile(chunk.name);

  const questions = bank.chunks.flatMap((entry) => entry.rows);
  await saveManifest(bank.manifest, questions);
  await validateRepo();
  console.log(`Updated ${id} in ${chunk.name}.`);
}

async function commandSync(bank) {
  for (const name of ['manifest.json', ...bank.manifest.questionChunks, ...bank.manifest.sourceChunks]) await syncFile(name);
  await validateRepo();
  console.log(`Synchronized ${bank.manifest.questionCount} questions and ${bank.manifest.sourceCount} sources to the public runtime.`);
}

function usage() {
  console.log(`High IQ question-bank commands:\n\n  template [output.json]      Create an editable question template\n  get <HIQ-S1-###>            Find a question and its chunk\n  list [search text]          Search IDs, category, difficulty, or question text\n  promote <question.json>     Add one reviewed question; assigns the next ID if omitted\n  edit <ID> <patch.json>      Safely edit an existing question by ID\n  sync                        Re-copy canonical data into the public runtime and validate\n\nPromotion/edit automatically validates answers, points, source IDs, duplicates, counts, manifest distributions, canonical/public synchronization, and visible runtime metadata.`);
}

const [command, ...args] = process.argv.slice(2);
const bank = await loadBank();

switch (command) {
  case 'template': await commandTemplate(bank, args[0]); break;
  case 'get': await commandGet(bank, args[0]); break;
  case 'list': await commandList(bank, args.join(' ')); break;
  case 'promote': await commandPromote(bank, args[0]); break;
  case 'edit': await commandEdit(bank, args[0], args[1]); break;
  case 'sync': await commandSync(bank); break;
  default: usage(); if (command) process.exitCode = 1;
}
