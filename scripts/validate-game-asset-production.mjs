import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const registryPath = path.join(root, 'data', 'game-asset-production-registry.json');
const masterPath = path.join(root, 'docs', 'GAME_ASSET_PRODUCTION_MASTER.md');
const skillPath = path.join(root, '.agents', 'skills', 'dtf-game-asset-production', 'SKILL.md');
const importerPath = path.join(root, 'scripts', 'recover-approved-game-asset.mjs');
const batchDir = path.join(root, 'data', 'game-asset-batches');

const fail = (message) => {
  console.error(`Game asset production validation failed: ${message}`);
  process.exitCode = 1;
};

for (const requiredPath of [registryPath, masterPath, skillPath, importerPath]) {
  if (!fs.existsSync(requiredPath)) fail(`missing required file ${path.relative(root, requiredPath)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const master = fs.readFileSync(masterPath, 'utf8');
const skill = fs.readFileSync(skillPath, 'utf8');
const importer = fs.readFileSync(importerPath, 'utf8');

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
const expectedBatches = [
  ['SM-001', 'seed-man'],
  ['WTI-001', 'who-took-it'],
  ['HL-001', 'high-life'],
  ['HIQ-001', 'high-iq'],
  ['TERP-001', 'terpocalypse'],
  ['BOB-001', 'bud-or-bluff'],
];
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

const allowedBatchStatuses = new Set(['READY-FOR-AUTHORING','AUTHORING','REVIEW','APPROVED','NORMALIZING','OPTIMIZING','INTEGRATING','VERIFIED-LIVE']);
const batches = new Map();
for (const [batchId, gameId] of expectedBatches) {
  const batchPath = path.join(batchDir, `${batchId}.json`);
  if (!fs.existsSync(batchPath)) {
    fail(`missing Wave 1 batch manifest data/game-asset-batches/${batchId}.json`);
    continue;
  }
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  batches.set(batchId, batch);
  if (batch.schemaVersion !== 1) fail(`${batchId} schemaVersion must be 1`);
  if (batch.batchId !== batchId) fail(`${batchId} internal batchId mismatch`);
  if (batch.gameId !== gameId) fail(`${batchId} expected gameId ${gameId}, found ${batch.gameId}`);
  if (batch.priority !== 'P0') fail(`${batchId} must be P0`);
  if (batch.quantity !== 10) fail(`${batchId} must contain exactly 10 planned assets`);
  if (!allowedBatchStatuses.has(batch.status)) fail(`${batchId} has unsupported status ${batch.status}`);
  if (!batch.drive?.sourceBatchFolderId || !batch.drive?.briefFolderId || !batch.drive?.approvedMastersFolderId || !batch.drive?.runtimeExportsFolderId) fail(`${batchId} is missing required Drive folder mapping`);
  const assets = batch.assets ?? [];
  if (assets.length !== 10) fail(`${batchId} expected 10 asset entries, found ${assets.length}`);
  const ids = assets.map((asset) => asset.assetId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id || typeof id !== 'string')) fail(`${batchId} asset IDs must be nonempty and unique`);

  const targetCandidates = Array.isArray(batch.runtime?.targetDirectories)
    ? batch.runtime.targetDirectories
    : [batch.runtime?.targetDirectory].filter(Boolean);
  if (targetCandidates.length === 0) fail(`${batchId} missing runtime targetDirectory/targetDirectories`);

  const game = registry.games?.[gameId];
  if (game?.repo === 'dtfgenetics/Thc') {
    const routeSegment = String(game.publicRoute || '').replace(/^\/+|\/+$/g, '');
    const publicRoot = routeSegment ? `site/public-route-patch/${routeSegment}` : null;
    const roots = [game.repoRuntimeRoot, publicRoot].filter(Boolean);
    for (const target of targetCandidates) {
      const targetString = String(target);
      if (!roots.some((rootPath) => targetString === rootPath || targetString.startsWith(`${rootPath}/`))) fail(`${batchId} target ${targetString} is outside canonical game roots ${roots.join(', ')}`);
    }
  }
}

const seed = registry.games?.['seed-man']?.knownScope ?? {};
for (const [field, expected] of Object.entries({phenotypes:4,coreCharacterStates:9,enemies:10,bosses:6,worlds:5,terrainClasses:11})) {
  if (seed[field] !== expected) fail(`Seed Man ${field} expected ${expected}, found ${seed[field]}`);
}

const who = registry.games?.['who-took-it']?.knownScope ?? {};
for (const [field, expected] of Object.entries({suspectPortraitsComplete:25,itemEvidenceCardsMissing:18,boardFramesMissing:3,selectionStateAssetsMissing:4})) {
  if (who[field] !== expected) fail(`Who Took It ${field} expected ${expected}, found ${who[field]}`);
}

const wtiBatch = batches.get('WTI-001');
const expectedWtiItems = ['item_bag','item_dabs','item_lighter','item_chocolate_bar','item_gummies'];
const actualWtiItems = (wtiBatch?.assets ?? []).map((asset) => asset.canonicalItemId).filter(Boolean);
if (JSON.stringify(actualWtiItems) !== JSON.stringify(expectedWtiItems)) fail(`WTI-001 canonical item IDs mismatch: ${JSON.stringify(actualWtiItems)}`);
if (wtiBatch?.unresolvedPlannedItems !== 13) fail('WTI-001 must keep 13 planned evidence items unresolved until canonical data defines them');

const expectedHiqCategories = ['Nutrition & pH','Environment & Climate','Root Zone & Irrigation','Plant Biology','Diagnostics','Photobiology','Plant Physiology','Integrated Pest Management','Genetics & Breeding','Harvest & Postharvest'];
const hiqCategories = (batches.get('HIQ-001')?.assets ?? []).map((asset) => asset.category);
if (JSON.stringify(hiqCategories) !== JSON.stringify(expectedHiqCategories)) fail('HIQ-001 categories must exactly match v2.4 categoryCounts ordering');

const terp = registry.games?.terpocalypse?.knownScope ?? {};
for (const [field, expected] of Object.entries({brandingMissing:3,uiMissing:8,weaponFramesMissing:6,enemyStatesMissing:9,pickupsMissing:5,effectsMissing:4})) {
  if (terp[field] !== expected) fail(`Terpocalypse ${field} expected ${expected}, found ${terp[field]}`);
}
const terpBatch = batches.get('TERP-001');
if (terpBatch?.deferredManifestAsset !== 'thc-badge') fail('TERP-001 must defer thc-badge so the batch remains exactly 10 assets');

for (const marker of ['Google Drive = human/source asset library','GitHub = runtime asset library','10-asset production batch contract','SM-001','WTI-001','HL-001','HIQ-001','TERP-001','BOB-001']) {
  if (!master.includes(marker)) fail(`production master missing marker: ${marker}`);
}
for (const marker of ['04 Games/<Game>/08 Visual Assets','NEEDED → CONCEPT → REVIEW → APPROVED → NORMALIZED → OPTIMIZED → INTEGRATED → VERIFIED-LIVE','Definition of done']) {
  if (!skill.includes(marker)) fail(`asset skill missing marker: ${marker}`);
}
for (const marker of ['asset.driveFile.fileId','asset.driveFile.sha256','targetDirectory','validated-google-drive-direct-download','INTEGRATED']) {
  if (!importer.includes(marker)) fail(`game asset importer missing safety marker: ${marker}`);
}

if (!process.exitCode) console.log(`Game asset production controls valid: ${allWaveGames.length} games, ${expectedBatches.length} Wave 1 batch manifests, 60 immediate asset slots.`);
