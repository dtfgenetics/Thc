import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v2.js';
const REQUIRED_RUNTIME = 'seed-man-combat-browser-v2';
const REQUIRED_EFFECTS = ['burn', 'chain', 'freeze'];

if (!fs.existsSync(combatPath)) throw new Error(`Missing canonical Seed Man combat runtime: ${combatPath}`);

const source = fs.readFileSync(combatPath, 'utf8');
if (!source.includes(REQUIRED_RUNTIME)) throw new Error(`Canonical Seed Man combat marker is missing: ${REQUIRED_RUNTIME}`);
for (const effect of REQUIRED_EFFECTS) {
  if (!source.includes(effect)) throw new Error(`Canonical Seed Man combat runtime is missing elemental effect: ${effect}`);
}
if (source.includes('seed-man-combat-browser-v1')) throw new Error('Legacy v1 combat marker leaked into canonical v2 runtime.');

// Elemental VFX belong to the canonical v20 runtime. Do not patch generated
// browser code in-place; validate the generated contract instead.
console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  combatFile: combatPath,
  requiredRuntime: REQUIRED_RUNTIME,
  effects: REQUIRED_EFFECTS,
  legacyMutationDisabled: true
}, null, 2));
