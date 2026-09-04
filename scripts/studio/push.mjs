#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { classifyPaths, parseWorkBranch } from './core.mjs'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trim()
  } catch {
    return ''
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options })
}

const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'])
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}

const branch = capture('git', ['branch', '--show-current'], { cwd: repoRoot })
const session = parseWorkBranch(branch)
if (!session) {
  console.error('studio:push requires a work/<project>/<task>/<session> branch. Use project:push for legacy project/* work.')
  process.exit(2)
}

if (capture('git', ['status', '--porcelain'], { cwd: repoRoot })) {
  console.error('Commit working-tree changes before studio:push so the remote session is complete and reproducible.')
  process.exit(1)
}

run(process.execPath, ['scripts/project-lane-check.mjs', `--branch=${branch}`], { cwd: repoRoot })

const main = capture('git', ['rev-parse', '--verify', 'origin/main'], { cwd: repoRoot })
const head = capture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot })
const mergeBase = main ? capture('git', ['merge-base', main, head], { cwd: repoRoot }) : ''
const changedText = capture('git', ['diff', '--name-only', `${mergeBase || `${head}^`}...${head}`], { cwd: repoRoot })
const changedFiles = changedText ? changedText.split('\n').map((v) => v.trim()).filter(Boolean) : []
const resourceConfig = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))
const resources = classifyPaths(resourceConfig, changedFiles).resources

console.log(`Pushing isolated studio session ${branch} without merging main into the working branch...`)
run('git', ['push', '--set-upstream', 'origin', branch], { cwd: repoRoot })

if (!capture('gh', ['--version'], { cwd: repoRoot })) {
  console.log(JSON.stringify({ ok: true, branch, head, pushed: true, pr: null, resources }, null, 2))
  process.exit(0)
}

let prUrl = capture('gh', [
  'pr', 'list', '--head', branch, '--base', 'main', '--state', 'open',
  '--json', 'url', '--jq', '.[0].url'
], { cwd: repoRoot })

if (!prUrl) {
  const metadata = [
    '<!-- dtf-studio-session',
    `session: ${session.sessionId}`,
    `project: ${session.projectId}`,
    `task: ${session.task}`,
    `head: ${head}`,
    `resources: ${resources.map((resource) => resource.id).join(',') || 'unclassified'}`,
    `productionTargets: ${[...new Set(resources.flatMap((resource) => resource.productionTargets || []))].join(',') || 'none'}`,
    'dtf-studio-session -->',
    '',
    'Studio session is isolated. Integration compatibility is evaluated against current main at the final integration boundary.'
  ].join('\n')
  const title = args.title || `${session.projectId}: ${session.task}`
  const createArgs = ['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', metadata]
  if (args.ready !== 'true') createArgs.push('--draft')
  prUrl = capture('gh', createArgs, { cwd: repoRoot })
}

console.log(JSON.stringify({
  ok: true,
  branch,
  head,
  session,
  resources,
  pushed: true,
  pr: prUrl,
  mainWasMergedIntoSession: false,
  next: 'Run studio:overlap while iterating and studio:integrate at the final integration boundary.'
}, null, 2))
