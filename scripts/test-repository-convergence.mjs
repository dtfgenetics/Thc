#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

const watch = read('.github/workflows/wordpress-canonical-watch.yml')
const deploy = read('.github/workflows/wordpress-canonical-deploy.yml')
const lightingBridge = read('.github/workflows/lighting-asset-bridge-production.yml')
const titleWorkflow = read('.github/workflows/wordpress-premium-title-normalization.yml')
const titleScript = read('scripts/normalize-wordpress-premium-page-titles.mjs')
const lifecycleWorkflow = read('.github/workflows/branch-lifecycle-maintenance.yml')
const lifecycleScript = read('scripts/studio/lifecycle.mjs')
const reviewedRetirementScript = read('scripts/studio/retire-reviewed.mjs')
const retirementRegistry = JSON.parse(read('data/branch-retirements.json'))
const highLandCI = read('.github/workflows/high-land-ci.yml')
const datadogCI = read('.github/workflows/datadog-synthetics.yml')

assert.match(watch, /push:\n\s+branches: \[main\]\n\s+paths:/)
assert.match(watch, /pull_request:\n\s+branches: \[main\]\n\s+paths:/)
assert.ok(watch.includes("'site/wordpress/**'"), 'WordPress watcher must scope itself to WordPress-owned paths.')
assert.ok(!deploy.includes('\n  workflow_run:\n'), 'Production staging must not be launched by the scheduled/read-only watcher.')
assert.ok(deploy.includes('push:\n    branches: [main]\n    paths:'), 'Production staging must be driven by relevant main path changes.')

for (const [name, workflow, exhaustedIssue] of [
  ['WordPress canonical preflight', watch, 220],
  ['Lighting asset bridge', lightingBridge, 46],
]) {
  assert.ok(!workflow.includes('issues: write'), `${name} must not request issue-write permission for routine telemetry.`)
  assert.ok(!workflow.includes(`issue_number: ${exhaustedIssue}`), `${name} must not post routine telemetry to exhausted issue #${exhaustedIssue}.`)
  assert.ok(!workflow.includes('github.rest.issues.createComment'), `${name} must keep routine status reporting out of issue comments.`)
  assert.ok(workflow.includes('core.summary.addRaw'), `${name} must preserve operator visibility in the Actions job summary.`)
}
assert.ok(watch.includes('Publish preflight summary'), 'WordPress canonical preflight must publish a job summary.')
assert.ok(lightingBridge.includes('Publish bridge summary'), 'Lighting asset bridge must publish a job summary.')

assert.ok(titleScript.includes("const targetSlugs=['community','gallery']"), 'Editorial title normalizer must keep its scope explicit.')
assert.ok(titleScript.includes('site/wordpress/pages/${slug}.html'), 'Editorial title markers must come from canonical page files.')
assert.ok(titleScript.includes('canonical page has no usable H1 marker'), 'Missing canonical H1s must fail closed.')
assert.ok(titleWorkflow.includes('canonical_h1(){'), 'Live title verification must derive the same canonical H1 markers.')
assert.ok(titleWorkflow.includes('site/wordpress/pages/community.html'), 'Community canonical source must drive title verification.')
assert.ok(titleWorkflow.includes('site/wordpress/pages/gallery.html'), 'Gallery canonical source must drive title verification.')
for (const stale of ['Grow together. Learn together. Build together.','DTF Visual Library','See the plant science, genetics, tools, games, and community work.']) {
  assert.ok(!titleScript.includes(stale), `Stale hard-coded title marker must not return: ${stale}`)
  assert.ok(!titleWorkflow.includes(stale), `Stale workflow title marker must not return: ${stale}`)
}

