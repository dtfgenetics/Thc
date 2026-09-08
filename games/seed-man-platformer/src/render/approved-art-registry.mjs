export const APPROVED_ART_MANIFEST_URL = '../../data/seed-man-art-manifest-v1.json';

export function resolveApprovedArt(manifest, key) {
  const asset = manifest?.assets?.[key];
  if (!asset) throw new Error(`Missing approved Seed Man art key: ${key}`);
  return asset;
}

export function assertApprovedArtPolicy(manifest) {
  if (!manifest?.policy?.authoritative) throw new Error('Approved Seed Man art manifest must be authoritative.');
  if (manifest.policy.proceduralFallbackAllowed !== false) throw new Error('Procedural Seed Man fallback is forbidden in production.');
  if (manifest.policy.legacyAtlasFallbackAllowed !== false) throw new Error('Legacy Seed Man atlas fallback is forbidden in production.');
  if (manifest.policy.characterReference !== 'green-armored-plant-hero') throw new Error('Unexpected Seed Man character reference.');
  return manifest;
}

export function buildApprovedAssetIndex(manifest) {
  assertApprovedArtPolicy(manifest);
  return Object.freeze(Object.fromEntries(Object.entries(manifest.assets || {}).map(([key, asset]) => [key, Object.freeze({ key, ...asset })])));
}
