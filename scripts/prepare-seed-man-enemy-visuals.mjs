import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v2.js';
const enemyRuntimePath = 'site/public-route-patch/games/seed-man-platformer/v20-enemy-runtime.js';
const REQUIRED_COMBAT = 'seed-man-combat-browser-v2';
const REQUIRED_ENEMIES = 'seed-man-v20-enemy-runtime-v3';

for (const file of [combatPath, enemyRuntimePath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing canonical Seed Man runtime: ${file}`);
}

const combat = fs.readFileSync(combatPath, 'utf8');
const enemies = fs.readFileSync(enemyRuntimePath, 'utf8');
if (!combat.includes(REQUIRED_COMBAT)) throw new Error(`Canonical combat marker missing: ${REQUIRED_COMBAT}`);
if (!enemies.includes(REQUIRED_ENEMIES)) throw new Error(`Canonical enemy marker missing: ${REQUIRED_ENEMIES}`);
if (combat.includes('seed-man-combat-browser-v1')) throw new Error('Legacy v1 combat marker leaked into canonical v2 runtime.');
for (const retiredAlias of ['solar-flare','static-haze','frost-resin']) if (enemies.includes(retiredAlias)) throw new Error(`Retired phenotype alias leaked into enemy runtime: ${retiredAlias}`);
for (const canonical of ["phenotype:'fire'","phenotype:'electric'","phenotype:'ice'"]) if (!enemies.includes(canonical)) throw new Error(`Canonical phenotype ID missing from enemy runtime: ${canonical}`);

console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  combatFile: combatPath,
  enemyRuntimeFile: enemyRuntimePath,
  requiredCombat: REQUIRED_COMBAT,
  requiredEnemyRuntime: REQUIRED_ENEMIES,
  canonicalPhenotypes: ['plant','fire','electric','ice'],
  legacyMutationDisabled: true
}, null, 2));
