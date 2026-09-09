import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v2.js';
const LEGACY_PATH = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const REQUIRED_RUNTIME = 'seed-man-combat-browser-v2';

if (!fs.existsSync(combatPath)) throw new Error(`Missing canonical Seed Man combat runtime: ${combatPath}`);

const source = fs.readFileSync(combatPath, 'utf8');
if (!source.includes(REQUIRED_RUNTIME)) throw new Error(`Canonical Seed Man combat marker is missing: ${REQUIRED_RUNTIME}`);
if (source.includes('seed-man-combat-browser-v1')) throw new Error('Legacy v1 combat marker leaked into canonical v2 runtime.');

// Impact effects are owned by the canonical v20 combat renderer. This helper is
// intentionally validation-only so an old preparation step cannot rewrite the
// generated public runtime after the production build.
console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  combatFile: combatPath,
  requiredRuntime: REQUIRED_RUNTIME,
  legacyMutationDisabled: true,
  legacyPath: LEGACY_PATH
}, null, 2));
