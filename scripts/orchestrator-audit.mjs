#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { parseManagedBranch, classifyJobHealth, findDuplicateActiveResourceClaims, findOrphanManagedBranches, findOrphanManagedPrs } from './orchestrator/audit.mjs'

const MARKER_RE = /<!-- worker-orchestrator:(\{.*?\}) -->/s

function capture(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim()
  } catch (error) {
    if (allowFailure) return ''
    throw error
  }
}

function json(args, fallback = null) {
  const output = capture(args, { allowFailure: fallback !== null })
  return output ? JSON.parse(output) : fallback
}

function parseArgs(argv) {
  return Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const raw = arg.slice(2)
    const at = raw.indexOf('=')
    return at === -1 ? [raw, 'true'] : [raw.slice(0, at), raw.slice(at + 1)]
  }))
}

function repoFromEnvOrGh() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  return capture(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
}

function parseMarker(body) {
  const match = String(body || '').match(MARKER_RE)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return { malformed: true } }
}

function listOpenIssues(repo) {
  return json([
    'api', '--paginate', '--slurp', `repos/${repo}/issues?state=open&per_page=100`,
    '--jq', 'flatten | map(select(.pull_request == null))'
  ], [])
}

function listBranches(repo) {
  return json([
    'api', '--paginate', '--slurp', `repos/${repo}/branches?per_page=100`,
    '--jq', 'flatten | map({name:.name,headSha:.commit.sha})'
  ], [])
}

function listPrs(repo) {
  return json([
    'pr', 'list', '--repo', repo, '--state', 'all', '--limit', '500',
    '--json', 'number,state,mergedAt,headRefName,headRefOid,url'
  ], [])
}

function branchInRepo(repo, branch) {
  if (!branch) return { exists: false, name: branch || null, headSha: null }
  const data = json(['api', `repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`], null)
  return data
    ? { exists: true, name: branch, headSha: data.object?.sha || null }
    : { exists: false, name: branch, headSha: null }
}

function branchMap(branches) {
  return new Map(branches.map((branch) => [branch.name, { exists: true, ...branch }]))
}

const options = parseArgs(process.argv.slice(2))
const repo = repoFromEnvOrGh()
const strict = options.strict === 'true'

try {
  const issues = listOpenIssues(repo)
  const branches = listBranches(repo)
  const prs = listPrs(repo)
  const branchesByName = branchMap(branches)
  const externalPrCache = new Map()
  const jobsByIssue = new Map()
  const malformedMarkers = []

  for (const issue of issues) {
    if (!String(issue.body || '').includes('<!-- worker-orchestrator:')) continue
    const job = parseMarker(issue.body)
    if (!job || job.malformed) {
      malformedMarkers.push({ issueNumber: Number(issue.number), code: 'malformed-orchestrator-marker' })
      continue
    }
    jobsByIssue.set(Number(issue.number), job)
  }

  const jobs = []
  const anomalies = [...malformedMarkers]
  const stateCounts = {}
  const resourceOwners = {}

  for (const [issueNumber, job] of jobsByIssue.entries()) {
    stateCounts[job.state || 'UNKNOWN'] = (stateCounts[job.state || 'UNKNOWN'] || 0) + 1
    for (const resource of job.resourceSet || []) {
      if (!resourceOwners[resource]) resourceOwners[resource] = []
      resourceOwners[resource].push(issueNumber)
    }

    const targetRepo = job.repository || repo
    let relatedPrs
    let branch
    if (targetRepo === repo) {
      relatedPrs = prs.filter((pr) => pr.headRefName === job.branch)
      branch = job.branch ? branchesByName.get(job.branch) || { exists: false, name: job.branch } : null
    } else {
      if (!externalPrCache.has(targetRepo)) externalPrCache.set(targetRepo, listPrs(targetRepo))
      relatedPrs = externalPrCache.get(targetRepo).filter((pr) => pr.headRefName === job.branch)
      branch = job.branchProvisioned === false
        ? { exists: false, name: job.branch, provisioningPending: true }
        : branchInRepo(targetRepo, job.branch)
    }
    const health = classifyJobHealth({
      issueNumber,
      job,
      branch,
      prs: relatedPrs,
    }).filter((entry) => !(entry.code === 'missing-job-branch' && job.branchProvisioned === false))
    anomalies.push(...health.map((entry) => ({ issueNumber, ...entry })))
    jobs.push({
      issueNumber,
      jobId: job.jobId || null,
      title: job.title || null,
      state: job.state || null,
      project: job.project || null,
      workerKind: job.workerKind || null,
      branch: job.branch || null,
      resourceSet: job.resourceSet || [],
      dependencies: job.dependencies || [],
      prNumber: job.prNumber || relatedPrs.find((pr) => pr.state === 'OPEN')?.number || null,
      anomalies: health,
    })
  }

  const managedBranches = branches.filter((branch) => parseManagedBranch(branch.name))
  const orphanBranches = findOrphanManagedBranches(managedBranches, jobsByIssue)
  const orphanPrs = findOrphanManagedPrs(prs, jobsByIssue)
  const duplicateResourceClaims = findDuplicateActiveResourceClaims(jobsByIssue)
  anomalies.push(...orphanBranches, ...orphanPrs, ...duplicateResourceClaims)

  const report = {
    ok: anomalies.length === 0,
    repo,
    generatedAt: new Date().toISOString(),
    counts: {
      openJobs: jobs.length,
      managedBranches: managedBranches.length,
      anomalies: anomalies.length,
      malformedMarkers: malformedMarkers.length,
      orphanPrs: orphanPrs.length,
      duplicateResourceClaims: duplicateResourceClaims.length,
    },
    stateCounts,
    resourceOwners,
    jobs: jobs.sort((a, b) => a.issueNumber - b.issueNumber),
    orphanBranches,
    orphanPrs,
    duplicateResourceClaims,
    anomalies,
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(strict && anomalies.length ? 1 : 0)
} catch (error) {
  console.error(JSON.stringify({ ok: false, repo, error: error.message }, null, 2))
  process.exit(1)
}
