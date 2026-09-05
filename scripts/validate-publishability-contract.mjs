#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { classifyPaths } from './studio/core.mjs'

const resourceConfig = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))
const releaseConfig = JSON.parse(readFileSync('site/deployment/release-lanes.json', 'utf8'))

const publishableRoots = [
  'site/wordpress/pages',
  'site/wordpress/education',
  'site/wordpress/genetics',
  'site/wordpress/products',
  'site/wordpress/shop',
  'site/wordpress/assets/infographics',
  'site/wordpress/assets/genetics',
  'site/public-route-patch/games',
  'site/public-route-patch/learn',
  'site/public-route-patch/growlens',
  'site/public-route-patch/thc-grow-doc',
  'site/public-route-patch/atlas',
  'site/design-system',
  'data/public-navigation.json',
  'site/deployment/public-apps.json',
  'apps/growlens-web',
  'apps/high-land-web',
]

const legacyDirectMainWriters = new Set([
  'scripts/publish-wordpress-image-backlog.sh',
  'scripts/publish-wordpress-infographics-canonical.sh',
  '.github/workflows/core-gaps-v6-route-repair.yml',
  '.github/workflows/finish-harvest-wordpress-publish-v2.yml',
  '.github/workflows/import-harvest-replacements-v1.yml',
  '.github/workflows/import-harvest-uploaded-assets.yml',
  '.github/workflows/publish-harvest-images-now.yml',
  '.github/workflows/publish-harvest-outdoor-v6-final-repair.yml',
  '.github/workflows/repair-canonical-infographics.yml',
  '.github/workflows/repair-sprout-run-production.yml',
  '.github/workflows/wordpress-core-gap-poster-production.yml',
])

const directMainMentionOnly = new Set([
  '.github/workflows/wordpress-production-topology-ci.yml',
])

function walk(root) {
  if (!existsSync(root)) return []
  const out = []
  const visit = (path) => {
    const stat = statSync(path)
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) visit(join(path, entry))
      return
    }
    out.push(relative('.', path).replaceAll('\\', '/'))
  }
  visit(root)
  return out
}

function unique(values) {
  return [...new Set(values)].sort()
}

function releaseLanesFor(path) {
  const lanes = []
  if ((releaseConfig.fullReleasePaths || []).includes(path)) lanes.push('full')
  for (const [id, lane] of Object.entries(releaseConfig.lanes || {})) {
    if ((lane.prefixes || []).some((prefix) => path.startsWith(prefix))) lanes.push(id)
  }
  return unique(lanes)
}

const publishableFiles = unique([
  ...publishableRoots.flatMap(walk),
  ...(releaseConfig.fullReleasePaths || []).filter((path) => existsSync(path)),
])
const classified = classifyPaths(resourceConfig, publishableFiles)
const resourceByPath = new Map()
for (const resource of classified.resources) {
  for (const path of resource.files || []) {
    const entries = resourceByPath.get(path) || []
    entries.push(resource)
    resourceByPath.set(path, entries)
  }
}

const unclassifiedPublishable = []
const missingProductionTarget = []
const missingReleaseLane = []
for (const path of publishableFiles) {
  const resources = resourceByPath.get(path) || []
  if (!resources.length) {
    unclassifiedPublishable.push(path)
    continue
  }
  if (!resources.some((resource) => (resource.productionTargets || []).length > 0)) {
    missingProductionTarget.push(path)
  }
  if (!releaseLanesFor(path).length) missingReleaseLane.push(path)
}

const expectedOwners = new Map([
  ['site/wordpress/pages/home.html', 'route:/'],
  ['site/wordpress/pages/about.html', 'route:/about/'],
  ['site/wordpress/pages/blog.html', 'route:/blog/'],
  ['site/wordpress/pages/community.html', 'route:/community/'],
  ['site/wordpress/pages/contact.html', 'route:/contact/'],
  ['site/wordpress/pages/gallery.html', 'route:/gallery/'],
  ['site/wordpress/pages/learn.html', 'route:/learn/'],
  ['site/wordpress/pages/seeds.html', 'route:/seeds/'],
  ['site/wordpress/pages/shop.html', 'route:/shop/'],
  ['site/public-route-patch/games/index.html', 'route:/games/'],
  ['site/deployment/public-apps.json', 'route:/games/'],
  ['data/public-navigation.json', 'shared:site-shell'],
  ['site/deployment/release-lanes.json', 'shared:release-control'],
])
const ownershipErrors = []
for (const [path, expectedTarget] of expectedOwners) {
  if (!existsSync(path)) {
    ownershipErrors.push(`${path}: canonical file missing`)
    continue
  }
  const one = classifyPaths(resourceConfig, [path])
  const targets = unique(one.resources.flatMap((resource) => resource.productionTargets || []))
  if (!targets.includes(expectedTarget)) {
    ownershipErrors.push(`${path}: expected ${expectedTarget}, got ${targets.join(', ') || 'no production target'}`)
  }
}

const mutationSearchRoots = ['.github/workflows', 'scripts']
const mutationCandidates = unique(mutationSearchRoots.flatMap(walk).filter((path) => /\.(?:ya?ml|sh|mjs|js|cjs|py)$/.test(path)))
const directMainPattern = /git\s+push[^\n\r]*?(?:HEAD\s*:\s*main|HEAD:main|refs\/heads\/main|origin\s+main(?:\s|$))/g
const detectedDirectMain = []
for (const path of mutationCandidates) {
  const text = readFileSync(path, 'utf8')
  if (directMainPattern.test(text)) detectedDirectMain.push(path)
  directMainPattern.lastIndex = 0
}

