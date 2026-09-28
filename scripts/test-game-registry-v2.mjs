import assert from 'node:assert/strict';
import { validateGameRegistry } from './validate-game-registry-v2.mjs';

function baseRegistry() {
  return {
    schemaVersion: 2,
    aliasMap: {
      'burn buds': 'protect-the-plants',
      'seed man': 'seed-man-platformer',
      'seed ascent': 'seed-ascent'
    },
    concepts: [],
    games: [
      {
        id: 'protect-the-plants',
        title: 'Burn Buds',
        aliases: ['burn buds'],
        publicRoute: '/games/protect-the-plants/',
        goal: { summary: 'Two-player hidden-fleet strategy game.', primaryVerbs: ['place','target','eliminate'] },
        gameDesignDoc: 'games/protect-the-plants/README.md',
        systems: ['placement','turns','reconnect'],
        quality: { targetExperience: 'Reliable hidden-fleet play.', knownGaps: [] },
        production: { repository: 'dtfgenetics/Thc', sourcePaths: ['games/protect-the-plants'] },
        architecture: { renderer: 'dom', simulationOwner: 'canonical-engine', uiLayer: 'DOM', networkModel: 'server-authoritative' },
        verification: { buildCommand: 'node test.mjs', testCommands: ['node test.mjs'] },
        release: { status: 'release-candidate', blockers: [], nextMilestone: 'Verify public route.' },
        developmentLocations: [],
        deprecatedLocations: []
      },
      {
        id: 'seed-man-platformer',
        title: 'Seed Man: Grow. Fight. Restore.',
        aliases: ['seed man'],
        publicRoute: '/games/seed-man-platformer/',
        goal: { summary: 'Platforming campaign.', primaryVerbs: ['run','jump','fight'] },
        gameDesignDoc: 'games/seed-man-platformer/README.md',
        systems: ['campaign','combat','bosses'],
        quality: { targetExperience: 'Responsive platforming.', knownGaps: [] },
        production: { repository: 'dtfgenetics/Thc', sourcePaths: ['games/seed-man-platformer'] },
        architecture: { renderer: 'canvas', simulationOwner: 'canonical-engine', uiLayer: 'DOM HUD', networkModel: 'local' },
        verification: { buildCommand: 'npm run verify:seed-man', testCommands: ['npm run verify:seed-man'] },
        release: { status: 'release-candidate', blockers: [], nextMilestone: 'Verify public route.' },
        developmentLocations: [],
        deprecatedLocations: []
      },
      {
        id: 'seed-ascent',
        title: 'Seed Man: Seed Ascent',
        aliases: ['seed ascent'],
        publicRoute: '/games/seed-ascent/',
        goal: { summary: 'Separate Seed Man ascent game.', primaryVerbs: ['climb','jump','survive'] },
        gameDesignDoc: 'repo:docs/games/seed-ascent.md',
        systems: ['stages','powers','enemies'],
        quality: { targetExperience: 'Responsive ascent platforming.', knownGaps: [] },
        production: { repository: 'dtfgenetics/Dtf420', sourcePaths: ['app/games/seed-ascent', 'public/seed-ascent'] },
        architecture: { renderer: 'canvas', simulationOwner: 'seed-ascent-engine', uiLayer: 'runtime HUD', networkModel: 'local' },
        verification: { buildCommand: 'npm run build', testCommands: ['npm run verify:seed-ascent'] },
        release: { status: 'prototype', blockers: [], nextMilestone: 'Establish production ownership.' },
        developmentLocations: [],
        deprecatedLocations: []
      }
    ]
  };
}

{
  const issues = validateGameRegistry(baseRegistry());
  assert.deepEqual(issues, [], issues.join('\n'));
}

{
  const registry = baseRegistry();
  registry.aliasMap['burn buds'] = 'seed-ascent';
  const issues = validateGameRegistry(registry);
  assert.ok(issues.some((x) => x.includes('Burn Buds') || x.includes('burn buds')));
}

{
  const registry = baseRegistry();
  registry.games[2].publicRoute = '/games/seed-man-platformer/';
  const issues = validateGameRegistry(registry);
  assert.ok(issues.some((x) => x.includes('duplicate public route')));
}

{
  const registry = baseRegistry();
  registry.games[0].release = {
    status: 'public-verified',
    blockers: [],
    nextMilestone: 'Maintain',
    lastVerifiedUrl: null,
    lastVerifiedRevision: null,
    lastVerifiedAt: null
  };
  const issues = validateGameRegistry(registry);
  assert.ok(issues.some((x) => x.includes('public-verified')));
}

{
  const registry = baseRegistry();
  registry.aliasMap['seed man'] = 'seed-ascent';
  const issues = validateGameRegistry(registry);
  assert.ok(issues.some((x) => x.includes('Seed Man') || x.includes('seed man')));
}

{
  const registry = baseRegistry();
  registry.concepts = [{ id: 'future-game', title: 'Future Game', release: { status: 'public-verified' } }];
  const issues = validateGameRegistry(registry);
  assert.ok(issues.some((x) => x.includes('concept')));
}

{
  const registry = baseRegistry();
  registry.games[0].systems = [];
  registry.games[0].gameDesignDoc = null;
  registry.games[0].goal.primaryVerbs = [];
  registry.games[0].architecture.uiLayer = '';
  registry.games[0].architecture.networkModel = '';
  registry.games[0].quality = { targetExperience: '', knownGaps: 'not-an-array' };
  const issues = validateGameRegistry(registry);
  assert.ok(issues.some((x) => x.includes('gameDesignDoc')));
  assert.ok(issues.some((x) => x.includes('systems')));
  assert.ok(issues.some((x) => x.includes('primaryVerbs')));
  assert.ok(issues.some((x) => x.includes('architecture.uiLayer')));
  assert.ok(issues.some((x) => x.includes('architecture.networkModel')));
  assert.ok(issues.some((x) => x.includes('quality.targetExperience')));
  assert.ok(issues.some((x) => x.includes('quality.knownGaps')));
}

console.log('game-registry-v2 tests passed');
