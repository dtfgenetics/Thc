import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const backlogPath = path.resolve(root, process.argv[2] || 'games/seed-man-platformer/data/visual-production-backlog-v1.json');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const exists = rel => fs.existsSync(path.join(root, rel));
const fail = message => { throw new Error(message); };

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`missing-string:${label}`);
  return value;
}

function requireBool(value, expected, label) {
  if (value !== expected) fail(`bad-bool:${label}:${value}`);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`missing-array:${label}`);
  return value;
}

function requireDriveId(value, label) {
  const id = requireString(value, label);
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) fail(`invalid-drive-id:${label}`);
  return id;
}

function requireRepoPath(value, prefix, suffix, label, mustExist = false) {
  const rel = requireString(value, label);
  if (rel.includes('..') || rel.startsWith('/') || rel.includes('\\')) fail(`unsafe-path:${label}:${rel}`);
  if (!rel.startsWith(prefix)) fail(`bad-path-prefix:${label}:${rel}`);
  if (suffix && !rel.endsWith(suffix)) fail(`bad-path-suffix:${label}:${rel}`);
  if (mustExist && !exists(rel)) fail(`missing-file:${label}:${rel}`);
  return rel;
}

function requireWebp(rel, label) {
  requireRepoPath(rel, '', '.webp', label, true);
  const bytes = fs.readFileSync(path.join(root, rel));
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    fail(`invalid-webp:${label}:${rel}`);
  }
}

const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
if (backlog.schemaVersion !== 1) fail(`schemaVersion:${backlog.schemaVersion}`);
if (backlog.gameId !== 'seed-man-platformer') fail(`gameId:${backlog.gameId}`);
if (!/^20\d{2}-\d{2}-\d{2}$/.test(requireString(backlog.updated, 'updated'))) fail(`updated-date:${backlog.updated}`);
if (backlog.sourceOfTruth !== 'games/seed-man-platformer/data/seed-man-art-manifest-v1.json') fail('sourceOfTruth-mismatch');
if (!exists(backlog.sourceOfTruth)) fail(`missing-sourceOfTruth:${backlog.sourceOfTruth}`);

const art = readJson(backlog.sourceOfTruth);
if (art.schemaVersion !== 3 || art.id !== 'seed-man-approved-art-v2') fail('approved-art-manifest-mismatch');
if (art.policy?.characterReference !== 'green-armored-plant-hero') fail('approved-character-policy-mismatch');
if (art.policy?.worldRenderer !== 'seed-man-three-world-v2') fail('approved-world-renderer-policy-mismatch');

const policy = backlog.productionPolicy || {};
requireBool(policy.individualAssetsFirst, true, 'productionPolicy.individualAssetsFirst');
requireBool(policy.conceptSheetsAreReviewOnly, true, 'productionPolicy.conceptSheetsAreReviewOnly');
requireBool(policy.transparentForSprites, true, 'productionPolicy.transparentForSprites');
requireBool(policy.noProceduralFallbackForApprovedArt, true, 'productionPolicy.noProceduralFallbackForApprovedArt');
if (JSON.stringify(policy.runtimeFormats) !== JSON.stringify(['webp'])) fail('runtimeFormats-mismatch');
if (JSON.stringify(policy.sourceMasterFormats) !== JSON.stringify(['png'])) fail('sourceMasterFormats-mismatch');
if (!requireString(policy.spriteRule, 'productionPolicy.spriteRule').includes('bottom-center anchor')) fail('spriteRule-anchor-missing');

for (const [key, value] of Object.entries(backlog.drive || {})) requireDriveId(value, `drive.${key}`);
const requiredDriveKeys = ['rootFolderId','referenceFolderId','sourceMastersFolderId','characterSpritesFolderId','enemiesBossesFolderId','worldArtFolderId','terrainPropsFolderId','uiVfxFolderId','runtimeExportsFolderId','reviewFolderId'];
for (const key of requiredDriveKeys) requireDriveId(backlog.drive?.[key], `drive.${key}`);

