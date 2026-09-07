import fs from 'node:fs';
import './prepare-seed-man-release-version.mjs';
import './prepare-seed-man-world-five-runtime.mjs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
if (!fs.existsSync(combatPath)) throw new Error(`Missing Seed Man combat browser runtime: ${combatPath}`);

let combat = fs.readFileSync(combatPath, 'utf8');
const WORLD_FIVE_COMBAT_MARKER = 'seed-man-world-five-combat-v1';
const worldFiveEncounters = `,
    'chromosome-crossing': [
      { id: 'frontier-ember-beetle', name: 'Ember Beetle', x: 1560, y: 438, minX: 1400, maxX: 1940, width: 38, height: 32, health: 4, speed: 58, drop: ['resin', 3] },
      { id: 'frontier-voltage-wasp', name: 'Voltage Wasp', x: 3320, y: 282, minX: 3060, maxX: 3820, width: 36, height: 26, health: 4, speed: 104, flying: true, drop: ['genetic-fragments', 3] },
      { id: 'frontier-cryo-moth', name: 'Cryo Moth', x: 5280, y: 276, minX: 5000, maxX: 5860, width: 44, height: 32, health: 5, speed: 84, flying: true, drop: ['trichomes', 4] }
    ],
    'mutation-marsh': [
      { id: 'frontier-elite-ember', name: 'Solar Ember Beetle', x: 2500, y: 430, minX: 2260, maxX: 2940, width: 44, height: 36, health: 9, speed: 52, elite: true, phenotype: 'solar-flare', drop: ['resin', 5] },
      { id: 'frontier-voltage-alpha', name: 'Voltage Wasp Alpha', x: 5480, y: 270, minX: 5160, maxX: 6040, width: 54, height: 38, health: 12, speed: 110, flying: true, elite: true, phenotype: 'static-haze', telegraph: 0.75, drop: ['genetic-fragments', 6] }
    ],
    'allele-array': [
      { id: 'frontier-elite-voltage', name: 'Voltaic Wasp', x: 2860, y: 270, minX: 2580, maxX: 3380, width: 44, height: 32, health: 9, speed: 108, flying: true, elite: true, phenotype: 'static-haze', drop: ['alleles', 2] },
      { id: 'frontier-elite-cryo', name: 'Cryo Moth Prime', x: 5260, y: 288, minX: 4940, maxX: 5880, width: 48, height: 34, health: 10, speed: 88, flying: true, elite: true, phenotype: 'frost-resin', drop: ['trichomes', 6] }
    ],
    'genome-spire': [
      { id: 'frontier-solar-guard', name: 'Solar Ember Guard', x: 2180, y: 430, minX: 1940, maxX: 2640, width: 46, height: 38, health: 10, speed: 56, elite: true, phenotype: 'solar-flare', drop: ['resin', 6] },
      { id: 'frontier-static-guard', name: 'Static Wasp Guard', x: 3760, y: 268, minX: 3440, maxX: 4340, width: 46, height: 32, health: 10, speed: 110, flying: true, elite: true, phenotype: 'static-haze', drop: ['genetic-fragments', 5] },
      { id: 'frontier-frost-guard', name: 'Frost Moth Guard', x: 5120, y: 278, minX: 4800, maxX: 5700, width: 48, height: 34, health: 11, speed: 90, flying: true, elite: true, phenotype: 'frost-resin', drop: ['trichomes', 6] }
    ]`;

if (!combat.includes(WORLD_FIVE_COMBAT_MARKER)) {
  const encounterEnd = "\n    ]\n  });\n\n  let enemies = [];";
  const cloudNineMarker = "    'cloud-nine-citadel': [";
  const cloudNineIndex = combat.indexOf(cloudNineMarker);
  if (cloudNineIndex < 0) throw new Error('Could not locate Cloud Nine encounter block.');
  const encounterEndIndex = combat.indexOf(encounterEnd, cloudNineIndex);
  if (encounterEndIndex < 0) throw new Error('Could not locate Seed Man encounter-table terminator.');
  combat = `${combat.slice(0, encounterEndIndex + 6)}${worldFiveEncounters}${combat.slice(encounterEndIndex + 6)}`;
  combat = combat.replace(
    "  function encounterDefinitions() {\n    return ENCOUNTERS[level?.id] || ENCOUNTERS['sprout-run'];\n  }",
    "  function encounterDefinitions() {\n    return ENCOUNTERS[level?.id] || [];\n  }"
  );
  combat = combat.replace(
    "  const VERSION = 'seed-man-combat-browser-v1';",
    "  const VERSION = 'seed-man-combat-browser-v1';\n  const WORLD_FIVE_COMBAT = 'seed-man-world-five-combat-v1';"
  );
  fs.writeFileSync(combatPath, combat);
}

for (const marker of [
  WORLD_FIVE_COMBAT_MARKER,
  "'chromosome-crossing'",
  "'mutation-marsh'",
  "'allele-array'",
  "'genome-spire'",
  'Solar Ember Beetle',
  'Voltage Wasp Alpha',
  'Cryo Moth Prime',
  "phenotype: 'solar-flare'",
  "phenotype: 'static-haze'",
  "phenotype: 'frost-resin'",
  'return ENCOUNTERS[level?.id] || [];'
]) {
  if (!combat.includes(marker)) throw new Error(`Prepared combat runtime is missing World 5 marker: ${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  combatFile: combatPath,
  version: WORLD_FIVE_COMBAT_MARKER,
  levels: ['chromosome-crossing', 'mutation-marsh', 'allele-array', 'genome-spire'],
  elementalPhenotypes: ['solar-flare', 'static-haze', 'frost-resin'],
  unknownEncounterFallback: 'empty'
}, null, 2));