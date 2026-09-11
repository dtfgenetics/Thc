import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const registryPath = path.join(root, 'data', 'game-asset-production-registry.json');
const masterPath = path.join(root, 'docs', 'GAME_ASSET_PRODUCTION_MASTER.md');
const skillPath = path.join(root, '.agents', 'skills', 'dtf-game-asset-production', 'SKILL.md');

const fail = (message) => {
  console.error(`Game asset production validation failed: ${message}`);
  process.exitCode = 1;
};

for (const requiredPath of [registryPath, masterPath, skillPath]) {
  if (!fs.existsSync(requiredPath)) fail(`missing required file ${path.relative(root, requiredPath)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const master = fs.readFileSync(masterPath, 'utf8');
const skill = fs.readFileSync(skillPath, 'utf8');

if (registry.schemaVersion !== 1) fail('schemaVersion must be 1');
if (registry.status !== 'active') fail('registry must be active');
if (registry.productionTarget !== 'https://dtfseeds.com/games/') fail('unexpected production target');

const expectedLifecycle = ['NEEDED','CONCEPT','REVIEW','APPROVED','NORMALIZED','OPTIMIZED','INTEGRATED','VERIFIED-LIVE'];
if (JSON.stringify(registry.lifecycle) !== JSON.stringify(expectedLifecycle)) fail(`lifecycle mismatch: ${JSON.stringify(registry.lifecycle)}`);

const expectedSubfolders = ['00 Art Direction','01 Source Masters','02 Approved Masters','03 Characters','04 Environments','05 Gameplay Objects','06 UI + HUD','07 FX + Animation','08 Audio','09 Marketing','10 Print','11 Runtime Exports','99 Archive'];
if (JSON.stringify(registry.drive?.visualSubfolders) !== JSON.stringify(expectedSubfolders)) fail('Drive visual subfolder template changed unexpectedly');

for (const [label, value] of [
  ['gamesRoot.id', registry.drive?.gamesRoot?.id],
  ['shared.id', registry.drive?.shared?.id],
  ['shared.controlFolderId', registry.drive?.shared?.controlFolderId],
  ['shared.trackerId', registry.drive?.shared?.trackerId],
]) {
  if (!value || typeof value !== 'string') fail(`missing ${label}`);
}

if (registry.standards?.batchSize !== 10) fail('default asset batch size must remain 10');
if (registry.standards?.touchTargetPx < 44) fail('touch target standard must be at least 44px');

const waves = registry.waves ?? [];
if (waves.length !== 4) fail(`expected 4 waves, found ${waves.length}`);
const allWaveGames = waves.flatMap((wave) => wave.games ?? []);
const uniqueWaveGames = new Set(allWaveGames);
if (uniqueWaveGames.size !== allWaveGames.length) fail('a game is assigned to more than one asset wave');
if (allWaveGames.length !== 27) fail(`expected 27 tracked public/incoming games, found ${allWaveGames.length}`);

const expectedWave1 = ['seed-man', 'who-took-it', 'high-life', 'high-iq', 'terpocalypse', 'bud-or-bluff'];
const wave1 = waves.find((wave) => wave.wave === 1);
if (!wave1 || JSON.stringify(wave1.games) !== JSON.stringify(expectedWave1)) fail('Wave 1 order must remain Seed Man, Who Took It, High Life, High IQ, Terpocalypse, Bud or Bluff');

for (const gameId of expectedWave1) {
  const game = registry.games?.[gameId];
  if (!game) {
    fail(`missing detailed Wave 1 registry entry for ${gameId}`);
    continue;
  }
  for (const field of ['title','repo','driveGameFolderId','driveVisualRootId','nextBatch']) {
    if (!game[field] || typeof game[field] !== 'string') fail(`${gameId} missing ${field}`);
  }
  if (game.wave !== 1 || game.priority !== 'P0') fail(`${gameId} must remain Wave 1 / P0`);
}

const seed = registry.games?.['seed-man']?.knownScope ?? {};
for (const [field, expected] of Object.entries({phenotypes:4,coreCharacterStates:9,enemies:10,bosses:6,worlds:5,terrainClasses:11})) {
  if (seed[field] !== expected) fail(`Seed Man ${field} expected ${expected}, found ${seed[field]}`);
}

const who = registry.games?.['who-took-it']?.knownScope ?? {};
for (const [field, expected] of Object.entries({suspectPortraitsComplete:25,itemEvidenceCardsMissing:18,boardFramesMissing:3,selectionStateAssetsMissing:4})) {
  if (who[field] !== expected) fail(`Who Took It ${field} expected ${expected}, found ${who[field]}`);
}

const terp = registry.games?.terpocalypse?.knownScope ?? {};
for (const [field, expected] of Object.entries({brandingMissing:3,uiMissing:8,weaponFramesMissing:6,enemyStatesMissing:9,pickupsMissing:5,effectsMissing:4})) {
  if (terp[field] !== expected) fail(`Terpocalypse ${field} expected ${expected}, found ${terp[field]}`);
}

for (const marker of ['Google Drive = human/source asset library','GitHub = runtime asset library','10-asset production batch contract','SM-001','WTI-001','HL-001','HIQ-001','TERP-001','BOB-001']) {
  if (!master.includes(marker)) fail(`production master missing marker: ${marker}`);
}

for (const marker of ['04 Games/<Game>/08 Visual Assets','NEEDED → CONCEPT → REVIEW → APPROVED → NORMALIZED → OPTIMIZED → INTEGRATED → VERIFIED-LIVE','Definition of done']) {
  if (!skill.includes(marker)) fail(`asset skill missing marker: ${marker}`);
}

if (!process.exitCode) console.log(`Game asset production registry valid: ${allWaveGames.length} games across ${waves.length} waves; ${expectedWave1.length} detailed Wave 1 mappings.`);
