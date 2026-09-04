#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { assessOverlap, candidateSupersession, classifyPaths } from './core.mjs'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trim()
  } catch {
    return ''
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'ignore', ...options })
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'])
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}
if (!capture('gh', ['--version'], { cwd: repoRoot })) {
  console.error('studio:overlap requires GitHub CLI so it can inspect active pull requests.')
  process.exit(2)
}

// Refresh observation only. Do not merge/rebase current main into the working session.
run('git', ['fetch', '--quiet', 'origin', 'main'], { cwd: repoRoot })
const branch = capture('git', ['branch', '--show-current'], { cwd: repoRoot })
const main = capture('git', ['rev-parse', '--verify', 'origin/main'], { cwd: repoRoot })
const head = capture('git', ['rev-parse', 'HEAD'], { cwd: repoRoot })
const mergeBase = main ? capture('git', ['merge-base', main, head], { cwd: repoRoot }) : ''
const changed = capture('git', ['diff', '--name-only', `${mergeBase || `${head}^`}...${head}`], { cwd: repoRoot })
const files = changed ? changed.split('\n').map((v) => v.trim()).filter(Boolean) : []
const config = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))
const current = { files, resources: classifyPaths(config, files).resources }

const prJson = capture('gh', [
  'pr', 'list', '--state', 'open', '--base', 'main', '--limit', '100',
  '--json', 'number,title,headRefName,headRefOid,mergeable,isDraft,url'
], { cwd: repoRoot })
const prs = prJson ? JSON.parse(prJson) : []
const results = []

for (const pr of prs) {
  if (pr.headRefName === branch) continue
  const detailText = capture('gh', ['pr', 'view', String(pr.number), '--json', 'files,body'], { cwd: repoRoot })
  if (!detailText) continue
  const detail = JSON.parse(detailText)
  const otherFiles = (detail.files || []).map((file) => file.path).filter(Boolean)
  const other = {
    files: otherFiles,
    resources: classifyPaths(config, otherFiles).resources,
    mergeable: pr.mergeable,
  }
  const overlap = assessOverlap(current, other)
  if (overlap.developmentRisk === 'green' && !overlap.serializeProduction) continue
  results.push({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    headRefName: pr.headRefName,
    headRefOid: pr.headRefOid,
    isDraft: pr.isDraft,
    mergeable: pr.mergeable,
    ...overlap,
    possibleSupersession: candidateSupersession(current, other),
    supersessionIsAdvisory: true,
  })
}

const red = results.filter((item) => item.developmentRisk === 'red').length
const yellow = results.filter((item) => item.developmentRisk === 'yellow').length
const serialized = results.filter((item) => item.serializeProduction).length
console.log(JSON.stringify({
  ok: true,
  branch,
  head,
  observedMain: main,
  current,
  summary: { red, yellow, serialized, inspectedOpenPrs: prs.length },
  overlaps: results,
  guidance: {
    green: 'Continue normally.',
    yellow: 'Continue development. Recheck at integration and expand affected tests when shared resources changed.',
    red: 'Continue development if useful, but final integration requires semantic conflict repair against current main.',
    production: 'Only matching production targets serialize; unrelated releases remain parallel.'
  }
}, null, 2))
