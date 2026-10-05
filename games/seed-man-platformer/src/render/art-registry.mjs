export const APPROVED_ART_MANIFEST_ID = 'seed-man-art-manifest-v3';
export const APPROVED_ART_SOURCE = 'classic-seed-man-oval-v1';

const WORLD_ORDER = Object.freeze(['greenhouse-valley', 'forest-ruins', 'desert-canyon', 'frozen-peaks', 'eco-city']);
const WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });
const WORLD_LAYER_ROLES = Object.freeze(['sky','far-bg','mid-bg','near-bg','gameplay','foreground','vfx']);
const REQUIRED_IMAGE_ASSETS = Object.freeze(['character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas']);
const REQUIRED_RENDER_ASSETS = Object.freeze(['cover.main','ui.vfx.cover']);

export function validateApprovedArtManifest(manifest) {
  if (!manifest || manifest.id !== APPROVED_ART_MANIFEST_ID) {
    throw new Error(`Seed Man approved art manifest mismatch: ${manifest?.id || 'missing'}`);
  }
  if (manifest.schemaVersion !== 4) throw new Error(`Seed Man approved art schema must be v4, got ${manifest?.schemaVersion || 'missing'}`);
  if (manifest.sourceOfTruth !== APPROVED_ART_SOURCE) throw new Error(`Seed Man approved art source mismatch: ${manifest.sourceOfTruth || 'missing'}`);
  if (manifest.policy?.authoritative !== true) throw new Error('Seed Man art manifest must remain authoritative.');
  if (manifest.policy?.proceduralFallbackAllowed !== false) throw new Error('Procedural character fallback is forbidden in production.');
  if (manifest.policy?.legacyAtlasFallbackAllowed !== false) throw new Error('Unregistered legacy character atlas fallback is forbidden in production.');
  if (manifest.policy?.characterReference !== 'classic-seed-man-oval-v1') throw new Error('Seed Man character target must be classic-seed-man-oval-v1.');
  if (manifest.policy?.worldRendererTarget !== 'seed-man-three-world-v2') throw new Error('Seed Man final world renderer target must remain seed-man-three-world-v2.');
  if (manifest.policy?.worldFallbackRenderer !== 'seed-man-authored-flat-background-v1') throw new Error('Seed Man current authored world renderer must be the flat background transition renderer.');
  if (manifest.policy?.finalWorldLayerCount !== 7) throw new Error('Seed Man final world art contract requires seven layers per world.');
  if (manifest.masterAtlas) throw new Error('Retired Seed Man master atlas must not be present in the production manifest.');

  for (const key of REQUIRED_IMAGE_ASSETS) {
    const asset = manifest.assets?.[key];
    if (!asset?.src || asset.type !== 'atlas') throw new Error(`Missing registered Seed Man image atlas: ${key}`);
  }
  const playerAtlas = manifest.assets?.['character.seedman.atlas'];
  if (playerAtlas?.status !== 'temporary-legacy-replacement-pending') throw new Error('Current Seed Man character atlas must stay marked temporary until classic Seed Man ships.');
  if (playerAtlas?.targetCharacterReference !== 'classic-seed-man-oval-v1') throw new Error('Temporary player atlas must point to the classic Seed Man replacement target.');

  for (const key of REQUIRED_RENDER_ASSETS) {
    const asset = manifest.assets?.[key];
    if (!asset?.renderer) throw new Error(`Missing Seed Man renderer-backed asset: ${key}`);
  }
  for (const world of WORLD_ORDER) {
    if (!manifest.policy.worlds?.includes(world)) throw new Error(`Missing Seed Man world: ${world}`);
    const background = manifest.assets?.[`world.${world}.background`];
    if (!background?.src || background?.renderer !== 'seed-man-authored-flat-background-v1' || background?.world !== world || background?.temporaryFlattened !== true) {
      throw new Error(`Missing authored transition background: ${world}`);
    }
    for (const role of WORLD_LAYER_ROLES) {
      const layer = manifest.assets?.[`world.${world}.${role}`];
      if (layer?.renderer !== manifest.policy.worldRendererTarget || layer?.world !== world || layer?.status !== 'needed') {
        throw new Error(`Missing final seven-layer world target descriptor: ${world}.${role}`);
      }
    }
  }
  for (const phenotype of ['plant','fire','electric','ice']) if (!manifest.phenotypes?.includes(phenotype)) throw new Error(`Missing Seed Man phenotype: ${phenotype}`);
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
    characterTarget: manifest.policy.characterReference,
    worldRenderer: manifest.policy.worldRendererTarget,
    worldRendererTarget: manifest.policy.worldRendererTarget,
    worldFallbackRenderer: manifest.policy.worldFallbackRenderer,
    finalWorldLayerCount: manifest.policy.finalWorldLayerCount,
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
