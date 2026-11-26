import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const script = join(root, 'scripts/validate-technology-adoption-registry.mjs');
const source = JSON.parse(execFileSync('node', ['-p', "require('fs').readFileSync('data/technology-adoption-registry.json','utf8')"], { cwd: root, encoding: 'utf8' }));
function validate(data) {
  const dir = mkdtempSync(join(tmpdir(), 'dtf-technology-'));
  const path = join(dir, 'registry.json');
  try {
    writeFileSync(path, JSON.stringify(data));
    return spawnSync(process.execPath, [script, path], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('canonical discovered registry is valid', () => assert.equal(validate(source).status, 0));
test('duplicate IDs are rejected', () => {
  const data = structuredClone(source); data.candidates.push({ ...data.candidates[0] });
  assert.notEqual(validate(data).status, 0);
});
test('approval without security and license verification is rejected', () => {
  const data = structuredClone(source); data.candidates[0].status = 'approved';
  assert.notEqual(validate(data).status, 0);
});
test('integration without PR/tests is rejected', () => {
  const data = structuredClone(source); Object.assign(data.candidates[0], { status:'integrated', license:'MIT', license_evidence:'reviewed-source', security_review:'reviewed' });
  assert.notEqual(validate(data).status, 0);
});
test('production status without deployment/live evidence is rejected', () => {
  const data = structuredClone(source); Object.assign(data.candidates[0], { status:'production-verified', license:'MIT', license_evidence:'reviewed-source', security_review:'reviewed', pull_request:'https://github.com/example/repo/pull/1', tests:'CI passed' });
  assert.notEqual(validate(data).status, 0);
});
test('invalid source URL and unknown repository are rejected', () => {
  const data = structuredClone(source); Object.assign(data.candidates[0], { source:'http://untrusted.invalid', target_repo:'other/unknown' });
  assert.notEqual(validate(data).status, 0);
});
