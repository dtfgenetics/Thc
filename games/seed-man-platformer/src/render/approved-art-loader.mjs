import { createApprovedArtRegistry, validateApprovedArtManifest } from './art-registry.mjs';

export async function loadApprovedArtManifest({
  manifestUrl = './data/seed-man-art-manifest-v1.json',
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Seed Man art loader requires fetch.');
  const response = await fetchImpl(manifestUrl, { cache: 'no-store' });
  if (!response?.ok) throw new Error(`Seed Man art manifest failed to load: ${response?.status || 'unknown'}`);
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
  const imageEntries = registry.keys()
    .map((key) => [key, registry.get(key)])
    .filter(([, asset]) => asset?.url && (asset.type === 'image' || asset.type === 'atlas' || /\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?|$)/i.test(asset.url)));

  await Promise.all(imageEntries.map(([key, asset]) => new Promise((resolve) => {
    const image = imageFactory();
    image.decoding = 'async';
    image.onload = () => {
      images.set(key, image);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = asset.url;
  })));

  return Object.freeze({ manifest, registry, images });
}

export function assertApprovedArtReady(bundle) {
  if (!bundle?.registry || !bundle?.images) throw new Error('Seed Man art bundle is not initialized.');
  return true;
}

export const APPROVED_ART_REQUIRED_IMAGE_KEYS = Object.freeze([]);
export const APPROVED_ART_REQUIRED_DESCRIPTOR_KEYS = Object.freeze([]);
export const APPROVED_ART_REQUIRED_KEYS = Object.freeze([]);
