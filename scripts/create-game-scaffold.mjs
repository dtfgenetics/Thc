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

const dirs = [
  'src/simulation',
  'src/render',
  'src/ui',
  'src/assets',
  'data',
  'test',
  'docs'
];
for (const rel of dirs) fs.mkdirSync(path.join(gameDir, rel), { recursive: true });

const verificationCommand = `node games/${id}/test/smoke.test.mjs`;
const manifest = {
  schemaVersion: 2,
  architecture: 'dtf-browser-game-v1',
  id,
  title,
  type: 'browser-game',
  status: 'prototype',
  route: null,
  productionTarget: 'https://dtfseeds.com',
  implementation: {
    entry: `games/${id}/src/main.mjs`,
    simulation: `games/${id}/src/simulation`,
    renderer: `games/${id}/src/render`,
    ui: `games/${id}/src/ui`,
    input: `games/${id}/src/input.mjs`,
    assets: `games/${id}/src/assets/manifest.json`,
    data: `games/${id}/data`,
    tests: `games/${id}/test`,
    publicRoute: null
  },
  verification: {
    command: verificationCommand,
    workspacePreflight: 'npm run games:preflight'
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

const readme = `# ${title}\n\nProduction target: **dtfseeds.com**\n\nThis directory is the canonical working source for the game while it is owned by \`dtfgenetics/Thc\`. The scaffold is intentionally **not public and not deployable** until the release gates are completed.\n\n## Structure\n\n- \`src/simulation/\` — serializable gameplay state and deterministic rules\n- \`src/render/\` — canvas/WebGL/DOM rendering adapters; never the source of truth for rules\n- \`src/ui/\` — menus, HUD, dialogs, lobby/settings surfaces\n- \`src/input.mjs\` — keyboard/touch/controller mapping into named game actions\n- \`src/assets/manifest.json\` — stable asset keys grouped by domain\n- \`data/\` — machine-readable game content and balance/configuration data\n- \`test/\` — deterministic/unit/integration tests\n- \`docs/\` — rules, architecture, QA notes, and handoff documentation\n- \`game.json\` — local game status and implementation contract\n\n## First commands\n\nRun the starter smoke test:\n\n\`\`\`bash\n${verificationCommand}\n\`\`\`\n\nThen continue normal workspace verification:\n\n\`\`\`bash\nnpm run games:preflight\n\`\`\`\n\n## Before publishing\n\n1. Add the project to \`data/project-registry.json\` if it is not already registered.\n2. Keep simulation state separate from rendering/UI and make important rules deterministic/testable.\n3. Build and test the game from this canonical source.\n4. Add the public runtime under \`site/public-route-patch/games/${id}/\` only when it is visitor-ready.\n5. Add or update the deployment entry in \`site/deployment/public-apps.json\`.\n6. Replace the starter smoke command with the smallest reliable production verification command when the real engine exists.\n7. Run \`npm run games:preflight\` and the game-specific tests.\n8. Open a PR; do not bypass verification for production game changes.\n\nSee \`docs/GAME_ARCHITECTURE_STANDARD.md\` and \`docs/GAME_DEVELOPMENT_WORKFLOW.md\`.\n`;

const architecture = `# ${title} architecture\n\nArchitecture contract: **dtf-browser-game-v1**\n\n## State ownership\n\nThe simulation layer owns rules and serializable state. Rendering, UI, audio, networking, and browser objects stay outside saveable game state.\n\n## Input\n\nMap physical inputs to named actions in \`src/input.mjs\`. Simulation code should consume actions instead of browser key names.\n\n## Assets\n\nUse stable keys from \`src/assets/manifest.json\`. Avoid hard-coding asset filenames throughout gameplay code.\n\n## Renderer and UI\n\nUse \`src/render/\` for the playfield renderer and \`src/ui/\` for text-heavy controls, menus, settings, dialogs, and accessibility-sensitive surfaces.\n\n## Multiplayer, if added\n\nThe server must own hidden information, legal actions, scoring, and authoritative state transitions. The browser sends intents and renders approved state.\n`;

const stateModule = `export function createInitialState() {\n  return {\n    phase: 'ready',\n    tick: 0,\n    score: 0\n  };\n}\n\nexport function reduceGameState(state, action) {\n  if (!state || typeof state !== 'object') throw new TypeError('state must be an object');\n  if (!action || typeof action.type !== 'string') return state;\n\n  switch (action.type) {\n    case 'start':\n      return { ...state, phase: 'playing' };\n    case 'tick':\n      return state.phase === 'playing' ? { ...state, tick: state.tick + 1 } : state;\n    case 'reset':\n      return createInitialState();\n    default:\n      return state;\n  }\n}\n`;

const inputModule = `export const DEFAULT_BINDINGS = Object.freeze({\n  ArrowLeft: 'move-left',\n  ArrowRight: 'move-right',\n  ArrowUp: 'move-up',\n  ArrowDown: 'move-down',\n  Enter: 'confirm',\n  Escape: 'cancel',\n  ' ': 'ability-1',\n  KeyP: 'pause'\n});\n\nexport function actionForKey(key, bindings = DEFAULT_BINDINGS) {\n  return bindings[key] || null;\n}\n`;

const mainModule = `import { createInitialState, reduceGameState } from './simulation/state.mjs';\n\nexport function createGameRuntime(initialState = createInitialState()) {\n  let state = initialState;\n  const subscribers = new Set();\n\n  return {\n    getState() {\n      return state;\n    },\n    dispatch(action) {\n      const next = reduceGameState(state, action);\n      if (next !== state) {\n        state = next;\n        for (const subscriber of subscribers) subscriber(state, action);\n      }\n      return state;\n    },\n    subscribe(subscriber) {\n      subscribers.add(subscriber);\n      return () => subscribers.delete(subscriber);\n    }\n  };\n}\n`;

const smokeTest = `import assert from 'node:assert/strict';\nimport { createGameRuntime } from '../src/main.mjs';\nimport { actionForKey } from '../src/input.mjs';\n\nconst runtime = createGameRuntime();\nassert.deepEqual(runtime.getState(), { phase: 'ready', tick: 0, score: 0 });\nruntime.dispatch({ type: 'start' });\nruntime.dispatch({ type: 'tick' });\nassert.equal(runtime.getState().phase, 'playing');\nassert.equal(runtime.getState().tick, 1);\nassert.equal(actionForKey('ArrowLeft'), 'move-left');\nassert.equal(actionForKey('UnknownKey'), null);\nconsole.log('${id} scaffold smoke test passed');\n`;

const assetManifest = {
  schemaVersion: 1,
  groups: {
    characters: {},
    environment: {},
    ui: {},
    audio: {},
    fx: {}
  }
};

fs.writeFileSync(path.join(gameDir, 'game.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(gameDir, 'README.md'), readme);
fs.writeFileSync(path.join(gameDir, 'docs', 'ARCHITECTURE.md'), architecture);
fs.writeFileSync(path.join(gameDir, 'src', 'simulation', 'state.mjs'), stateModule);
fs.writeFileSync(path.join(gameDir, 'src', 'input.mjs'), inputModule);
fs.writeFileSync(path.join(gameDir, 'src', 'main.mjs'), mainModule);
fs.writeFileSync(path.join(gameDir, 'src', 'assets', 'manifest.json'), `${JSON.stringify(assetManifest, null, 2)}\n`);
fs.writeFileSync(path.join(gameDir, 'src', 'render', 'README.md'), '# Renderer\n\nRender the playfield from simulation state. Do not store authoritative gameplay rules here.\n');
fs.writeFileSync(path.join(gameDir, 'src', 'ui', 'README.md'), '# UI\n\nMenus, HUD, settings, dialogs, lobby controls, and accessibility-sensitive browser UI belong here.\n');
fs.writeFileSync(path.join(gameDir, 'data', '.gitkeep'), '');
fs.writeFileSync(path.join(gameDir, 'test', 'smoke.test.mjs'), smokeTest);

console.log(`Created games/${id}/ with architecture dtf-browser-game-v1`);
console.log('The game is NOT registered for deployment. Build and verify it first.');
console.log(`Starter verification: ${verificationCommand}`);
console.log('Next: run npm run games:status, update data/project-registry.json, then run npm run games:preflight.');
