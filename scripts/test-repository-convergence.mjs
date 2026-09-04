#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const watch = read('.github/workflows/wordpress-canonical-watch.yml')
const deploy = read('.github/workflows/wordpress-canonical-deploy.yml')
const titleWorkflow = read('.github/workflows/wordpress-premium-title-normalization.yml')
const titleScript = read('scripts/normalize-wordpress-premium-page-titles.mjs')
const lifecycleWorkflow = read('.github/workflows/branch-lifecycle-maintenance.yml')
const lifecycleScript = read('scripts/studio/lifecycle.mjs')

assert.match(watch, /push:\n\s+branches: \[main\]\n\s+paths:/)
assert.match(watch, /pull_request:\n\s+branches: \[main\]\n\s+paths:/)
assert.ok(watch.includes("'site/wordpress/**'"), 'WordPress watcher must scope itself to WordPress-owned paths.')
assert.ok(!deploy.includes('\n  workflow_run:\n'), 'Production staging must not be launched by the scheduled/read-only watcher.')
assert.ok(deploy.includes('push:\n    branches: [main]\n    paths:'), 'Production staging must be driven by relevant main path changes.')

for (const source of [titleScript, titleWorkflow]) {
  assert.ok(source.includes('Stronger together.'), 'Community title checks must follow the current canonical hero.')
  assert.ok(!source.includes('Grow together. Learn together. Build together.'), 'Stale Community hero marker must not return.')
}

assert.ok(lifecycleWorkflow.includes('contents: write'), 'Lifecycle maintenance needs branch-delete permission.')
assert.ok(lifecycleWorkflow.includes('lifecycle --cleanup-merged --summary'), 'Lifecycle maintenance must use conservative integrated-only cleanup.')
assert.ok(lifecycleScript.includes("duplicateHead: 'report only"), 'Duplicate branch tips must remain report-only evidence.')
assert.ok(lifecycleScript.includes('item.managed && item.safeToDelete'), 'Automatic cleanup must be limited to managed, proven-integrated branches.')

console.log('Repository convergence regression tests passed.')