assert.ok(lifecycleWorkflow.includes('contents: write'), 'Lifecycle maintenance needs branch-delete permission.')
assert.ok(lifecycleWorkflow.includes('lifecycle --cleanup-merged --summary'), 'Lifecycle maintenance must use conservative integrated-only cleanup.')
assert.ok(lifecycleWorkflow.includes('lifecycle --recovery-only'), 'Lifecycle maintenance must build a post-cleanup recovery inventory.')
assert.ok(lifecycleWorkflow.includes('retire-reviewed.mjs --apply'), 'Lifecycle maintenance must execute only explicitly reviewed supersessions through the fail-closed retirement command.')
assert.ok(lifecycleWorkflow.includes("'data/branch-retirements.json'"), 'Reviewed retirement records must retrigger lifecycle maintenance.')
assert.ok(lifecycleWorkflow.includes('reviewed-retirements.json'), 'Reviewed retirement decisions must be persisted in the maintenance artifact.')
assert.ok(lifecycleWorkflow.includes('actions/upload-artifact@v4'), 'Lifecycle maintenance must persist the recovery inventory as an artifact.')
assert.ok(lifecycleWorkflow.includes('retention-days: 90'), 'Recovery inventories need enough retention for deliberate salvage work.')
assert.ok(lifecycleWorkflow.includes('branch-recovery.csv'), 'Recovery inventories must include a spreadsheet-friendly CSV.')
assert.ok(lifecycleScript.includes("duplicateHead: 'report only"), 'Duplicate branch tips must remain report-only evidence.')
assert.ok(lifecycleScript.includes('item.managed && item.safeToDelete'), 'Automatic cleanup must be limited to managed, proven-integrated branches.')
assert.ok(lifecycleScript.includes("item.state === 'closed-unmerged' || item.state === 'orphan-unique'"), 'Recovery candidates must include only preserved unmerged lifecycle states.')
assert.ok(lifecycleScript.includes("flags.has('--recovery-only')"), 'Lifecycle command must expose a recovery-only machine-readable mode.')

for (const marker of [
  "currentHead === expectedHead",
  "'pr', 'list', '--state', 'open'",
  "'merge-base', '--is-ancestor', supersededBy, main",
  "entry?.status === 'approved'",
  "branch !== 'main'",
  "'push', 'origin', '--delete', item.branch",
  "changedBranchHead: 'block deletion until reviewed again'",
]) assert.ok(reviewedRetirementScript.includes(marker), `Reviewed branch retirement safety marker missing: ${marker}`)
assert.equal(retirementRegistry.schemaVersion, 1)
assert.ok(Array.isArray(retirementRegistry.retirements))
for (const entry of retirementRegistry.retirements) {
  assert.equal(entry.status, 'approved')
  assert.match(entry.headSha, /^[0-9a-f]{40}$/)
  assert.match(entry.supersededBy, /^[0-9a-f]{40}$/)
  assert.notEqual(entry.branch, 'main')
}
for (const branch of ['game/burn-buds-production-pass','game/burn-buds-production-pass-v2']) {
  assert.ok(retirementRegistry.retirements.some((entry) => entry.branch === branch), `Reviewed Burn Buds supersession missing: ${branch}`)
}

assert.match(highLandCI, /pull_request:\n\s+branches:\n\s+- main\n\s+paths:/)
assert.match(highLandCI, /push:\n\s+branches:\n\s+- main\n\s+paths:/)
assert.ok(highLandCI.includes("'apps/high-land-web/**'"), 'High Land CI must be scoped to High Land-owned paths.')
assert.equal(existsSync('.github/workflows/high-land-web.yml'), false, 'Duplicate High Land Web Game CI must stay retired.')
assert.ok(highLandCI.includes('Run High Land browser smoke tests'), 'The surviving High Land CI must retain browser validation.')
assert.ok(highLandCI.includes('Lint PHP room API files'), 'The surviving High Land CI must retain PHP API linting.')

assert.ok(datadogCI.includes('workflow_dispatch:'), 'Visitor synthetics must remain manually runnable.')
assert.ok(datadogCI.includes('push:\n    branches: [main]\n    paths:'), 'Visitor synthetics must be limited to relevant main changes.')
assert.ok(!datadogCI.includes('\n  pull_request:'), 'Live-site Datadog synthetics must not consume runners on isolated PRs.')
assert.ok(datadogCI.includes("'site/**'"), 'Visitor synthetics must cover site changes.')
assert.ok(datadogCI.includes("'apps/**'"), 'Visitor synthetics must cover app/game changes.')

console.log('Repository convergence regression tests passed.')
