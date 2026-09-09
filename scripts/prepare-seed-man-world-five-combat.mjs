import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v2.js';
const enemyRuntimePath = 'site/public-route-patch/games/seed-man-platformer/v20-enemy-runtime.js';
const campaignPath = 'site/public-route-patch/games/seed-man-platformer/data/campaign.json';
const REQUIRED_COMBAT = 'seed-man-combat-browser-v2';
const REQUIRED_ENEMIES = 'seed-man-v20-enemy-runtime-v2';
const CANONICAL_FORMS = ['plant', 'fire', 'electric', 'ice'];
const RETIRED_ALIASES = ['solar-flare', 'static-haze', 'frost-resin'];

for (const file of [combatPath, enemyRuntimePath, campaignPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing canonical Seed Man v20 input: ${file}`);
}

const combat = fs.readFileSync(combatPath, 'utf8');
const enemies = fs.readFileSync(enemyRuntimePath, 'utf8');
const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));

if (!combat.includes(REQUIRED_COMBAT)) throw new Error(`Canonical combat marker missing: ${REQUIRED_COMBAT}`);
if (!enemies.includes(REQUIRED_ENEMIES)) throw new Error(`Canonical enemy marker missing: ${REQUIRED_ENEMIES}`);
if (campaign.levelCount !== 20 || campaign.worlds?.length !== 5) throw new Error('Seed Man v20 campaign contract is not present.');
if (campaign.finalBoss !== 'blight-king') throw new Error('Seed Man v20 final boss must be Blight King.');
if (combat.includes('seed-man-combat-browser-v1')) throw new Error('Legacy v1 combat marker leaked into canonical v2 runtime.');
for (const retired of RETIRED_ALIASES) {
  if (combat.includes(retired) || enemies.includes(retired)) throw new Error(`Retired phenotype alias leaked into canonical runtime: ${retired}`);
}
for (const form of CANONICAL_FORMS) {
  if (!combat.includes(form) || !enemies.includes(form)) throw new Error(`Canonical phenotype form is missing from runtime: ${form}`);
}

console.log(JSON.stringify({
  ok: true,
  mode: 'validation-only',
  levels: campaign.levelCount,
  worlds: campaign.worlds.length,
  finalBoss: campaign.finalBoss,
  phenotypeForms: CANONICAL_FORMS,
  retiredAliasesBlocked: RETIRED_ALIASES,
  legacyMutationDisabled: true
}, null, 2));
