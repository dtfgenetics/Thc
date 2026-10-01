#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { assessOverlap, candidateSupersession, classifyPaths } from './core.mjs'

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options }).trim()
  } catch {
    return ''
  }
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'])
if (!repoRoot) {
  console.error('Run this command from inside the Thc repository or a linked worktree.')
  process.exit(2)
}
if (!capture('gh', ['--version'], { cwd: repoRoot })) {
  console.error('studio doctor requires GitHub CLI so it can inspect active pull requests.')
  process.exit(2)
}

const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const limit = Math.max(1, Math.min(200, Number.parseInt(args.limit || '100', 10) || 100))
const config = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))

const listedText = capture('gh', [
  'pr', 'list', '--state', 'open', '--base', 'main', '--limit', String(limit),
  '--json', 'number,title,headRefName,headRefOid,mergeable,isDraft,url,updatedAt'
], { cwd: repoRoot })
const listed = listedText ? JSON.parse(listedText) : []

const managedBranchPattern = /^(work|project|multi)\//;
const canonicalToolMirrorPrefixes = [
  'site/public-route-patch/atlas/',
  'site/public-route-patch/terpene-atlas/',
  'site/public-route-patch/tools/',
  'site/public-route-patch/ph-meter/',
  'site/public-route-patch/tds-meter/',
  'site/public-route-patch/vpd-chart/',
  'site/public-route-patch/ppfd-chart/',
  'site/public-route-patch/environment-control/',
  'site/public-route-patch/dew-point/',
  'site/public-route-patch/water-quality-lab/',
  'site/public-route-patch/root-zone-temperature/',
  'site/public-route-patch/dryback-lab/',
  'site/public-route-patch/fertigation-lab/',
  'site/public-route-patch/grow-planner/',
  'site/public-route-patch/photoperiod-planner/',
  'site/public-route-patch/plant-growth-tracker/',
  'site/public-route-patch/dry-cure-lab/',
  'site/public-route-patch/breeder-pedigree/',
  'site/public-route-patch/co2-ventilation/',
  'site/public-route-patch/dilution-calculator/',
  'site/public-route-patch/ipm-scout/',
  'site/public-route-patch/substrate-calculator/',
  'site/public-route-patch/unit-converter/'
];

function directCanonicalMirrorFiles(pr) {
  if (pr.headRefName.startsWith('sync/tools-')) return [];
  return (pr.files || []).filter((file) => canonicalToolMirrorPrefixes.some((prefix) => file.startsWith(prefix)));
}

const prs = []

for (const pr of listed) {
  const detailText = capture('gh', ['pr', 'view', String(pr.number), '--json', 'files,body'], { cwd: repoRoot })
  if (!detailText) continue
  const detail = JSON.parse(detailText)
  const files = (detail.files || []).map((file) => file.path).filter(Boolean)
  const classification = classifyPaths(config, files)
  prs.push({
    ...pr,
    files,
    resources: classification.resources,
    unmatchedFiles: classification.unmatched,
  })
}

function bump(map, key, prNumber) {
  if (!map.has(key)) map.set(key, new Set())
  map.get(key).add(prNumber)
}

const fileUse = new Map()
const resourceUse = new Map()
const targetUse = new Map()
for (const pr of prs) {
  for (const file of pr.files) bump(fileUse, file, pr.number)
  for (const resource of pr.resources) {
    bump(resourceUse, resource.id, pr.number)
    for (const target of resource.productionTargets || []) bump(targetUse, target, pr.number)
  }
}

function hotspots(map) {
  return [...map.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([id, owners]) => ({ id, prs: [...owners].sort((a, b) => a - b), count: owners.size }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}

const pairConflicts = []
const supersessionCandidates = []
for (let i = 0; i < prs.length; i += 1) {
  for (let j = i + 1; j < prs.length; j += 1) {
    const left = prs[i]
    const right = prs[j]
    const overlap = assessOverlap(
      { files: left.files, resources: left.resources },
      { files: right.files, resources: right.resources, mergeable: right.mergeable },
    )
    if (overlap.developmentRisk !== 'green' || overlap.serializeProduction) {
      pairConflicts.push({
        prs: [left.number, right.number],
        titles: [left.title, right.title],
        risk: overlap.developmentRisk,
        fileOverlap: overlap.fileOverlap,
        resourceOverlap: overlap.resourceOverlap,
        productionOverlap: overlap.productionOverlap,
        serializeProduction: overlap.serializeProduction,
      })
    }
    if (candidateSupersession(
      { files: left.files, resources: left.resources },
      { files: right.files, resources: right.resources, mergeable: right.mergeable },
    )) {
      supersessionCandidates.push({
        prs: [left.number, right.number],
        reason: 'Overlapping resource and one changed-file set contains the other. Confirm intent/history before retiring either PR.',
      })
    }
  }
}

const conflictingPrs = prs.filter((pr) => pr.mergeable === 'CONFLICTING')
const legacyBranchPrs = prs.filter((pr) => !managedBranchPattern.test(pr.headRefName))
const directToolMirrorAuthoring = prs
  .map((pr) => ({ pr: pr.number, title: pr.title, branch: pr.headRefName, files: directCanonicalMirrorFiles(pr), url: pr.url }))
  .filter((item) => item.files.length > 0)
const unknownResources = prs.filter((pr) => pr.unmatchedFiles.length).map((pr) => ({
  pr: pr.number,
  files: pr.unmatchedFiles,
}))

const report = {
  ok: true,
  generatedAt: new Date().toISOString(),
  openPrsInspected: prs.length,
  summary: {
    githubConflictingPrs: conflictingPrs.length,
    pairOverlaps: pairConflicts.length,
    hotFiles: hotspots(fileUse).length,
    hotResources: hotspots(resourceUse).length,
    sharedProductionTargets: hotspots(targetUse).length,
    supersessionCandidates: supersessionCandidates.length,
    prsWithUnclassifiedFiles: unknownResources.length,
    legacyBranchPrs: legacyBranchPrs.length,
    directToolMirrorAuthoringPrs: directToolMirrorAuthoring.length,
  },
  legacyBranchPrs: legacyBranchPrs.map((pr) => ({ number: pr.number, title: pr.title, branch: pr.headRefName, url: pr.url })),
  directToolMirrorAuthoring,
  githubConflictingPrs: conflictingPrs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    branch: pr.headRefName,
    url: pr.url,
  })),
  hotFiles: hotspots(fileUse),
  hotResources: hotspots(resourceUse),
  sharedProductionTargets: hotspots(targetUse),
  pairOverlaps: pairConflicts,
  supersessionCandidates,
  unclassified: unknownResources,
  policy: {
    development: 'Do not globally block. Green and yellow work continues in parallel.',
    conflicts: 'Repair red/current-main conflicts at integration, preserving both compatible changes.',
    production: 'Serialize only PRs that share an exact production target.',
    supersession: 'Advisory until unique work and intent are checked.',
    branchHygiene: 'New work should use work/<project>/<task>/<session>; legacy branches require intentional review before integration.',
    toolMirrors: 'Focused cultivation-tool mirrors in Thc must normally come from sync/tools-* integration branches after canonical authoring in dtfgenetics/Tools.',
  },
}

console.log(JSON.stringify(report, null, 2))
