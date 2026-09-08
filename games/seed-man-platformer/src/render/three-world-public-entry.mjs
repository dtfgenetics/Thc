import {
  createThreeWorldRenderer,
  supportsSeedManWebGL
} from './three-world.mjs';
import {
  VISUAL_WORLD_KEYS,
  getCampaignVisualWorldMap,
  resolveVisualWorldKey
} from './visual-world-map.mjs';
import {
  VISUAL_WORLD_PALETTES,
  createVisualSceneStyle,
  getVisualWorldPalette
} from './visual-palette.mjs';

const API_VERSION = 'seed-man-three-public-v3';
const LEGACY_API_MARKER = 'seed-man-three-public-v1';

function createRenderer(options) {
  return createThreeWorldRenderer(options);
}

const visual = Object.freeze({
  version: 'seed-man-visual-world-api-v1',
  worldKeys: VISUAL_WORLD_KEYS,
  palettes: VISUAL_WORLD_PALETTES,
  campaignMap: getCampaignVisualWorldMap(),
  resolveWorld: resolveVisualWorldKey,
  getPalette: getVisualWorldPalette,
  createSceneStyle: createVisualSceneStyle
});

const api = Object.freeze({
  version: API_VERSION,
  legacyVersion: LEGACY_API_MARKER,
  createRenderer,
  supportsWebGL: supportsSeedManWebGL,
  visual
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'SeedManThreeWorld', {
    value: api,
    enumerable: false,
    configurable: false,
    writable: false
  });
}

export {
  API_VERSION,
  LEGACY_API_MARKER,
  api,
  createRenderer,
  supportsSeedManWebGL,
  visual
};
