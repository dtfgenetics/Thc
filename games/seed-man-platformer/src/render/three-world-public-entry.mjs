import {
  createThreeWorldRenderer,
  supportsSeedManWebGL
} from './three-world.mjs';

const API_VERSION = 'seed-man-three-public-v2';
const LEGACY_API_MARKER = 'seed-man-three-public-v1';

function createRenderer(options) {
  return createThreeWorldRenderer(options);
}

const api = Object.freeze({
  version: API_VERSION,
  legacyVersion: LEGACY_API_MARKER,
  createRenderer,
  supportsWebGL: supportsSeedManWebGL
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'SeedManThreeWorld', {
    value: api,
    enumerable: false,
    configurable: false,
    writable: false
  });
}

export { API_VERSION, LEGACY_API_MARKER, api, createRenderer, supportsSeedManWebGL };
