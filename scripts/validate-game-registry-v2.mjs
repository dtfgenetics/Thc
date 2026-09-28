import fs from 'node:fs';

const ACTIVE_STATUSES = new Set([
  'design','prototype','vertical-slice','playable-local','release-candidate','packaged','public-unverified','public-verified'
]);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateGameRegistry(registry) {
  const issues = [];
  if (registry?.schemaVersion !== 2) issues.push('schemaVersion must be 2');
  if (!registry || !Array.isArray(registry.games)) return [...issues, 'games must be an array'];
  if (!registry.aliasMap || typeof registry.aliasMap !== 'object') issues.push('aliasMap must be an object');
  if (!Array.isArray(registry.concepts)) issues.push('concepts must be an array');

  const ids = new Set();
  const routes = new Map();
  const aliasOwners = new Map();

  for (const game of registry.games) {
    const label = game?.title || game?.id || '<unknown game>';
    if (!nonEmpty(game?.id)) {
      issues.push(`${label}: missing canonical id`);
      continue;
    }
    if (ids.has(game.id)) issues.push(`${label}: duplicate canonical id ${game.id}`);
    ids.add(game.id);

    if (!nonEmpty(game?.title)) issues.push(`${game.id}: missing title`);
    if (!nonEmpty(game?.goal?.summary)) issues.push(`${label}: missing product goal summary`);
    if (!nonEmpty(game?.production?.repository)) issues.push(`${label}: missing production repository`);
    if (!Array.isArray(game?.production?.sourcePaths) || game.production.sourcePaths.length === 0) {
      issues.push(`${label}: missing production sourcePaths`);
    }
    if (!nonEmpty(game?.architecture?.renderer)) issues.push(`${label}: missing architecture.renderer`);
    if (!nonEmpty(game?.architecture?.simulationOwner)) issues.push(`${label}: missing architecture.simulationOwner`);
    if (!nonEmpty(game?.verification?.buildCommand)) issues.push(`${label}: missing verification.buildCommand`);
    if (!Array.isArray(game?.verification?.testCommands) || game.verification.testCommands.length === 0) {
      issues.push(`${label}: missing verification.testCommands`);
    }
    if (!nonEmpty(game?.release?.status)) issues.push(`${label}: missing release.status`);
    if (!nonEmpty(game?.release?.nextMilestone)) issues.push(`${label}: missing release.nextMilestone`);

    if (game.publicRoute && ACTIVE_STATUSES.has(game.release?.status)) {
      if (routes.has(game.publicRoute)) {
        issues.push(`${label}: duplicate public route ${game.publicRoute} also used by ${routes.get(game.publicRoute)}`);
      } else {
        routes.set(game.publicRoute, game.id);
      }
    }

    for (const alias of game.aliases || []) {
      const key = String(alias).trim().toLowerCase();
      if (!key) continue;
      if (aliasOwners.has(key) && aliasOwners.get(key) !== game.id) {
        issues.push(`${label}: alias "${key}" is also owned by ${aliasOwners.get(key)}`);
      } else {
        aliasOwners.set(key, game.id);
      }
    }

    if (game.release?.status === 'public-verified') {
      if (!nonEmpty(game.release.lastVerifiedUrl) || !nonEmpty(game.release.lastVerifiedRevision) || !nonEmpty(game.release.lastVerifiedAt)) {
        issues.push(`${label}: public-verified requires exact lastVerifiedUrl, lastVerifiedRevision, and lastVerifiedAt`);
      }
    }

    for (const loc of game.deprecatedLocations || []) {
      if (loc?.releasable === true) issues.push(`${label}: deprecated location cannot be releasable`);
    }
  }

  for (const [rawAlias, target] of Object.entries(registry.aliasMap || {})) {
    const alias = rawAlias.trim().toLowerCase();
    if (!ids.has(target)) issues.push(`alias "${rawAlias}" points to missing game ${target}`);
    const owner = aliasOwners.get(alias);
    if (owner && owner !== target) issues.push(`alias "${rawAlias}" maps to ${target} but game aliases assign it to ${owner}`);
  }

  if (registry.aliasMap?.['burn buds'] !== 'protect-the-plants') {
    issues.push('Burn Buds alias must resolve to protect-the-plants');
  }
  if (registry.aliasMap?.['cannabis battleship'] && registry.aliasMap['cannabis battleship'] !== 'protect-the-plants') {
    issues.push('Cannabis Battleship compatibility alias must resolve to protect-the-plants');
  }
  if (registry.aliasMap?.['seed man'] !== 'seed-man-platformer') {
    issues.push('Seed Man alias must resolve to seed-man-platformer');
  }
  if (registry.aliasMap?.['seed ascent'] !== 'seed-ascent') {
    issues.push('Seed Ascent alias must resolve to seed-ascent');
  }
  if (registry.aliasMap?.['seed man'] === registry.aliasMap?.['seed ascent']) {
    issues.push('Seed Man and Seed Ascent must remain distinct game identities');
  }

  for (const concept of registry.concepts || []) {
    if (concept?.release?.status !== 'concept') {
      issues.push(`concept ${concept?.title || concept?.id || '<unknown>'} must use release.status "concept"`);
    }
  }

  return issues;
}

export function loadRegistry(path = 'data/game-registry-v2.json') {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const registry = loadRegistry();
  const issues = validateGameRegistry(registry);
  if (issues.length) {
    console.error(`game registry v2 validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log(`game registry v2 valid: ${registry.games.length} games, ${registry.concepts.length} concepts`);
}
