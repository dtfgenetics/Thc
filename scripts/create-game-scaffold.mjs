import fs from 'node:fs';
import path from 'node:path';

const [, , rawId, ...titleParts] = process.argv;
const title = titleParts.join(' ').trim();
const id = (rawId || '').trim();

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run games:new -- <kebab-case-id> "Game Title"');
  console.error('Example: npm run games:new -- terp-trails "Terp Trails"');
  process.exit(1);
}

if (!title) {
  console.error('A human-readable game title is required.');
  process.exit(1);
}

const root = process.cwd();
const gameDir = path.join(root, 'games', id);
if (fs.existsSync(gameDir)) {
  console.error(`Refusing to overwrite existing game directory: games/${id}`);
  process.exit(1);
}

fs.mkdirSync(path.join(gameDir, 'src'), { recursive: true });
fs.mkdirSync(path.join(gameDir, 'data'), { recursive: true });
fs.mkdirSync(path.join(gameDir, 'test'), { recursive: true });
fs.mkdirSync(path.join(gameDir, 'docs'), { recursive: true });

const manifest = {
  schemaVersion: 1,
  id,
  title,
  type: 'browser-game',
  status: 'prototype',
  route: null,
  productionTarget: 'https://dtfseeds.com',
  implementation: {
    source: `games/${id}/src`,
    data: `games/${id}/data`,
    tests: `games/${id}/test`,
    publicRoute: null
  },
  releaseGates: {
    rulesTested: false,
    browserTested: false,
    mobileTested: false,
    accessibilityReviewed: false,
    originalArtCleared: false,
    deploymentRegistered: false
  }
};

const readme = `# ${title}\n\nProduction target: **dtfseeds.com**\n\nThis directory is the canonical working source for the game while it is owned by \`dtfgenetics/Thc\`. The scaffold is intentionally **not public and not deployable** until the release gates are completed.\n\n## Structure\n\n- \`src/\` — game logic and browser/runtime code\n- \`data/\` — machine-readable game data\n- \`test/\` — deterministic/unit/integration tests\n- \`docs/\` — rules, architecture, QA notes, and handoff documentation\n- \`game.json\` — local game status and implementation contract\n\n## Before publishing\n\n1. Add the project to \`data/project-registry.json\` if it is not already registered.\n2. Build and test the game from this canonical source.\n3. Add the public runtime under \`site/public-route-patch/games/${id}/\` only when it is visitor-ready.\n4. Add or update the deployment entry in \`site/deployment/public-apps.json\`.\n5. Run \`npm run games:preflight\` and the game-specific tests.\n6. Open a PR; do not bypass verification for production game changes.\n\nSee \`docs/GAME_DEVELOPMENT_WORKFLOW.md\` for the full dtfseeds.com workflow.\n`;

fs.writeFileSync(path.join(gameDir, 'game.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(gameDir, 'README.md'), readme);
fs.writeFileSync(path.join(gameDir, 'src', '.gitkeep'), '');
fs.writeFileSync(path.join(gameDir, 'data', '.gitkeep'), '');
fs.writeFileSync(path.join(gameDir, 'test', '.gitkeep'), '');
fs.writeFileSync(path.join(gameDir, 'docs', '.gitkeep'), '');

console.log(`Created games/${id}/`);
console.log('The game is NOT registered for deployment. Build and verify it first.');
console.log('Next: run npm run games:status, update data/project-registry.json, then run npm run games:preflight.');
