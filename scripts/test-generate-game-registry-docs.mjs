import assert from 'node:assert/strict';
import { renderGameRegistryDoc, renderCanonicalSourceMap, renderScopeMaster } from './generate-game-registry-docs.mjs';

const registry = {
  schemaVersion: 2,
  updated: '2026-09-28',
  games: [
    {
      id: 'z-game',
      title: 'Z Game',
      publicRoute: '/games/z/',
      production: { repository: 'dtfgenetics/Z', integrationRepository: 'dtfgenetics/Thc' },
      release: { status: 'prototype', nextMilestone: 'Finish prototype.' },
      developmentLocations: [{ repository: 'dtfgenetics/Dtf420', role: 'migration-runtime', paths: ['app/games/z'] }],
      deprecatedLocations: []
    },
    {
      id: 'a-game',
      title: 'A Game',
      publicRoute: '/games/a/',
      production: { repository: 'dtfgenetics/A', integrationRepository: 'dtfgenetics/Thc' },
      release: { status: 'public-unverified', nextMilestone: 'Verify route.' },
      developmentLocations: [],
      deprecatedLocations: [{ repository: 'dtfgenetics/Old', role: 'archive', paths: ['old/a'] }]
    }
  ],
  concepts: [{ id: 'future', title: 'Future', release: { status: 'concept' } }]
};

const doc = renderGameRegistryDoc(registry);
assert.ok(doc.includes('GENERATED FROM data/game-registry-v2.json'));
assert.ok(doc.indexOf('| A Game |') < doc.indexOf('| Z Game |'), 'games must sort by title');
assert.ok(doc.includes('dtfgenetics/A'));
assert.ok(doc.includes('/games/a/'));
assert.ok(doc.includes('public-unverified'));
assert.ok(doc.includes('Verify route.'));
assert.ok(doc.includes('migration-runtime'));
assert.ok(doc.includes('dtfgenetics/Old'));
assert.ok(doc.includes('Future'));
const sourceMap = renderCanonicalSourceMap(registry);
assert.ok(sourceMap.includes('GENERATED FROM data/game-registry-v2.json'));
assert.ok(sourceMap.includes('Canonical repository'));
assert.ok(sourceMap.includes('dtfgenetics/A'));
assert.ok(sourceMap.includes('/games/a/'));

const scope = renderScopeMaster(registry);
assert.ok(scope.includes('## Public playable catalog'));
assert.ok(scope.includes('## Built prototype not yet promoted'));
assert.ok(scope.includes('## Future concept bank'));
assert.ok(scope.includes('A Game'));
assert.ok(scope.includes('Future'));

console.log('game-registry-doc generator tests passed');
