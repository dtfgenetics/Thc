import fs from 'node:fs';

function esc(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function locSummary(locations = []) {
  if (!locations.length) return '—';
  return locations.map((loc) => {
    const paths = Array.isArray(loc.paths) && loc.paths.length ? ` (${loc.paths.join(', ')})` : '';
    return `${loc.role || 'alternate'}: ${loc.repository || 'unknown'}${paths}`;
  }).join('<br>');
}

export function renderGameRegistryDoc(registry) {
  const games = [...(registry.games || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const concepts = [...(registry.concepts || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));

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
    lines.push(
      `| ${esc(game.title)} | \`${esc(game.id)}\` | ${esc(game.production?.repository || '—')} | ${esc(game.publicRoute || '—')} | \`${esc(game.release?.status || '—')}\` | ${esc(game.production?.integrationRepository || '—')} | ${esc(game.release?.nextMilestone || '—')} |`
    );
  }

  lines.push('', '## Alternate and deprecated locations', '');
  for (const game of games) {
    const dev = locSummary(game.developmentLocations);
    const dep = locSummary(game.deprecatedLocations);
    if (dev === '—' && dep === '—') continue;
    lines.push(`### ${game.title}`, '', `- Development/migration: ${dev}`, `- Deprecated/experimental: ${dep}`, '');
  }

  lines.push('## Concept bank', '');
  if (!concepts.length) {
    lines.push('_No concepts are currently registered._', '');
  } else {
    for (const concept of concepts) lines.push(`- **${concept.title}** — \`${concept.id}\` — ${concept.release?.status || 'concept'}`);
    lines.push('');
  }

  lines.push('## Working rule', '', 'Resolve the game through `data/game-registry-v2.json` before code, asset, deployment, migration, or release work. The registry describes current reality and must be updated in the same change when ownership, architecture, route, or status intentionally changes.', '');
  return lines.join('\n');
}

export function generate({ check = false, registryPath = 'data/game-registry-v2.json', outputPath = 'docs/GAME_REGISTRY_V2.md' } = {}) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const expected = renderGameRegistryDoc(registry) + '\n';
  if (check) {
    const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (actual !== expected) {
      console.error(`${outputPath} is stale; run npm run games:registry:docs`);
      return false;
    }
    console.log(`${outputPath} is current`);
    return true;
  }
  fs.writeFileSync(outputPath, expected);
  console.log(`generated ${outputPath}`);
  return true;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const ok = generate({ check: process.argv.includes('--check') });
  if (!ok) process.exit(1);
}