const expectedRuntimeAssets = new Set(['character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas']);
const runtimeAssets = requireArray(backlog.runtimeAssets, 'runtimeAssets');
if (runtimeAssets.length !== expectedRuntimeAssets.size) fail(`runtimeAssets-count:${runtimeAssets.length}`);
for (const asset of runtimeAssets) {
  const id = requireString(asset.id, 'runtimeAssets.id');
  if (!expectedRuntimeAssets.delete(id)) fail(`unexpected-or-duplicate-runtime-asset:${id}`);
  if (asset.status !== 'approved-runtime-present') fail(`runtime-status:${id}:${asset.status}`);
  const repoPath = requireRepoPath(asset.repoPath, 'games/seed-man-platformer/assets/approved/', '.webp', `runtimeAssets.${id}.repoPath`, true);
  const sitePath = requireRepoPath(asset.sitePath, 'site/public-route-patch/games/seed-man-platformer/assets/approved/', '.webp', `runtimeAssets.${id}.sitePath`, true);
  requireWebp(repoPath, `runtimeAssets.${id}.repoPath`);
  requireWebp(sitePath, `runtimeAssets.${id}.sitePath`);
  if (!art.assets?.[id]?.src) fail(`runtime-asset-not-in-art-manifest:${id}`);
  if (id === 'boss.atlas' && asset.repoPath !== 'games/seed-man-platformer/assets/approved/seed-man-enemy-boss-atlas-v1.webp') fail('boss-atlas-path-mismatch');
  if (!requireString(asset.next, `runtimeAssets.${id}.next`).includes('source')) fail(`runtime-next-not-source-focused:${id}`);
}
if (expectedRuntimeAssets.size) fail(`missing-runtime-assets:${[...expectedRuntimeAssets].join(',')}`);

const expectedWorlds = ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];
const queue = requireArray(backlog.worldBackgroundQueue, 'worldBackgroundQueue');
if (queue.length !== expectedWorlds.length) fail(`worldBackgroundQueue-count:${queue.length}`);
queue.forEach((item, index) => {
  const world = expectedWorlds[index];
  if (item.world !== world) fail(`world-order:${index}:${item.world}`);
  if (item.id !== `world.${world}.background`) fail(`world-id:${world}:${item.id}`);
  if (item.priority !== index + 1) fail(`world-priority:${world}:${item.priority}`);
  if (item.status !== 'source-master-needed') fail(`world-status:${world}:${item.status}`);
  if (art.assets?.[`world.${world}.background`]?.renderer !== 'seed-man-three-world-v2') fail(`world-art-manifest-renderer:${world}`);
});

const reviewAssets = requireArray(backlog.currentReviewAssets, 'currentReviewAssets');
if (reviewAssets.length < 1) fail('review-assets-empty');
for (const asset of reviewAssets) {
  const name = requireString(asset.name, 'currentReviewAssets.name');
  if (!name.endsWith('.png')) fail(`review-asset-extension:${name}`);
  requireDriveId(asset.driveId, `currentReviewAssets.${name}.driveId`);
  if (asset.status !== 'review-only-not-runtime') fail(`review-asset-status:${name}:${asset.status}`);
}

const next = backlog.nextProductionAsset || fail('missing-nextProductionAsset');
if (next.id !== 'world.greenhouse-valley.background.source-v1') fail(`next-id:${next.id}`);
if (next.kind !== 'background-source-master') fail(`next-kind:${next.kind}`);
if (next.status !== 'ready-to-create') fail(`next-status:${next.status}`);
if (next.targetDriveFolderId !== backlog.drive.worldArtFolderId) fail('next-drive-folder-mismatch');
requireRepoPath(next.targetRepoSourcePath, 'games/seed-man-platformer/assets/source/worlds/', '.png', 'next.targetRepoSourcePath', false);
requireRepoPath(next.targetRuntimePath, 'games/seed-man-platformer/assets/approved/', '.webp', 'next.targetRuntimePath', false);
requireRepoPath(next.targetSitePath, 'site/public-route-patch/games/seed-man-platformer/assets/approved/', '.webp', 'next.targetSitePath', false);
if (!next.targetRepoSourcePath.includes('greenhouse-valley') || !next.targetRuntimePath.includes('greenhouse-valley') || !next.targetSitePath.includes('greenhouse-valley')) fail('next-greenhouse-target-mismatch');

console.log(JSON.stringify({ ok: true, backlog: path.relative(root, backlogPath), runtimeAssets: runtimeAssets.length, worldBackgroundQueue: queue.length, reviewAssets: reviewAssets.length, nextProductionAsset: next.id, driveFolders: requiredDriveKeys.length }));