const unexpectedDirectMain = detectedDirectMain.filter((path) => !legacyDirectMainWriters.has(path) && !directMainMentionOnly.has(path))
const retiredButStillAllowlisted = [...legacyDirectMainWriters].filter((path) => !detectedDirectMain.includes(path))

const integrationSource = readFileSync('scripts/studio/integrate.mjs', 'utf8')
const generatedIntegrationSource = readFileSync('scripts/studio/integrate-generated-change.mjs', 'utf8')
const releasePlannerSource = readFileSync('scripts/plan-dtfseeds-release.mjs', 'utf8')
const gatewaySource = readFileSync('.github/workflows/dtfseeds-production-gateway.yml', 'utf8')
const educationSource = readFileSync('.github/workflows/deploy-thc-learning-center-expansion-v1.yml', 'utf8')

const contractErrors = []
if (!integrationSource.includes("gh', ['workflow', 'run', 'dtfseeds-production-gateway.yml'")) {
  contractErrors.push('ordinary Studio integration does not explicitly dispatch the cumulative production gateway')
}
if (!generatedIntegrationSource.includes('dtfseeds-production-gateway.yml')) {
  contractErrors.push('generated-change integration does not dispatch the cumulative production gateway')
}
if (!gatewaySource.includes('auto')) {
  contractErrors.push('production gateway no longer exposes the automatic cumulative release mode')
}
if (!educationSource.includes('GITHUB_STEP_SUMMARY') || !educationSource.includes('continue-on-error: true')) {
  contractErrors.push('Education release reporting can still veto a verified production result')
}
if (!(releaseConfig.lanes?.education?.prefixes || []).includes('site/wordpress/education/')) {
  contractErrors.push('canonical site/wordpress/education source is not routed through the Education release lane')
}
const harvestOutdoorPrefixes = releaseConfig.lanes?.harvestOutdoor?.prefixes || []
for (const requiredPath of [
  'site/wordpress/education/harvest-postharvest-v6.json',
  'site/wordpress/education/outdoor-v6.json',
  'site/wordpress/education/topic-literature.json',
  'scripts/enhance-wordpress-outdoor-quantification-v1.mjs',
  '.github/workflows/wordpress-harvest-outdoor-v6-production.yml',
]) {
  if (!harvestOutdoorPrefixes.includes(requiredPath)) {
    contractErrors.push(`Harvest / Outdoor canonical source is not routed through its release lane: ${requiredPath}`)
  }
}
if (!(releaseConfig.fullReleasePaths || []).includes('.github/workflows/wordpress-harvest-outdoor-v6-production.yml')) {
  contractErrors.push('Harvest / Outdoor canonical publisher is not a full-release control-plane path')
}
if (!releasePlannerSource.includes('harvest_outdoor=${lanes.harvestOutdoor}')) {
  contractErrors.push('release planner does not expose the Harvest / Outdoor lane to the gateway')
}
if (!gatewaySource.includes('needs.plan.outputs.harvest_outdoor') || !gatewaySource.includes('wordpress-harvest-outdoor-v6-production.yml')) {
  contractErrors.push('production gateway does not publish and enforce the Harvest / Outdoor canonical lane')
}
if (!gatewaySource.includes('data-dtf-harvest-postharvest-v6="true"') || !gatewaySource.includes('data-dtf-outdoor-v6="true"')) {
  contractErrors.push('production gateway does not independently verify Harvest / Outdoor visitor markers')
}
for (const lane of ['publicSuite', 'wordpress']) {
  const prefixes = releaseConfig.lanes?.[lane]?.prefixes || []
  if (!prefixes.includes('site/design-system/') || !prefixes.includes('data/public-navigation.json')) {
    contractErrors.push(`shared shell is not routed through ${lane}`)
  }
}

const errors = [
  ...unclassifiedPublishable.map((path) => `unclassified publishable file: ${path}`),
  ...missingProductionTarget.map((path) => `publishable file has no production target: ${path}`),
  ...missingReleaseLane.map((path) => `publishable file has no central release lane: ${path}`),
  ...ownershipErrors.map((value) => `route ownership: ${value}`),
  ...unexpectedDirectMain.map((path) => `new direct-main writer is forbidden: ${path}`),
  ...retiredButStillAllowlisted.map((path) => `remove retired direct-main writer from legacy allowlist: ${path}`),
  ...contractErrors,
]

const report = {
  ok: errors.length === 0,
  publishableFileCount: publishableFiles.length,
  classifiedResourceCount: classified.resources.length,
  unclassifiedPublishable,
  missingProductionTarget,
  missingReleaseLane,
  directMain: {
    detected: detectedDirectMain,
    legacyAllowed: detectedDirectMain.filter((path) => legacyDirectMainWriters.has(path)),
    mentionOnly: detectedDirectMain.filter((path) => directMainMentionOnly.has(path)),
    unexpected: unexpectedDirectMain,
    staleAllowlist: retiredButStillAllowlisted,
  },
  ownershipErrors,
  contractErrors,
  errors,
}

console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
