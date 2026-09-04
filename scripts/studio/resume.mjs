#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { parseWorkBranch } from './core.mjs'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', ...options }).trim()
  } catch {
    return ''
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options })
}

const raw = process.argv.slice(2)
const positional = raw.filter((arg) => !arg.startsWith('--'))
const options = Object.fromEntries(raw.filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))

let [target] = positional
if (!target) {
  console.error('Usage: node scripts/studio/resume.mjs <work-branch|pr-number> [--root=/path]')
  process.exit(2)
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'])
if (!repoRoot) {
  console.error('Run this command from inside the Thc Git repository.')
  process.exit(2)
}

if (/^#?\d+$/.test(target)) {
  const pr = target.replace(/^#/, '')
  const gh = capture('gh', ['--version'], { cwd: repoRoot })
  if (!gh) {
    console.error('Resolving a PR number requires GitHub CLI. Pass the explicit work/... branch instead.')
    process.exit(2)
  }
  target = capture('gh', ['pr', 'view', pr, '--json', 'headRefName', '--jq', '.headRefName'], { cwd: repoRoot })
}

const session = parseWorkBranch(target)
if (!session) {
  console.error(`Refusing to resume non-session branch '${target}'. Expected work/<project>/<task>/<session>.`)
  process.exit(2)
}

run('git', ['fetch', 'origin', target], { cwd: repoRoot })
const remoteRef = `refs/remotes/origin/${target}`
if (!capture('git', ['show-ref', '--verify', remoteRef], { cwd: repoRoot })) {
  console.error(`Remote session branch does not exist: ${target}`)
  process.exit(1)
}

const repoName = basename(repoRoot)
const worktreeRoot = options.root ? resolve(options.root) : join(dirname(repoRoot), `${repoName}-worktrees`)
const worktreePath = join(worktreeRoot, target.replaceAll('/', '-'))
if (existsSync(worktreePath)) {
  console.error(`Session worktree already exists: ${worktreePath}`)
  process.exit(1)
}
mkdirSync(worktreeRoot, { recursive: true })

const localRef = capture('git', ['show-ref', '--verify', `refs/heads/${target}`], { cwd: repoRoot })
if (!localRef) run('git', ['branch', '--track', target, `origin/${target}`], { cwd: repoRoot })
run('git', ['worktree', 'add', worktreePath, target], { cwd: repoRoot })

console.log(JSON.stringify({
  ok: true,
  mode: 'resume-session',
  ...session,
  branch: target,
  worktree: worktreePath,
  head: capture('git', ['rev-parse', 'HEAD'], { cwd: worktreePath })
}, null, 2))
