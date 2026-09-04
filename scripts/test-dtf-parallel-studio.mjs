#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  assessOverlap,
  candidateSupersession,
  classifyPaths,
  makeWorkBranch,
  parseWorkBranch,
} from './studio/core.mjs'

const config = JSON.parse(readFileSync('data/studio-resources.json', 'utf8'))

const branch = makeWorkBranch('High Land', 'Mobile UI', 'session-123')
assert.equal(branch, 'work/high-land/mobile-ui/session-123')
assert.deepEqual(parseWorkBranch(branch), {
  mode: 'work',
  projectId: 'high-land',
  task: 'mobile-ui',
  sessionId: 'session-123',
})
assert.equal(parseWorkBranch('project/high-land/mobile-ui'), null)

const classified = classifyPaths(config, [
  'apps/high-land-web/src/App.jsx',
  'site/public-route-patch/games/index.html',
  'site/design-system/dtf-genetics-owner-v1.css',
  'apps/growlens-web/src/main.tsx',
])
const ids = new Set(classified.resources.map((resource) => resource.id))
assert(ids.has('game.high-land'))
assert(ids.has('page.game-hub'))
assert(ids.has('platform.site-shell'))
assert(ids.has('content.genetics'))
assert(ids.has('app.growlens'))
assert(!ids.has('game.growlens'))

const highLand = classifyPaths(config, ['apps/high-land-web/src/App.jsx']).resources
const sameGameDifferentFile = classifyPaths(config, ['games/high-land/data/cards.json']).resources
const resourceOnly = assessOverlap(
  { files: ['apps/high-land-web/src/App.jsx'], resources: highLand },
  { files: ['games/high-land/data/cards.json'], resources: sameGameDifferentFile, mergeable: 'MERGEABLE' },
)
assert.equal(resourceOnly.developmentRisk, 'yellow')
assert.equal(resourceOnly.serializeProduction, true)
assert.deepEqual(resourceOnly.resourceOverlap, ['game.high-land'])
assert.deepEqual(resourceOnly.productionOverlap, ['route:/games/high-land/'])

const exactConflict = assessOverlap(
  { files: ['site/public-route-patch/games/index.html'], resources: classifyPaths(config, ['site/public-route-patch/games/index.html']).resources },
  { files: ['site/public-route-patch/games/index.html'], resources: classifyPaths(config, ['site/public-route-patch/games/index.html']).resources, mergeable: 'CONFLICTING' },
)
assert.equal(exactConflict.developmentRisk, 'red')
assert.deepEqual(exactConflict.fileOverlap, ['site/public-route-patch/games/index.html'])

assert.equal(candidateSupersession(
  { files: ['a', 'b'], resources: ['x'] },
  { files: ['a', 'b', 'c'], resources: ['x'], mergeable: 'CONFLICTING' },
), true)
assert.equal(candidateSupersession(
  { files: ['a'], resources: ['x'] },
  { files: ['b'], resources: ['x'], mergeable: 'MERGEABLE' },
), false)

function laneCheck(branchName, files) {
  return execFileSync(process.execPath, [
    'scripts/project-lane-check.mjs',
    `--branch=${branchName}`,
    `--files=${files.join(',')}`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

const allowed = JSON.parse(laneCheck('work/high-land/mobile-ui/s1', ['apps/high-land-web/src/App.jsx']))
assert.equal(allowed.ok, true)
assert.equal(allowed.mode, 'work')
assert.equal(allowed.projectId, 'high-land')
assert.equal(allowed.sessionId, 's1')

assert.throws(() => laneCheck('work/high-land/mobile-ui/s1', ['apps/growlens-web/src/main.tsx']))

const platform = JSON.parse(laneCheck('work/platform/studio/s2', ['apps/growlens-web/src/main.tsx', 'site/wordpress/pages/about.html']))
assert.equal(platform.ok, true)
assert.equal(platform.unrestricted, true)

console.log('DTF Parallel Studio regression tests passed.')
