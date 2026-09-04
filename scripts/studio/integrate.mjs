#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trim()
  } catch (error) {
    if (options.allowFailure) return ''
    throw error
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options })
}

const raw = process.argv.slice(2)
const positional = raw.filter((arg) => !arg.startsWith('--'))
const args = Object.fromEntries(raw.filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { allowFailure: true })
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}
if (!capture('gh', ['--version'], { cwd: repoRoot, allowFailure: true })) {
  console.error('studio:integrate requires GitHub CLI.')
  process.exit(2)
}

let [target] = positional
if (!target) {
  const branch = capture('git', ['branch', '--show-current'], { cwd: repoRoot })
  target = capture('gh', ['pr', 'list', '--head', branch, '--base', 'main', '--state', 'open', '--json', 'number', '--jq', '.[0].number'], { cwd: repoRoot, allowFailure: true })
}
if (!target) {
  console.error('Usage: node scripts/studio/integrate.mjs [pr-number] [--merge]')
  process.exit(2)
}

const prNumber = String(target).replace(/^#/, '')
const prText = capture('gh', [
  'pr', 'view', prNumber,
  '--json', 'number,title,url,isDraft,mergeable,headRefName,headRefOid,baseRefName'
], { cwd: repoRoot })
const pr = JSON.parse(prText)
if (pr.baseRefName !== 'main') {
  console.error(`Refusing integration into unexpected base ${pr.baseRefName}.`)
  process.exit(1)
}
if (pr.isDraft && args.merge === 'true') {
  console.error('Refusing to merge a draft PR. Mark it ready first.')
  process.exit(1)
}

run('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: repoRoot })
run('git', ['fetch', '--quiet', 'origin', pr.headRefName], { cwd: repoRoot })
const mainSha = capture('git', ['rev-parse', 'origin/main'], { cwd: repoRoot })
const fetchedHead = capture('git', ['rev-parse', `origin/${pr.headRefName}`], { cwd: repoRoot })
if (fetchedHead !== pr.headRefOid) {
  console.error(`PR head moved during integration preflight. Expected ${pr.headRefOid}, fetched ${fetchedHead}. Re-run against the new exact head.`)
  process.exit(1)
}

let mergeTree = ''
try {
  mergeTree = capture('git', ['merge-tree', '--write-tree', mainSha, fetchedHead], { cwd: repoRoot })
} catch (error) {
  console.error('Current PR head does not integrate cleanly with current main. Continue development if useful, but repair this conflict before merge.')
  process.exit(error.status || 1)
}

const checksOk = (() => {
  try {
    run('gh', ['pr', 'checks', prNumber], { cwd: repoRoot })
    return true
  } catch {
    return false
  }
})()
if (!checksOk) {
  console.error('PR checks are not all passing for the current head.')
  process.exit(1)
}

const result = {
  ok: true,
  pr: pr.number,
  url: pr.url,
  title: pr.title,
  exactHead: fetchedHead,
  currentMain: mainSha,
  mergeTree,
  mergeableNow: true,
  checksPassing: true,
  sessionBranchWasRewritten: false,
}

if (args.merge !== 'true') {
  console.log(JSON.stringify({ ...result, merged: false, next: `Re-run with --merge to squash-merge exactly ${fetchedHead}.` }, null, 2))
  process.exit(0)
}

run('gh', ['pr', 'merge', prNumber, '--squash', '--match-head-commit', fetchedHead], { cwd: repoRoot })
console.log(JSON.stringify({ ...result, merged: true, note: 'Production remains a separate resource-owned publication and verification step.' }, null, 2))
