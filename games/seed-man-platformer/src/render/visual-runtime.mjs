const DEFAULT_WORLDS = Object.freeze([
  'greenhouse-valley',
  'forest-ruins',
  'desert-canyon',
  'frozen-peaks',
  'eco-city'
]);

const WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });
const DEFAULT_PHENOTYPES = Object.freeze(['plant', 'fire', 'electric', 'ice']);
const DEFAULT_LAYER_KEYS = Object.freeze(['sky', 'far-bg', 'mid-bg', 'near-bg', 'gameplay', 'foreground', 'vfx']);

function assert(condition, message) {
  if (!condition) throw new Error(`Seed Man visual runtime: ${message}`);
}

function canonicalWorldKey(worldKey) {
  return WORLD_ALIASES[worldKey] || worldKey;
}

export function validateVisualRuntime(config) {
  assert(config && typeof config === 'object', 'config must be an object');
  if (config.worlds != null) assert(typeof config.worlds === 'object' && !Array.isArray(config.worlds), 'worlds must be an object when provided');
  if (config.player?.phenotypes != null) assert(typeof config.player.phenotypes === 'object' && !Array.isArray(config.player.phenotypes), 'phenotypes must be an object when provided');
  if (config.assetPolicy != null) assert(typeof config.assetPolicy === 'object' && !Array.isArray(config.assetPolicy), 'assetPolicy must be an object when provided');

  for (const [worldKey, world] of Object.entries(config.worlds || {})) {
    assert(world && typeof world === 'object', `${worldKey} world entry must be an object`);
    if (world.label != null) assert(typeof world.label === 'string', `${worldKey} label must be a string`);
    if (world.accent != null) assert(typeof world.accent === 'string', `${worldKey} accent must be a string`);
    if (world.layers != null) assert(Array.isArray(world.layers), `${worldKey} layers must be an array`);
  }

  for (const [phenotypeKey, phenotype] of Object.entries(config.player?.phenotypes || {})) {
    assert(phenotype && typeof phenotype === 'object', `${phenotypeKey} phenotype must be an object`);
    if (phenotype.durationMs != null) assert(Number.isFinite(phenotype.durationMs) && phenotype.durationMs >= 0, `${phenotypeKey} durationMs must be a non-negative number`);
  }

  return config;
}

export function getWorldVisual(config, worldKey) {
  validateVisualRuntime(config);
  const key = canonicalWorldKey(worldKey);
  const world = config.worlds?.[key];
  assert(world, `unknown world ${worldKey}`);
  return world;
}

export function getPhenotypeVisual(config, phenotypeKey) {
  validateVisualRuntime(config);
  const phenotype = config.player?.phenotypes?.[phenotypeKey];
  assert(phenotype, `unknown phenotype ${phenotypeKey}`);
  return phenotype;
}

export function buildParallaxPlan(config, worldKey) {
  const world = getWorldVisual(config, worldKey);
  const layers = Array.isArray(world.layers) ? world.layers : [];
  return layers.map((layer, index) => {
    if (typeof layer === 'string') return { key: layer, depth: index * 20 - 80, parallax: layer === 'gameplay' || layer === 'vfx' ? 1 : 0.2 + (index * 0.14) };
    return { key: layer.key, depth: layer.depth, parallax: layer.parallax };
  });
}

export const VISUAL_RUNTIME_CONTRACT = Object.freeze({
  defaultWorlds: DEFAULT_WORLDS,
  defaultPhenotypes: DEFAULT_PHENOTYPES,
  defaultLayers: DEFAULT_LAYER_KEYS,
  characterContract: null,
  locked: false
});
