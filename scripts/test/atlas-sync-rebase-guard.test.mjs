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
  const push = section.indexOf('git push "--force-with-lease=${remote_ref}:${expected_remote_sha}"');
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
  assert.match(section, /git push "--force-with-lease=\$\{remote_ref\}:\$\{expected_remote_sha\}"/);
});

test('sync branch lease uses a freshly observed remote SHA, not stale checkout tracking', () => {
  const remote = section.indexOf('expected_remote_sha="$(git ls-remote --heads origin');
  const guard = section.indexOf('if [ -n "${expected_remote_sha}" ]');
  const leasedPush = section.indexOf('git push "--force-with-lease=${remote_ref}:${expected_remote_sha}"');
  const verification = section.indexOf('pushed_sha="$(git ls-remote --heads origin');
  assert.ok(remote >= 0 && guard > remote && leasedPush > guard && verification > leasedPush,
    'the mirror branch must be explicitly observed and leased before publishing, then verified');
  assert.match(section, /git fetch --no-tags origin "\$\{remote_ref\}"/,
    'remote branch must be fetched before verifying pinned contents');
  assert.doesNotMatch(section, /git push --force-with-lease origin/,
    'implicit or stale remote-tracking leases must not be used');
});
