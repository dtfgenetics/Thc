import path from 'node:path';

/** Resolve only direct raster children of the controlled infographics directory. */
export function resolveMappedVisualAsset(root, assetPath) {
  if (typeof assetPath !== 'string' || !assetPath.trim()) return null;
  if (path.isAbsolute(assetPath) || assetPath.includes('\\') || assetPath.includes('/') || assetPath === '.' || assetPath === '..') return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(assetPath)) return null;
  const resolved = path.resolve(root, assetPath);
  return path.dirname(resolved) === path.resolve(root) ? resolved : null;
}
