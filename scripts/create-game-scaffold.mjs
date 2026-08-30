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
  uiStandard: 'dtf-game-ui-v1',
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
    uiTheme: `games/${id}/src/ui/game-ui.css`,
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
    deploymentRegistered: false,
    visualPolishReviewed: false,
    responsiveHudTested: false
  }
};

const readme = `# ${title}\n\nProduction target: **dtfseeds.com**\n\nThis directory is the canonical working source for the game while it is owned by \`dtfgenetics/Thc\`. The scaffold is intentionally **not public and not deployable** until the release gates are completed.\n\n## Structure\n\n- \`src/simulation/\` — serializable gameplay state and deterministic rules\n- \`src/render/\` — canvas/WebGL/DOM rendering adapters; never the source of truth for rules\n- \`src/ui/\` — menus, HUD, dialogs, lobby/settings surfaces plus the DTF responsive UI starter\n- \`src/ui/game-ui.css\` — design tokens and playfield-first responsive UI primitives\n- \`src/input.mjs\` — keyboard/touch/controller mapping into named game actions\n- \`src/assets/manifest.json\` — stable asset keys grouped by domain\n- \`data/\` — machine-readable game content and balance/configuration data\n- \`test/\` — deterministic/unit/integration tests\n- \`docs/\` — rules, architecture, QA notes, and handoff documentation\n- \`game.json\` — local game status and implementation contract\n\n## First commands\n\nRun the starter smoke test:\n\n\`\`\`bash\n${verificationCommand}\n\`\`\`\n\nThen continue normal workspace verification:\n\n\`\`\`bash\nnpm run games:preflight\n\`\`\`\n\n## UI quality bar\n\nThe scaffold includes a minimal DTF game UI system so the project starts from a responsive, playfield-first interface instead of an empty prototype shell. Keep the center of the playfield clear, make one primary action obvious, move secondary information behind compact surfaces, and test desktop + mobile before release.\n\nRead \`docs/GAME_UI_STANDARD.md\` before replacing the starter theme. The game can have a completely different art direction, but it must preserve the hierarchy, mobile, accessibility, and visual-QA contract.\n\n## Before publishing\n\n1. Add the project to \`data/project-registry.json\` if it is not already registered.\n2. Keep simulation state separate from rendering/UI and make important rules deterministic/testable.\n3. Establish a game-specific visual direction using the UI standard instead of leaving the starter theme unchanged.\n4. Build and test the game from this canonical source.\n5. Add the public runtime under \`site/public-route-patch/games/${id}/\` only when it is visitor-ready.\n6. Add or update the deployment entry in \`site/deployment/public-apps.json\`.\n7. Replace the starter smoke command with the smallest reliable production verification command when the real engine exists.\n8. Verify desktop, mobile portrait, mobile landscape/short-height behavior, primary touch targets, and document overflow.\n9. Run \`npm run games:preflight\` and the game-specific tests.\n10. Open a PR; do not bypass verification for production game changes.\n\nSee \`docs/GAME_ARCHITECTURE_STANDARD.md\`, \`docs/GAME_UI_STANDARD.md\`, and \`docs/GAME_DEVELOPMENT_WORKFLOW.md\`.\n`;

const architecture = `# ${title} architecture\n\nArchitecture contract: **dtf-browser-game-v1**\n\nUI contract: **dtf-game-ui-v1**\n\n## State ownership\n\nThe simulation layer owns rules and serializable state. Rendering, UI, audio, networking, and browser objects stay outside saveable game state.\n\n## Input\n\nMap physical inputs to named actions in \`src/input.mjs\`. Simulation code should consume actions instead of browser key names.\n\n## Assets\n\nUse stable keys from \`src/assets/manifest.json\`. Avoid hard-coding asset filenames throughout gameplay code.\n\n## Renderer and UI\n\nUse \`src/render/\` for the playfield renderer and \`src/ui/\` for text-heavy controls, menus, settings, dialogs, and accessibility-sensitive surfaces. Start from \`src/ui/game-ui.css\`, then replace its colors/material language with a game-specific visual direction while preserving the playfield-first hierarchy and responsive contract from \`docs/GAME_UI_STANDARD.md\`.\n\n## Multiplayer, if added\n\nThe server must own hidden information, legal actions, scoring, and authoritative state transitions. The browser sends intents and renders approved state.\n`;

