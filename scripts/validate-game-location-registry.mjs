import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const v2 = JSON.parse(fs.readFileSync(path.join(root, 'data/game-registry-v2.json'), 'utf8'));
const loc = JSON.parse(fs.readFileSync(path.join(root, 'data/game-location-registry.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/game-source-map.json'), 'utf8'));
const deployRaw = JSON.parse(fs.readFileSync(path.join(root, 'site/deployment/public-apps.json'), 'utf8'));
const deploy = Array.isArray(deployRaw) ? deployRaw : (deployRaw.apps || deployRaw.games || []);

const errors = [];
if (v2.schemaVersion !== 2) errors.push('game-registry-v2 schemaVersion must be 2');
if (loc.schemaVersion !== 1) errors.push('legacy game-location-registry schemaVersion must remain 1 during migration');

const v2ById = new Map((v2.games || []).map((game) => [game.id, game]));
const legacyById = new Map();
const aliases = new Map();

for (const game of loc.games || []) {
  if (!game?.id) {
    errors.push('legacy location entry missing id');
    continue;
  }
  if (legacyById.has(game.id)) errors.push(`duplicate legacy game id: ${game.id}`);
  legacyById.set(game.id, game);

  const canonical = v2ById.get(game.id);
  if (!canonical) {
    errors.push(`legacy location game missing from v2: ${game.id}`);
    continue;
  }

  if (game.production?.repository !== canonical.production?.repository) {
    errors.push(`${game.id}: legacy production repository drift: ${game.production?.repository} vs v2 ${canonical.production?.repository}`);
  }
  if (game.publicRoute !== canonical.publicRoute) {
    errors.push(`${game.id}: legacy public route drift: ${game.publicRoute} vs v2 ${canonical.publicRoute}`);
  }

  for (const alias of game.aliases || []) {
    const key = String(alias).trim().toLowerCase();
    if (!key) continue;
    if (aliases.has(key) && aliases.get(key) !== game.id) {
      errors.push(`legacy alias collision: ${key} -> ${aliases.get(key)} / ${game.id}`);
    }
    aliases.set(key, game.id);
    if (loc.aliasMap?.[key] !== game.id) {
      errors.push(`legacy aliasMap mismatch: ${key} -> ${loc.aliasMap?.[key]} expected ${game.id}`);
    }
    if (v2.aliasMap?.[key] !== game.id) {
      errors.push(`v2 aliasMap mismatch for legacy alias: ${key} -> ${v2.aliasMap?.[key]} expected ${game.id}`);
    }
  }
}

for (const game of v2.games || []) {
  if (!legacyById.has(game.id)) errors.push(`v2 game missing from legacy location compatibility registry: ${game.id}`);
}

for (const [alias, target] of Object.entries(loc.aliasMap || {})) {
  if (v2.aliasMap?.[alias] !== target) {
    errors.push(`legacy aliasMap drift from v2: ${alias} -> ${target}, v2 has ${v2.aliasMap?.[alias]}`);
  }
}

for (const game of source.games || []) {
  const canonical = v2ById.get(game.id);
  if (!canonical) {
    errors.push(`source-map game missing from v2: ${game.id}`);
    continue;
  }
  if (canonical.production?.repository !== game.canonical?.repository) {
    errors.push(`${game.id}: source-map repository drift: ${game.canonical?.repository} vs v2 ${canonical.production?.repository}`);
  }
  if (canonical.publicRoute !== game.route) {
    errors.push(`${game.id}: source-map public route drift: ${game.route} vs v2 ${canonical.publicRoute}`);
  }
}

const deployGameIds = new Set(
  deploy
    .filter((entry) => String(entry.route || '').startsWith('/games/'))
    .map((entry) => entry.id || entry.gameId)
    .filter(Boolean)
);

for (const id of deployGameIds) {
  if (!v2ById.has(id) && id !== 'cannabis-fleet-battle') {
    errors.push(`deployment game missing from v2: ${id}`);
  }
}

const burn = v2ById.get('protect-the-plants');
if (burn?.production?.sourcePaths?.[0] !== 'games/protect-the-plants') {
  errors.push('Burn Buds production source must resolve to games/protect-the-plants');
}
if (v2.aliasMap?.['burn buds'] !== 'protect-the-plants') {
  errors.push('Burn Buds alias must resolve to protect-the-plants in v2');
}
if (v2.aliasMap?.['seed man'] !== 'seed-man-platformer' || v2.aliasMap?.['seed ascent'] !== 'seed-ascent') {
  errors.push('Seed Man and Seed Ascent identity mapping is invalid in v2');
}

if (errors.length) {
  console.error('Game location compatibility validation failed:\n- ' + errors.join('\n- '));
  process.exitCode = 1;
} else {
  console.log(`Game location compatibility valid against v2: ${v2ById.size} games, ${Object.keys(v2.aliasMap || {}).length} v2 aliases.`);
}
