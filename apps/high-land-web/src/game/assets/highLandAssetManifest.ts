export type HighLandAssetKind = 'image' | 'audio' | 'data';

export type HighLandAssetManifestItem = {
  id: string;
  kind: HighLandAssetKind;
  path: string;
  required: boolean;
  placeholderAllowed: boolean;
  notes?: string;
};

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
    id: 'hit-card-back',
    kind: 'image',
    path: 'assets/high-land/cards/hit-card-back.png',
    required: true,
    placeholderAllowed: true
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
  }
];

export function getRequiredHighLandAssets(): HighLandAssetManifestItem[] {
  return highLandAssetManifest.filter((asset) => asset.required);
}

export function getPlaceholderAllowedAssets(): HighLandAssetManifestItem[] {
  return highLandAssetManifest.filter((asset) => asset.placeholderAllowed);
}
