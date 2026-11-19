import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = fs.readFileSync('.github/workflows/sync-canonical-tools.yml', 'utf8');

test('canonical mirror sync uses explicit remote lease and verifies pushed revision', () => {
  assert.match(workflow, /expected_remote_sha="\$\(git ls-remote --heads origin/);
  assert.match(workflow, /--force-with-lease=\$\{remote_ref\}:\$\{expected_remote_sha\}/);
  assert.match(workflow, /pushed_sha="\$\(git ls-remote --heads origin/);
  assert.match(workflow, /git show "FETCH_HEAD:site\/public-route-patch\/assets\/release-source-revisions\/tools\.txt"/);
  assert.doesNotMatch(workflow, /git push --force-with-lease origin/);
  assert.match(workflow, /git fetch --no-tags origin "\$\{remote_ref\}"/);
});

test('explicit compare-and-swap rejects another writer and works with no local tracking ref', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtf-tools-lease-'));
  const run = (dir, ...args) => {
    const p = spawnSync('git', args, { cwd:dir, encoding:'utf8' });
    assert.equal(p.status, 0, `git ${args.join(' ')}: ${p.stderr}`);
    return p.stdout.trim();
  };
  try {
    const bare = path.join(tmp,'remote.git');
    fs.mkdirSync(bare);
    run(bare,'init','--bare');
    const local = path.join(tmp,'writer');
    fs.mkdirSync(local);
    run(local,'init');
    run(local,'config','user.email','ci@example.invalid');
    run(local,'config','user.name','CI fixture');
    run(local,'remote','add','origin',bare);
    fs.writeFileSync(path.join(local,'state.txt'),'original');
    run(local,'add','state.txt');
    run(local,'commit','-m','original');
    const ref='refs/heads/work/platform/canonical-tools-sync/automation';
    const initial=run(local,'rev-parse','HEAD');
    // A new remote branch must succeed with an explicitly empty expected SHA.
    run(local,'push',`--force-with-lease=${ref}:`, 'origin', `HEAD:${ref}`);
    fs.writeFileSync(path.join(local,'state.txt'),'next');
    run(local,'commit','-am','next');
    const newer=run(local,'rev-parse','HEAD');
    assert.notEqual(newer,initial);
    // Two competing sessions each saw the same old remote SHA.
    run(local,'push',`--force-with-lease=${ref}:${initial}`,'origin',`HEAD:${ref}`);
    const stale=spawnSync('git',['push',`--force-with-lease=${ref}:${initial}`,'origin',`HEAD:${ref}`],{cwd:local,encoding:'utf8'});
    assert.notEqual(stale.status,0,'stale remote lease must be rejected');
    assert.equal(run(local,'ls-remote','--heads','origin',ref).split(/\s+/)[0],newer);
  } finally {
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