const stateModule = `export function createInitialState() {\n  return {\n    phase: 'ready',\n    tick: 0,\n    score: 0\n  };\n}\n\nexport function reduceGameState(state, action) {\n  if (!state || typeof state !== 'object') throw new TypeError('state must be an object');\n  if (!action || typeof action.type !== 'string') return state;\n\n  switch (action.type) {\n    case 'start':\n      return { ...state, phase: 'playing' };\n    case 'tick':\n      return state.phase === 'playing' ? { ...state, tick: state.tick + 1 } : state;\n    case 'reset':\n      return createInitialState();\n    default:\n      return state;\n  }\n}\n`;

const inputModule = `export const DEFAULT_BINDINGS = Object.freeze({\n  ArrowLeft: 'move-left',\n  ArrowRight: 'move-right',\n  ArrowUp: 'move-up',\n  ArrowDown: 'move-down',\n  Enter: 'confirm',\n  Escape: 'cancel',\n  ' ': 'ability-1',\n  KeyP: 'pause'\n});\n\nexport function actionForKey(key, bindings = DEFAULT_BINDINGS) {\n  return bindings[key] || null;\n}\n`;

const mainModule = `import { createInitialState, reduceGameState } from './simulation/state.mjs';\n\nexport function createGameRuntime(initialState = createInitialState()) {\n  let state = initialState;\n  const subscribers = new Set();\n\n  return {\n    getState() {\n      return state;\n    },\n    dispatch(action) {\n      const next = reduceGameState(state, action);\n      if (next !== state) {\n        state = next;\n        for (const subscriber of subscribers) subscriber(state, action);\n      }\n      return state;\n    },\n    subscribe(subscriber) {\n      subscribers.add(subscriber);\n      return () => subscribers.delete(subscriber);\n    }\n  };\n}\n`;

const uiTheme = `:root {\n  --game-bg: #07110c;\n  --game-surface: rgba(12, 28, 19, 0.92);\n  --game-surface-elevated: rgba(18, 39, 27, 0.98);\n  --game-text: #f5f7ef;\n  --game-muted: #a8b6aa;\n  --game-border: rgba(232, 255, 216, 0.14);\n  --game-accent: #c8ff62;\n  --game-success: #82ed9a;\n  --game-warning: #ffd869;\n  --game-danger: #ff7c91;\n  --game-radius-sm: 12px;\n  --game-radius-md: 18px;\n  --game-radius-lg: 26px;\n  --game-touch: 44px;\n  --game-motion-fast: 160ms;\n}\n\n* { box-sizing: border-box; }\n\nbody {\n  margin: 0;\n  min-width: 320px;\n  min-height: 100vh;\n  color: var(--game-text);\n  background: var(--game-bg);\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n\n.dtf-game-shell {\n  width: min(100%, 1600px);\n  min-height: 100svh;\n  margin-inline: auto;\n  padding: clamp(0.6rem, 1.2vw, 1.1rem);\n}\n\n.dtf-game-hud {\n  display: flex;\n  align-items: center;\n  gap: 0.55rem;\n  min-width: 0;\n  overflow-x: auto;\n}\n\n.dtf-game-layout {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(280px, 330px);\n  gap: clamp(0.65rem, 1vw, 1rem);\n  align-items: start;\n}\n\n.dtf-game-playfield {\n  min-width: 0;\n  min-height: 0;\n  overflow: hidden;\n  border: 1px solid var(--game-border);\n  border-radius: var(--game-radius-lg);\n  background: #020604;\n}\n\n.dtf-game-rail {\n  display: grid;\n  gap: 0.6rem;\n  position: sticky;\n  top: 0.7rem;\n  padding: 0.7rem;\n  border: 1px solid var(--game-border);\n  border-radius: var(--game-radius-lg);\n  background: var(--game-surface);\n}\n\n.dtf-game-actions {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0.5rem;\n}\n\n.dtf-game-actions [data-primary-action] {\n  grid-column: 1 / -1;\n}\n\n.dtf-game-button {\n  min-height: var(--game-touch);\n  border: 1px solid var(--game-border);\n  border-radius: var(--game-radius-sm);\n  padding: 0.7rem 0.9rem;\n  color: var(--game-text);\n  background: rgba(255, 255, 255, 0.07);\n  font: inherit;\n  font-weight: 800;\n  cursor: pointer;\n  transition: transform var(--game-motion-fast) ease, background var(--game-motion-fast) ease;\n}\n\n.dtf-game-button[data-primary-action] {\n  min-height: 58px;\n  color: #132008;\n  background: var(--game-accent);\n}\n\n.dtf-game-button:focus-visible {\n  outline: 3px solid color-mix(in srgb, var(--game-accent) 70%, transparent);\n  outline-offset: 3px;\n}\n\n.dtf-game-secondary {\n  border: 1px solid var(--game-border);\n  border-radius: var(--game-radius-md);\n  background: rgba(255, 255, 255, 0.04);\n}\n\n@media (max-width: 980px) {\n  .dtf-game-layout {\n    grid-template-columns: 1fr;\n  }\n\n  .dtf-game-rail {\n    position: static;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .dtf-game-actions {\n    grid-column: 1 / -1;\n  }\n}\n\n@media (max-width: 640px) {\n  .dtf-game-shell {\n    padding:\n      0.45rem\n      max(0.45rem, env(safe-area-inset-right))\n      max(0.65rem, env(safe-area-inset-bottom))\n      max(0.45rem, env(safe-area-inset-left));\n  }\n\n  .dtf-game-rail {\n    grid-template-columns: 1fr;\n    padding: 0.5rem;\n    border-radius: var(--game-radius-md);\n  }\n\n  .dtf-game-actions {\n    position: sticky;\n    bottom: max(0.3rem, env(safe-area-inset-bottom));\n    z-index: 20;\n    padding: 0.45rem;\n    border: 1px solid var(--game-border);\n    border-radius: var(--game-radius-md);\n    background: var(--game-surface-elevated);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .dtf-game-button {\n    transition: none;\n  }\n}\n`;

