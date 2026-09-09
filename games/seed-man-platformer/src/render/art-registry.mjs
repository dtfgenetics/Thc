export const APPROVED_ART_MANIFEST_ID = 'seed-man-approved-art-v2';
export const APPROVED_ART_SOURCE = 'approved-showcase-2026-09-08';

const WORLD_ORDER = ['greenhouse-valley', 'forest-ruins', 'desert-canyon', 'frozen-peak', 'eco-city'];
const WORLD_ALIASES = Object.freeze({ 'frozen-peaks': 'frozen-peak' });

export function validateApprovedArtManifest(manifest) {
  if (!manifest || manifest.id !== APPROVED_ART_MANIFEST_ID) {
    throw new Error(`Seed Man approved art manifest mismatch: ${manifest?.id || 'missing'}`);
  }
  if (manifest.sourceOfTruth !== APPROVED_ART_SOURCE) throw new Error(`Seed Man approved art source mismatch: ${manifest.sourceOfTruth || 'missing'}`);
  if (manifest.policy?.authoritative !== true) throw new Error('Approved Seed Man art must be authoritative.');
  if (manifest.policy?.proceduralFallbackAllowed !== false) throw new Error('Procedural character fallback is forbidden in production.');
  if (manifest.policy?.legacyAtlasFallbackAllowed !== false) throw new Error('Legacy character atlas fallback is forbidden in production.');
  if (manifest.policy?.characterReference !== 'green-armored-plant-hero') throw new Error('Seed Man character reference must be the approved green armored plant hero.');
  if (!manifest.masterAtlas?.src || !manifest.masterAtlas?.width || !manifest.masterAtlas?.height) throw new Error('Approved Seed Man master atlas metadata is incomplete.');

  const required = ['cover.main','character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas','world.atlas','ui.vfx'];
  for (const key of required) {
    const asset = manifest.assets?.[key];
    if (!asset?.atlasRegion) throw new Error(`Missing approved Seed Man atlas region: ${key}`);
    if (!manifest.masterAtlas.regions?.[asset.atlasRegion]) throw new Error(`Unknown approved Seed Man atlas region: ${asset.atlasRegion}`);
  }
  for (const world of WORLD_ORDER) if (!manifest.policy.worlds?.includes(world)) throw new Error(`Missing approved Seed Man world: ${world}`);
  for (const phenotype of ['plant','fire','electric','ice']) if (!manifest.phenotypes?.includes(phenotype)) throw new Error(`Missing approved Seed Man phenotype: ${phenotype}`);
  for (const boss of ['overgrown-guardian','ancient-dryad','scorchroot-titan','frostbite-colossus','eco-sentinel','blight-king']) if (!manifest.bosses?.includes(boss)) throw new Error(`Missing Seed Man boss: ${boss}`);
  return true;
}

export function createApprovedArtRegistry(manifest, { baseUrl = './' } = {}) {
  validateApprovedArtManifest(manifest);
  const root = new URL(baseUrl, globalThis.location?.href || 'https://dtfseeds.com/games/seed-man-platformer/');
  const atlasUrl = new URL(manifest.masterAtlas.src, root).href;
  const buildAsset = (key, value) => {
    const region = manifest.masterAtlas.regions[value.atlasRegion];
    return Object.freeze({ ...value, key, src: manifest.masterAtlas.src, url: atlasUrl, region: Object.freeze({ ...region }) });
  };
  const entries = new Map(Object.entries(manifest.assets).map(([key, value]) => [key, buildAsset(key, value)]));
  const worldRegion = manifest.masterAtlas.regions['world.atlas'];
  const worldWidth = Math.floor(worldRegion.width / WORLD_ORDER.length);
  for (const [index, world] of WORLD_ORDER.entries()) {
    entries.set(`world.${world}.background`, Object.freeze({
      key: `world.${world}.background`, role: 'background', src: manifest.masterAtlas.src, url: atlasUrl,
      region: Object.freeze({ x: worldRegion.x + worldWidth * index, y: worldRegion.y, width: worldWidth, height: worldRegion.height })
    }));
  }
  return Object.freeze({
    id: manifest.id,
    sourceOfTruth: manifest.sourceOfTruth,
    masterAtlas: Object.freeze({ ...manifest.masterAtlas, url: atlasUrl }),
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
