import assert from 'node:assert/strict';
import { renderGameRegistryDoc } from './generate-game-registry-docs.mjs';

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
console.log('game-registry-doc generator tests passed');
