export const APPROVED_ART_MANIFEST_ID = 'seed-man-approved-art-v2';

const REQUIRED_ASSET_KEYS = Object.freeze([
  'cover.main',
  'character.seedman.atlas',
  'enemy.atlas',
  'boss.atlas',
  'platform.atlas',
  'world.atlas',
  'ui.vfx'
]);

const WORLD_ALIASES = Object.freeze({
  'greenhouse-valley': 'greenhouse-valley',
  'forest-ruins': 'forest-ruins',
  'desert-canyon': 'desert-canyon',
  'frozen-peaks': 'frozen-peak',
  'eco-city': 'eco-city'
});

export function validateApprovedArtManifest(manifest) {
  if (!manifest || manifest.id !== APPROVED_ART_MANIFEST_ID) {
    throw new Error(`Seed Man approved art manifest mismatch: ${manifest?.id || 'missing'}`);
  }
  if (manifest.schemaVersion !== 2) throw new Error(`Seed Man approved art schema mismatch: ${manifest.schemaVersion}`);
  if (manifest.policy?.authoritative !== true) throw new Error('Approved Seed Man art must be authoritative.');
  if (manifest.policy?.proceduralFallbackAllowed !== false) throw new Error('Procedural character fallback is forbidden in production.');
  if (manifest.policy?.legacyAtlasFallbackAllowed !== false) throw new Error('Legacy character atlas fallback is forbidden in production.');
  if (!manifest.masterAtlas?.src || !manifest.masterAtlas?.publicSrc) throw new Error('Approved Seed Man master atlas source is required.');
  if (!manifest.masterAtlas?.regions || typeof manifest.masterAtlas.regions !== 'object') throw new Error('Approved Seed Man master atlas regions are required.');

  for (const key of REQUIRED_ASSET_KEYS) {
    const asset = manifest.assets?.[key];
    if (!asset?.atlasRegion) throw new Error(`Missing approved Seed Man atlas region mapping: ${key}`);
    if (!manifest.masterAtlas.regions[asset.atlasRegion]) throw new Error(`Unknown approved Seed Man atlas region: ${asset.atlasRegion}`);
  }
  return true;
}

export function createApprovedArtRegistry(manifest, { baseUrl = './' } = {}) {
  validateApprovedArtManifest(manifest);
  const root = new URL(baseUrl, globalThis.location?.href || 'https://dtfseeds.com/games/seed-man-platformer/');
  const atlasUrl = new URL(manifest.masterAtlas.publicSrc || manifest.masterAtlas.src, root).href;
  const regionFor = (asset) => Object.freeze({ ...manifest.masterAtlas.regions[asset.atlasRegion] });
  const entries = new Map(Object.entries(manifest.assets).map(([key, value]) => [key, Object.freeze({
    ...value,
    url: atlasUrl,
    region: regionFor(value)
  })]));

  const worldAtlas = entries.get('world.atlas');
  for (const [publicKey, manifestKey] of Object.entries(WORLD_ALIASES)) {
    entries.set(`world.${publicKey}.background`, Object.freeze({
      ...worldAtlas,
      role: 'world-background',
      worldKey: manifestKey
    }));
  }
  entries.set('ui.vfx.cover', Object.freeze({ ...entries.get('ui.vfx'), role: 'ui-vfx' }));

  return Object.freeze({
    id: manifest.id,
    sourceOfTruth: manifest.sourceOfTruth,
    masterAtlas: Object.freeze({ url: atlasUrl, width: manifest.masterAtlas.width, height: manifest.masterAtlas.height }),
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
