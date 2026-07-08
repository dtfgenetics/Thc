import { starterActionCards } from '../data/actionCards';

export type HighLandAssetKind = 'image' | 'audio' | 'data';

export type HighLandAssetManifestItem = {
  id: string;
  kind: HighLandAssetKind;
  path: string;
  required: boolean;
  placeholderAllowed: boolean;
  notes?: string;
};

const approvedHitCardArtAssets: HighLandAssetManifestItem[] = Array.from(new Set(
  starterActionCards
    .map((card) => card.imageSrc ?? card.sheetArt?.src)
    .filter((path): path is string => Boolean(path))
)).map((path, index) => ({
  id: `approved-hit-card-art-${index + 1}`,
  kind: 'image',
  path,
  required: true,
  placeholderAllowed: false,
  notes: 'Approved individual HIT card artwork displayed in the card reveal.'
}));

export const highLandAssetManifest: HighLandAssetManifestItem[] = [
  {
    id: 'board-background',
    kind: 'image',
    path: 'assets/images/board/high-land-board.png',
    required: true,
    placeholderAllowed: false,
    notes: 'Main High Land board art. Must align with boardPath coordinates.'
  },
  {
    id: 'path-overlay',
    kind: 'image',
    path: 'assets/high-land/board/path-overlay.png',
    required: false,
    placeholderAllowed: true,
    notes: 'Optional transparent path overlay if board art is separated from path geometry.'
  },
  {
    id: 'hit-card-fallback',
    kind: 'image',
    path: 'assets/images/cards/hit/fallback-hit-card.svg',
    required: true,
    placeholderAllowed: true,
    notes: 'Emergency fallback only; approved card art remains the normal reveal source.'
  },
  {
    id: 'player-token-set',
    kind: 'image',
    path: 'assets/high-land/tokens/player-tokens.png',
    required: false,
    placeholderAllowed: true,
    notes: 'Current fallback tokens are Phaser circles. Replace with transparent PNG tokens later.'
  },
  {
    id: 'background-loop',
    kind: 'audio',
    path: 'assets/high-land/audio/background-loop.mp3',
    required: true,
    placeholderAllowed: false
  },
  {
    id: 'dice-roll-sound',
    kind: 'audio',
    path: 'assets/high-land/audio/dice-roll.mp3',
    required: true,
    placeholderAllowed: false
  },
  {
    id: 'card-draw-sound',
    kind: 'audio',
    path: 'assets/high-land/audio/card-draw.mp3',
    required: true,
    placeholderAllowed: false
  },
  {
    id: 'move-tick-sound',
    kind: 'audio',
    path: 'assets/high-land/audio/move-tick.mp3',
    required: true,
    placeholderAllowed: false
  },
  {
    id: 'win-sound',
    kind: 'audio',
    path: 'assets/high-land/audio/win.mp3',
    required: true,
    placeholderAllowed: false
  },
  ...approvedHitCardArtAssets
];

export function getRequiredHighLandAssets(): HighLandAssetManifestItem[] {
  return highLandAssetManifest.filter((asset) => asset.required);
}

export function getDeploymentCriticalHighLandAssets(): HighLandAssetManifestItem[] {
  return highLandAssetManifest.filter((asset) => asset.required && !asset.placeholderAllowed);
}

export function getPlaceholderAllowedAssets(): HighLandAssetManifestItem[] {
  return highLandAssetManifest.filter((asset) => asset.placeholderAllowed);
}
