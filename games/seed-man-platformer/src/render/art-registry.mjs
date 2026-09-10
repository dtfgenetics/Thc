export const APPROVED_ART_MANIFEST_ID = 'seed-man-approved-art-v2';
export const APPROVED_ART_SOURCE = 'approved-showcase-2026-09-08';

const WORLD_ORDER = Object.freeze(['greenhouse-valley', 'forest-ruins', 'desert-canyon', 'frozen-peaks', 'eco-city']);
const WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });
const REQUIRED_IMAGE_ASSETS = Object.freeze(['character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas']);
const REQUIRED_RENDER_ASSETS = Object.freeze(['cover.main','ui.vfx.cover']);

export function validateApprovedArtManifest(manifest) {
  if (!manifest || manifest.id !== APPROVED_ART_MANIFEST_ID) {
    throw new Error(`Seed Man approved art manifest mismatch: ${manifest?.id || 'missing'}`);
  }
  if (manifest.schemaVersion !== 3) throw new Error(`Seed Man approved art schema must be v3, got ${manifest?.schemaVersion || 'missing'}`);
  if (manifest.sourceOfTruth !== APPROVED_ART_SOURCE) throw new Error(`Seed Man approved art source mismatch: ${manifest.sourceOfTruth || 'missing'}`);
  if (manifest.policy?.authoritative !== true) throw new Error('Approved Seed Man art must be authoritative.');
  if (manifest.policy?.proceduralFallbackAllowed !== false) throw new Error('Procedural character fallback is forbidden in production.');
  if (manifest.policy?.legacyAtlasFallbackAllowed !== false) throw new Error('Legacy character atlas fallback is forbidden in production.');
  if (manifest.policy?.characterReference !== 'green-armored-plant-hero') throw new Error('Seed Man character reference must be the approved green armored plant hero.');
  if (manifest.policy?.worldRenderer !== 'seed-man-three-world-v2') throw new Error('Seed Man worlds must use the production Three.js renderer.');
  if (manifest.masterAtlas) throw new Error('Retired Seed Man master atlas must not be present in the production manifest.');

  for (const key of REQUIRED_IMAGE_ASSETS) {
    const asset = manifest.assets?.[key];
    if (!asset?.src || asset.type !== 'atlas') throw new Error(`Missing approved Seed Man image atlas: ${key}`);
  }
  for (const key of REQUIRED_RENDER_ASSETS) {
    const asset = manifest.assets?.[key];
    if (!asset?.renderer) throw new Error(`Missing Seed Man renderer-backed asset: ${key}`);
  }
  for (const world of WORLD_ORDER) {
    if (!manifest.policy.worlds?.includes(world)) throw new Error(`Missing approved Seed Man world: ${world}`);
    const asset = manifest.assets?.[`world.${world}.background`];
    if (asset?.renderer !== manifest.policy.worldRenderer || asset?.world !== world) throw new Error(`Missing production world renderer descriptor: ${world}`);
  }
  for (const phenotype of ['plant','fire','electric','ice']) if (!manifest.phenotypes?.includes(phenotype)) throw new Error(`Missing approved Seed Man phenotype: ${phenotype}`);
  for (const boss of ['overgrown-guardian','ancient-dryad','scorchroot-titan','frostbite-colossus','eco-sentinel','blight-king']) if (!manifest.bosses?.includes(boss)) throw new Error(`Missing Seed Man boss: ${boss}`);
  return true;
}

export function createApprovedArtRegistry(manifest, { baseUrl = './' } = {}) {
  validateApprovedArtManifest(manifest);
  const root = new URL(baseUrl, globalThis.location?.href || 'https://dtfseeds.com/games/seed-man-platformer/');
  const entries = new Map(Object.entries(manifest.assets).map(([key, value]) => {
    const asset = value.src
      ? { ...value, key, url: new URL(value.src, root).href }
      : { ...value, key, url: null };
    return [key, Object.freeze(asset)];
  }));
  return Object.freeze({
    id: manifest.id,
    sourceOfTruth: manifest.sourceOfTruth,
    worldRenderer: manifest.policy.worldRenderer,
    worldFallbackRenderer: manifest.policy.worldFallbackRenderer,
    get(key) {
      const normalized = key?.startsWith('world.') && key?.endsWith('.background')
        ? `world.${WORLD_ALIASES[key.slice(6, -11)] || key.slice(6, -11)}.background`
        : key;
      const asset = entries.get(normalized);
      if (!asset) throw new Error(`Unknown Seed Man approved asset key: ${key}`);
      return asset;
    },
    has(key) { try { this.get(key); return true; } catch { return false; } },
    keys: () => Object.freeze([...entries.keys()]),
    worldBackground(worldKey) { return this.get(`world.${worldKey}.background`); },
    characterAtlas: () => entries.get('character.seedman.atlas'),
    enemyAtlas: () => entries.get('enemy.atlas'),
    bossAtlas: () => entries.get('boss.atlas'),
    platformAtlas: () => entries.get('platform.atlas')
  });
}
