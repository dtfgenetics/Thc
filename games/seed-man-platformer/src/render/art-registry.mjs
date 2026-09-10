const WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });

export function validateApprovedArtManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Seed Man art manifest is missing');
  if (manifest.assets != null && (typeof manifest.assets !== 'object' || Array.isArray(manifest.assets))) {
    throw new Error('Seed Man art manifest assets must be an object when provided');
  }
  return true;
}

export function createApprovedArtRegistry(manifest, { baseUrl = './' } = {}) {
  validateApprovedArtManifest(manifest);
  const root = new URL(baseUrl, globalThis.location?.href || 'https://dtfseeds.com/games/seed-man-platformer/');
  const entries = new Map(Object.entries(manifest.assets || {}).map(([key, value]) => {
    const asset = value?.src
      ? { ...value, key, url: new URL(value.src, root).href }
      : { ...(value || {}), key, url: null };
    return [key, Object.freeze(asset)];
  }));
  return Object.freeze({
    id: manifest.id || null,
    sourceOfTruth: manifest.sourceOfTruth || null,
    worldRenderer: manifest.policy?.worldRenderer || null,
    worldFallbackRenderer: manifest.policy?.worldFallbackRenderer || null,
    get(key) {
      const normalized = key?.startsWith('world.') && key?.endsWith('.background')
        ? `world.${WORLD_ALIASES[key.slice(6, -11)] || key.slice(6, -11)}.background`
        : key;
      const asset = entries.get(normalized);
      if (!asset) throw new Error(`Unknown Seed Man asset key: ${key}`);
      return asset;
    },
    has(key) { return entries.has(key); },
    keys: () => Object.freeze([...entries.keys()]),
    worldBackground(worldKey) { return entries.get(`world.${WORLD_ALIASES[worldKey] || worldKey}.background`) || null; },
    characterAtlas: () => entries.get('character.seedman.atlas') || null,
    enemyAtlas: () => entries.get('enemy.atlas') || entries.get('enemy-boss.atlas') || null,
    bossAtlas: () => entries.get('boss.atlas') || entries.get('enemy-boss.atlas') || null,
    platformAtlas: () => entries.get('platform.atlas') || null
  });
}
