export const APPROVED_ART_MANIFEST_ID = 'seed-man-approved-art-v1';

export function validateApprovedArtManifest(manifest) {
  if (!manifest || manifest.id !== APPROVED_ART_MANIFEST_ID) {
    throw new Error(`Seed Man approved art manifest mismatch: ${manifest?.id || 'missing'}`);
  }
  if (manifest.policy?.authoritative !== true) throw new Error('Approved Seed Man art must be authoritative.');
  if (manifest.policy?.proceduralFallbackAllowed !== false) throw new Error('Procedural character fallback is forbidden in production.');
  if (manifest.policy?.legacyAtlasFallbackAllowed !== false) throw new Error('Legacy character atlas fallback is forbidden in production.');

  const required = [
    'cover.main',
    'character.seedman.atlas',
    'enemy.atlas',
    'boss.atlas',
    'platform.atlas',
    'world.atlas',
    'ui.vfx.cover',
    'world.greenhouse-valley.background',
    'world.forest-ruins.background',
    'world.desert-canyon.background',
    'world.frozen-peaks.background',
    'world.eco-city.background'
  ];
  for (const key of required) {
    const asset = manifest.assets?.[key];
    if (!asset?.src) throw new Error(`Missing approved Seed Man asset key: ${key}`);
  }
  return true;
}

export function createApprovedArtRegistry(manifest, { baseUrl = './' } = {}) {
  validateApprovedArtManifest(manifest);
  const root = new URL(baseUrl, globalThis.location?.href || 'https://dtfseeds.com/games/seed-man-platformer/');
  const entries = new Map(Object.entries(manifest.assets).map(([key, value]) => [key, Object.freeze({ ...value, url: new URL(value.src, root).href })]));
  return Object.freeze({
    id: manifest.id,
    get(key) {
      const asset = entries.get(key);
      if (!asset) throw new Error(`Unknown Seed Man approved asset key: ${key}`);
      return asset;
    },
    has: (key) => entries.has(key),
    keys: () => Object.freeze([...entries.keys()]),
    worldBackground(worldKey) { return this.get(`world.${worldKey}.background`); },
    characterAtlas: () => entries.get('character.seedman.atlas'),
    enemyAtlas: () => entries.get('enemy.atlas'),
    bossAtlas: () => entries.get('boss.atlas'),
    platformAtlas: () => entries.get('platform.atlas')
  });
}
