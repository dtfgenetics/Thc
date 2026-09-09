const REQUIRED_WORLDS = Object.freeze([
  'greenhouse-valley',
  'forest-ruins',
  'desert-canyon',
  'frozen-peaks',
  'eco-city'
]);

const WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });
const REQUIRED_PHENOTYPES = Object.freeze(['plant', 'fire', 'electric', 'ice']);
const REQUIRED_LAYER_KEYS = Object.freeze(['sky', 'far-bg', 'mid-bg', 'near-bg', 'gameplay', 'foreground', 'vfx']);
const APPROVED_CHARACTER_CONTRACT = 'approved-green-armored-plant-hero-v1';

function assert(condition, message) {
  if (!condition) throw new Error(`Seed Man visual runtime: ${message}`);
}

function canonicalWorldKey(worldKey) {
  return WORLD_ALIASES[worldKey] || worldKey;
}

export function validateVisualRuntime(config) {
  assert(config && typeof config === 'object', 'config must be an object');
  assert(config.version === 'seed-man-visual-runtime-v1', 'unsupported version');
  assert(config.reference?.characterContract === APPROVED_CHARACTER_CONTRACT, 'character contract must match approved production hero');

  for (const worldKey of REQUIRED_WORLDS) {
    const world = config.worlds?.[worldKey];
    assert(world, `missing world ${worldKey}`);
    assert(typeof world.label === 'string' && world.label.length > 0, `${worldKey} needs a label`);
    assert(typeof world.accent === 'string' && /^#[0-9a-f]{6}$/i.test(world.accent), `${worldKey} needs a hex accent`);
    assert(Array.isArray(world.layers) && world.layers.length === REQUIRED_LAYER_KEYS.length, `${worldKey} needs ${REQUIRED_LAYER_KEYS.length} layers`);

    const actualLayerKeys = world.layers.map((entry) => typeof entry === 'string' ? entry : entry.key);
    for (const requiredLayer of REQUIRED_LAYER_KEYS) {
      assert(actualLayerKeys.includes(requiredLayer), `${worldKey} missing ${requiredLayer} layer`);
    }
  }

  for (const phenotypeKey of REQUIRED_PHENOTYPES) {
    const phenotype = config.player?.phenotypes?.[phenotypeKey];
    assert(phenotype, `missing phenotype ${phenotypeKey}`);
    assert(typeof phenotype.projectile === 'string' && phenotype.projectile.length > 0, `${phenotypeKey} needs projectile key`);
    assert(typeof phenotype.vfx === 'string' && phenotype.vfx.length > 0, `${phenotypeKey} needs VFX key`);
    if (phenotypeKey === 'plant') assert(phenotype.durationMs === 0, 'plant phenotype must be permanent/base');
    else assert(phenotype.durationMs === 30000, `${phenotypeKey} must use the 30-second temporary power contract`);
  }

  assert(config.assetPolicy?.publicApiUsesManifestKeys === true, 'manifest keys must be the public asset API');
  assert(config.assetPolicy?.allowRawFilenameReferences === false, 'raw filename references are forbidden');
  assert(config.assetPolicy?.collisionOwnedBySimulation === true, 'simulation must own collision');
  assert(config.assetPolicy?.rendererOwnsGameplayState === false, 'renderer may not own gameplay state');
  return config;
}

export function getWorldVisual(config, worldKey) {
  validateVisualRuntime(config);
  const key = canonicalWorldKey(worldKey);
  const world = config.worlds[key];
  assert(world, `unknown world ${worldKey}`);
  return world;
}

export function getPhenotypeVisual(config, phenotypeKey) {
  validateVisualRuntime(config);
  const phenotype = config.player.phenotypes[phenotypeKey];
  assert(phenotype, `unknown phenotype ${phenotypeKey}`);
  return phenotype;
}

export function buildParallaxPlan(config, worldKey) {
  const world = getWorldVisual(config, worldKey);
  return world.layers.map((layer, index) => {
    if (typeof layer === 'string') return { key: layer, depth: index * 20 - 80, parallax: layer === 'gameplay' || layer === 'vfx' ? 1 : 0.2 + (index * 0.14) };
    return { key: layer.key, depth: layer.depth, parallax: layer.parallax };
  });
}

export const VISUAL_RUNTIME_CONTRACT = Object.freeze({
  requiredWorlds: REQUIRED_WORLDS,
  requiredPhenotypes: REQUIRED_PHENOTYPES,
  requiredLayers: REQUIRED_LAYER_KEYS,
  phenotypeDurationMs: 30000,
  characterContract: APPROVED_CHARACTER_CONTRACT
});
