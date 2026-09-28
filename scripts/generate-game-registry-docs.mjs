import fs from 'node:fs';

function esc(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function sortedGames(registry) {
  return [...(registry.games || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

function sortedConcepts(registry) {
  return [...(registry.concepts || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

function locSummary(locations = []) {
  if (!locations.length) return '—';
  return locations.map((loc) => {
    const paths = Array.isArray(loc.paths) && loc.paths.length ? ` (${loc.paths.join(', ')})` : '';
    return `${loc.role || 'alternate'}: ${loc.repository || 'unknown'}${paths}`;
  }).join('<br>');
}

export function renderGameRegistryDoc(registry) {
  const games = sortedGames(registry);
  const concepts = sortedConcepts(registry);
  const lines = [
    '# DTF Game Registry v2',
    '',
    '> GENERATED FROM data/game-registry-v2.json. Do not manually edit this file; run `npm run games:registry:docs`.',
    '',
    `Updated: ${registry.updated || 'unknown'}`,
    '',
    `Tracked games: **${games.length}**  `,
    `Concept bank: **${concepts.length}**`,
    '',
    '## Canonical game portfolio',
    '',
    '| Game | ID | Canonical repo | Public route | Release state | Integration owner | Next milestone |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];

  for (const game of games) {
    lines.push(`| ${esc(game.title)} | \`${esc(game.id)}\` | ${esc(game.production?.repository || '—')} | ${esc(game.publicRoute || '—')} | \`${esc(game.release?.status || '—')}\` | ${esc(game.production?.integrationRepository || '—')} | ${esc(game.release?.nextMilestone || '—')} |`);
  }

  lines.push('', '## Alternate and deprecated locations', '');
  for (const game of games) {
    const dev = locSummary(game.developmentLocations);
    const dep = locSummary(game.deprecatedLocations);
    if (dev === '—' && dep === '—') continue;
    lines.push(`### ${game.title}`, '', `- Development/migration: ${dev}`, `- Deprecated/experimental: ${dep}`, '');
  }

  lines.push('## Concept bank', '');
  if (!concepts.length) lines.push('_No concepts are currently registered._', '');
  else {
    for (const concept of concepts) lines.push(`- **${concept.title}** — \`${concept.id}\` — ${concept.release?.status || 'concept'}`);
    lines.push('');
  }

  lines.push('## Working rule', '', 'Resolve the game through `data/game-registry-v2.json` before code, asset, deployment, migration, or release work. The registry describes current reality and must be updated in the same change when ownership, architecture, route, or status intentionally changes.', '');
  return lines.join('\n');
}

export function renderCanonicalSourceMap(registry) {
  const games = sortedGames(registry);
  const lines = [
    '# DTFSeeds Game Canonical Source Map',
    '',
    '> GENERATED FROM data/game-registry-v2.json. Compatibility view only; the JSON registry is authoritative.',
    '',
    `Updated: ${registry.updated || 'unknown'}`,
    '',
    '| Game | Public route | Canonical repository | Canonical source | Integration / packaged owner | Release state |',
    '| --- | --- | --- | --- | --- | --- |'
  ];

  for (const game of games) {
    const source = (game.production?.sourcePaths || []).join(', ') || '—';
    const integrationParts = [
      game.production?.integrationRepository,
      game.production?.integrationPath,
      game.production?.integrationMode
    ].filter(Boolean);
    lines.push(`| ${esc(game.title)} | ${esc(game.publicRoute || '—')} | ${esc(game.production?.repository || '—')} | ${esc(source)} | ${esc(integrationParts.join(' · ') || '—')} | \`${esc(game.release?.status || '—')}\` |`);
  }

  lines.push('', '## Rule', '', 'Use `data/game-registry-v2.json` plus the game entry’s `gameDesignDoc` before editing. This file exists for humans and legacy tooling that expect the historical source-map document name.', '');
  return lines.join('\n');
}

export function renderScopeMaster(registry) {
  const games = sortedGames(registry);
  const concepts = sortedConcepts(registry);
  const publicGames = games.filter((game) => ['public-unverified', 'public-verified'].includes(game.release?.status));
  const nonPublic = games.filter((game) => !['public-unverified', 'public-verified', 'archived', 'superseded', 'compatibility-only'].includes(game.release?.status));

  const lines = [
    '# DTFSeeds Game Scope Master',
    '',
    '> GENERATED FROM data/game-registry-v2.json. Do not manually maintain portfolio counts or status here.',
    '',
    '## Standing development policy',
    '',
    '`docs/GAME_DEVELOPMENT_FREEDOM.md` remains the standing policy. The registry describes current reality but does not lock future architecture, ownership, routes, engines, or repository placement.',
    '',
    '## Public playable catalog',
    '',
    `The current controlled catalog contains **${publicGames.length} public-route games**. A public route is not the same as exact live verification; use each entry’s release state and verification evidence.`,
    ''
  ];

  publicGames.forEach((game, index) => {
    lines.push(`${index + 1}. **${game.title}** — \`${game.id}\` — ${game.publicRoute || 'no route'} — \`${game.release.status}\``);
  });

  lines.push('', '## Built prototype not yet promoted', '');
  if (!nonPublic.length) lines.push('_No active non-public games._');
  else {
    for (const game of nonPublic) {
      lines.push(`- **${game.title}** — \`${game.release?.status || 'unknown'}\` — ${game.release?.nextMilestone || 'No milestone recorded.'}`);
    }
  }

  lines.push('', '## Future concept bank', '');
  if (!concepts.length) lines.push('_No concepts are currently registered._');
  else {
    for (const concept of concepts) lines.push(`- **${concept.title}** — \`${concept.id}\``);
  }

  lines.push('', '## Release integrity', '', 'Only `public-verified` may be described as confirmed live from the registry. `public-unverified` means the game is part of the controlled public-route catalog but exact current URL/revision/timestamp evidence has not yet been recorded in v2. Builds, packages, and deployments remain separate evidence levels.', '');
  return lines.join('\n');
}

const OUTPUTS = [
  ['docs/GAME_REGISTRY_V2.md', renderGameRegistryDoc],
  ['docs/GAME_CANONICAL_SOURCE_MAP.md', renderCanonicalSourceMap],
  ['docs/DTF_GAME_SCOPE_MASTER.md', renderScopeMaster],
];

export function generate({ check = false, registryPath = 'data/game-registry-v2.json' } = {}) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  let ok = true;

  for (const [outputPath, renderer] of OUTPUTS) {
    const expected = renderer(registry) + '\n';
    if (check) {
      const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
      if (actual !== expected) {
        console.error(`${outputPath} is stale; run npm run games:registry:docs`);
        ok = false;
      } else {
        console.log(`${outputPath} is current`);
      }
    } else {
      fs.writeFileSync(outputPath, expected);
      console.log(`generated ${outputPath}`);
    }
  }

  return ok;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const ok = generate({ check: process.argv.includes('--check') });
  if (!ok) process.exit(1);
}
