import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../.github/workflows/sync-canonical-tools.yml', import.meta.url), 'utf8');
const sectionStart = source.indexOf('      - name: Commit mirror update when changed');
assert.ok(sectionStart >= 0, 'canonical sync commit step is missing');
const section = source.slice(sectionStart);

test('new integration main is inspected before any sync rebase or push', () => {
  const fetch = section.indexOf('git fetch origin main');
  const worktree = section.indexOf('git worktree add --detach "$mirror_worktree" origin/main');
  const guard = section.indexOf('DTF_ATLAS_MIRROR_DIR="$mirror_worktree/site/public-route-patch/atlas" node scripts/guard-atlas-preservation.mjs');
  const rebase = section.indexOf('git rebase origin/main');
  const push = section.indexOf('git push --force-with-lease');
  for (const [name, index] of Object.entries({fetch, worktree, guard, rebase, push})) {
    assert.ok(index >= 0, name + ' contract missing');
  }
  assert.ok(fetch < worktree && worktree < guard && guard < rebase && rebase < push,
    'new main preservation must be checked before rebasing or pushing');
});

test('failed post-fetch preservation cannot publish a synchronized mirror', () => {
  assert.match(section, /if ! DTF_ATLAS_MIRROR_DIR=.*node scripts\/guard-atlas-preservation\.mjs; then/);
  assert.match(section, /New THC main contains Atlas lessons the canonical sync would damage; refusing rebase and mirror push/);
  assert.match(section, /git worktree remove --force "\$mirror_worktree"\s+echo "::error::[^"\n]+"\s+exit 1/);
});

test('post-rebase exact canonical mirror parity remains required', () => {
  assert.match(section, /TOOLS_REPO_DIR=\/tmp\/tools npm run verify:cultivation-reference-tools/);
  assert.match(section, /test "\$\{pinned_tools_sha\}" = "\$\{expected_tools_sha\}"/);
  assert.match(section, /git push --force-with-lease/);
});

test('sync branch lease uses a freshly observed remote SHA, not stale checkout tracking', () => {
  const remote = section.indexOf('git ls-remote --heads origin');
  const refresh = section.indexOf('git fetch origin "+refs/heads/${sync_branch}:refs/remotes/origin/${sync_branch}"');
  const guard = section.indexOf('if [ "${fetched_sync_sha}" != "${remote_sync_sha}" ]; then');
  const leasedPush = section.indexOf('git push --force-with-lease="refs/heads/${sync_branch}:${remote_sync_sha}"');
  assert.ok(remote >= 0 && refresh > remote && guard > refresh && leasedPush > guard,
    'the mirror branch must be fetched and its exact remote SHA leased before a history rewrite');
  assert.match(section, /git push origin "HEAD:refs\/heads\/\$\{sync_branch\}"/,
    'initial sync must create the remote branch without force');
  assert.doesNotMatch(section, /git push --force-with-lease origin/,
    'implicit/stale remote-tracking leases must not be used');
});
