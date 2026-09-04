import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const tool = resolve(root, 'games/high-iq/scripts/question-bank.mjs');

function run(args) {
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

const found = JSON.parse(run(['get', 'HIQ-S1-160']));
assert.equal(found.question.id, 'HIQ-S1-160');
assert.match(found.chunk, /^questions-/);
assert.equal(found.question.choices[found.question.correctLetter], found.question.correctAnswer);

const search = run(['list', 'Plant Biology']);
assert.match(search, /HIQ-S1-/);
assert.match(search, /Plant Biology/);

const dir = await mkdtemp(join(tmpdir(), 'hiq-authoring-'));
try {
  const templatePath = join(dir, 'question.json');
  run(['template', templatePath]);
  const template = JSON.parse(await readFile(templatePath, 'utf8'));
  assert.deepEqual(Object.keys(template.choices), ['A', 'B', 'C', 'D']);
  assert.equal(template.correctAnswer, template.choices[template.correctLetter]);
  assert.ok(template.sourceIds.length > 0);
  assert.match(template.version, /^\d+\.\d+$/);
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log('High IQ question-bank authoring tool smoke test passed.');
