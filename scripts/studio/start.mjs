#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { createSessionId, makeWorkBranch } from './core.mjs'

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

if (options.resume) {
  console.error('studio:start never resumes implicitly. Use npm run studio:resume -- <branch-or-pr>.')
  process.exit(2)
}

const [project, task] = positional
if (!project || !task) {
  console.error('Usage: node scripts/studio/start.mjs <project-id> <task> [--base=main] [--root=/path] [--session=id]')
  process.exit(2)
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'])
if (!repoRoot) {
  console.error('Run this command from inside the Thc Git repository.')
  process.exit(2)
}

const base = options.base || 'main'
const session = options.session || createSessionId()
const branch = makeWorkBranch(project, task, session)
const repoName = basename(repoRoot)
const worktreeRoot = options.root ? resolve(options.root) : join(dirname(repoRoot), `${repoName}-worktrees`)
const worktreePath = join(worktreeRoot, branch.replaceAll('/', '-'))

if (existsSync(worktreePath)) {
  console.error(`Refusing to reuse an existing worktree path: ${worktreePath}`)
  process.exit(1)
}

run('git', ['fetch', 'origin', base], { cwd: repoRoot })

const localBranch = capture('git', ['show-ref', '--verify', `refs/heads/${branch}`], { cwd: repoRoot })
const remoteBranch = capture('git', ['ls-remote', '--heads', 'origin', branch], { cwd: repoRoot })
if (localBranch || remoteBranch) {
  console.error(`Refusing to reuse existing session branch ${branch}. Start without --session or use studio:resume explicitly.`)
  process.exit(1)
}

mkdirSync(worktreeRoot, { recursive: true })
run('git', ['worktree', 'add', '-b', branch, worktreePath, `origin/${base}`], { cwd: repoRoot })

const head = capture('git', ['rev-parse', 'HEAD'], { cwd: worktreePath })
console.log(JSON.stringify({
  ok: true,
  mode: 'new-session',
  project,
  task,
  session,
  branch,
  worktree: worktreePath,
  base: `origin/${base}`,
  baseSha: head,
  message: 'Independent studio session created. Development may proceed immediately without synchronizing other active work.'
}, null, 2))
