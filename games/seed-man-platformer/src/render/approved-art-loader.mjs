import { createApprovedArtRegistry, validateApprovedArtManifest } from './art-registry.mjs';

const REQUIRED_ASSET_KEYS = Object.freeze([
  'cover.main',
  'character.seedman.atlas',
  'enemy.atlas',
  'boss.atlas',
  'platform.atlas',
  'ui.vfx.cover',
  'world.greenhouse-valley.background',
  'world.forest-ruins.background',
  'world.desert-canyon.background',
  'world.frozen-peaks.background',
  'world.eco-city.background'
]);

export async function loadApprovedArtManifest({
  manifestUrl = './data/seed-man-art-manifest-v1.json',
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Seed Man approved art loader requires fetch.');
  const response = await fetchImpl(manifestUrl, { cache: 'no-store' });
  if (!response?.ok) throw new Error(`Seed Man approved art manifest failed to load: ${response?.status || 'unknown'}`);
  const manifest = await response.json();
  validateApprovedArtManifest(manifest);
  return manifest;
}

export async function preloadApprovedArt({
  manifestUrl = './data/seed-man-art-manifest-v1.json',
  baseUrl = './',
  imageFactory = () => new Image(),
  fetchImpl = globalThis.fetch
} = {}) {
  const manifest = await loadApprovedArtManifest({ manifestUrl, fetchImpl });
  const registry = createApprovedArtRegistry(manifest, { baseUrl });
  const images = new Map();

  await Promise.all(REQUIRED_ASSET_KEYS.map((key) => new Promise((resolve, reject) => {
    const asset = registry.get(key);
    const image = imageFactory();
    image.decoding = 'async';
    image.onload = () => {
      images.set(key, image);
      resolve();
    };
    image.onerror = () => reject(new Error(`Approved Seed Man art failed to load: ${key} -> ${asset.url}`));
    image.src = asset.url;
  })));

  return Object.freeze({ manifest, registry, images });
}

export function assertApprovedArtReady(bundle) {
  if (!bundle?.registry || !bundle?.images) throw new Error('Seed Man approved art bundle is not initialized.');
  for (const key of REQUIRED_ASSET_KEYS) {
    if (!bundle.registry.has(key)) throw new Error(`Seed Man approved art registry missing ${key}`);
    if (!bundle.images.has(key)) throw new Error(`Seed Man approved art image missing ${key}`);
  }
  return true;
}

export const APPROVED_ART_REQUIRED_KEYS = REQUIRED_ASSET_KEYS;
