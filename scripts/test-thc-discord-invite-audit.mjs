import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const directory = await mkdtemp(join(tmpdir(), 'thc-discord-audit-'));
const script = new URL('./audit-thc-discord-invites.mjs', import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [script, `--root=${directory}`, ...args], { encoding: 'utf8' });
try {
  await mkdir(join(directory, 'site'), { recursive: true });
  await writeFile(join(directory, 'README.md'), 'Join https://discord.gg/ABC123 for learning.\n');
  await writeFile(join(directory, 'site', 'index.html'), '<a href="https://discord.com/invite/ABC123">Join</a>');
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  let parsed = JSON.parse(result.stdout);
  assert.equal(parsed.distinctInviteCodes, 1);
  assert.equal(parsed.invites[0].count, 2);
  assert.equal(run('--strict', '--expected=ABC123').status, 0);
  assert.notEqual(run('--strict').status, 0, 'strict requires verified code');
  assert.notEqual(run('--strict', '--expected=BADCODE').status, 0);
  await writeFile(join(directory, 'site', 'other.html'), 'https://discord.gg/XYZ789\n');
  result = run('--strict', '--expected=ABC123');
  assert.notEqual(result.status, 0, 'strict rejects conflicting codes');
  parsed = JSON.parse(result.stdout);
  assert.equal(parsed.distinctInviteCodes, 2);
  console.log('Discord invite audit test passed');
} finally {
  await rm(directory, { recursive: true, force: true });
}
