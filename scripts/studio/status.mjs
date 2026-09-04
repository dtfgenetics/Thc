#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { classifyPaths, parseWorkBranch } from './core.mjs'

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return fallback
  }
}

const argv = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))

const repoRoot = git(['rev-parse', '--show-toplevel'])
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}

if (argv.refresh === 'true') {
  try {
    execFileSync('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: repoRoot, stdio: 'ignore' })
  } catch {
    // Status remains useful offline; report the local remote-tracking view below.
  }
}

const branch = git(['branch', '--show-current'])
const head = git(['rev-parse', 'HEAD'])
const main = git(['rev-parse', '--verify', 'origin/main'])
const mergeBase = main ? git(['merge-base', main, head]) : ''
const diffBase = argv.base || mergeBase || `${head}^`
const filesText = git(['diff', '--name-only', `${diffBase}...${head}`]) || git(['show', '--pretty=', '--name-only', head])
const files = filesText ? [...new Set(filesText.split('\n').map((value) => value.trim()).filter(Boolean))].sort() : []
const config = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))
const classification = classifyPaths(config, files)
const session = parseWorkBranch(branch)
const dirty = Boolean(git(['status', '--porcelain']))

const result = {
  ok: true,
  branch,
  session,
  head,
  observedMain: main || null,
  mergeBase: mergeBase || null,
  behindMain: main && mergeBase ? git(['rev-list', '--count', `${head}..${main}`], '0') : null,
  aheadOfBase: mergeBase ? git(['rev-list', '--count', `${mergeBase}..${head}`], '0') : null,
  dirty,
  changedFiles: files,
  resources: classification.resources,
  unmatchedFiles: classification.unmatched,
  note: 'Being behind main is informational during development. Integrate against current main at the final integration boundary instead of repeatedly rewriting the working branch.'
}

console.log(JSON.stringify(result, null, 2))