const uiReadme = `# UI\n\nUI contract: **dtf-game-ui-v1**\n\nUse this folder for menus, HUD, dialogs, lobby/settings surfaces, and accessibility-sensitive browser UI.\n\nThe starter \`game-ui.css\` is intentionally neutral. Keep its structural ideas but replace the colors/material language with the game's own art direction.\n\n## Required hierarchy\n\n- playfield first;\n- one compact primary HUD;\n- one obvious primary action;\n- secondary information behind drawers/modals/collapsible surfaces;\n- mobile-safe controls and no document-level horizontal overflow.\n\n## Starter classes\n\n- \`.dtf-game-shell\` — responsive page shell\n- \`.dtf-game-hud\` — compact persistent status/player rail\n- \`.dtf-game-layout\` — playfield + compact rail layout\n- \`.dtf-game-playfield\` — canvas/WebGL/board container\n- \`.dtf-game-rail\` — contextual controls/status\n- \`.dtf-game-actions\` — primary/secondary action group\n- \`.dtf-game-button\` — touch-safe control\n- \`[data-primary-action]\` — visually dominant current action\n- \`.dtf-game-secondary\` — de-emphasized secondary surface\n\nRead \`docs/GAME_UI_STANDARD.md\` before shipping or replacing these primitives.\n`;

const smokeTest = `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createGameRuntime } from '../src/main.mjs';\nimport { actionForKey } from '../src/input.mjs';\n\nconst runtime = createGameRuntime();\nassert.deepEqual(runtime.getState(), { phase: 'ready', tick: 0, score: 0 });\nruntime.dispatch({ type: 'start' });\nruntime.dispatch({ type: 'tick' });\nassert.equal(runtime.getState().phase, 'playing');\nassert.equal(runtime.getState().tick, 1);\nassert.equal(actionForKey('ArrowLeft'), 'move-left');\nassert.equal(actionForKey('UnknownKey'), null);\nconst uiCss = fs.readFileSync(new URL('../src/ui/game-ui.css', import.meta.url), 'utf8');\nassert.match(uiCss, /--game-accent:/);\nassert.match(uiCss, /--game-touch:\s*44px/);\nassert.match(uiCss, /\.dtf-game-playfield/);\nassert.match(uiCss, /env\(safe-area-inset-bottom\)/);\nconsole.log('${id} scaffold smoke test passed');\n`;

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
fs.writeFileSync(path.join(gameDir, 'src', 'ui', 'README.md'), uiReadme);
fs.writeFileSync(path.join(gameDir, 'src', 'ui', 'game-ui.css'), uiTheme);
fs.writeFileSync(path.join(gameDir, 'data', '.gitkeep'), '');
fs.writeFileSync(path.join(gameDir, 'test', 'smoke.test.mjs'), smokeTest);

console.log(`Created games/${id}/ with architecture dtf-browser-game-v1 and UI contract dtf-game-ui-v1`);
console.log('The game is NOT registered for deployment. Build and verify it first.');
console.log(`Starter verification: ${verificationCommand}`);
console.log('Next: establish the game-specific visual direction, run npm run games:status, update data/project-registry.json, then run npm run games:preflight.');