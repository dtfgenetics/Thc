import { gameAssetPath } from '../systems/assetPath';
import { highLandAssetManifest, type HighLandAssetManifestItem } from './highLandAssetManifest';

export type AssetPreflightResult = {
  valid: boolean;
  missingRequired: HighLandAssetManifestItem[];
  missingOptional: HighLandAssetManifestItem[];
  checked: HighLandAssetManifestItem[];
};

export async function runHighLandAssetPreflight(fetcher: typeof fetch = fetch): Promise<AssetPreflightResult> {
  const missingRequired: HighLandAssetManifestItem[] = [];
  const missingOptional: HighLandAssetManifestItem[] = [];

  await Promise.all(
    highLandAssetManifest.map(async (asset) => {
      const exists = await assetExists(asset, fetcher);
      if (exists) return;

      if (asset.required) {
        missingRequired.push(asset);
      } else {
        missingOptional.push(asset);
      }
    })
  );

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    checked: highLandAssetManifest
  };
}

export async function assetExists(asset: HighLandAssetManifestItem, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher(gameAssetPath(asset.path), { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export function formatAssetPreflightSummary(result: AssetPreflightResult): string {
  if (result.valid && result.missingOptional.length === 0) {
    return 'All High Land assets passed preflight.';
  }

  const required = result.missingRequired.map((asset) => asset.id).join(', ') || 'none';
  const optional = result.missingOptional.map((asset) => asset.id).join(', ') || 'none';
  return `Missing required assets: ${required}. Missing optional assets: ${optional}.`;
}
