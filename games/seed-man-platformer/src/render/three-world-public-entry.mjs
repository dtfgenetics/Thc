import {
  createThreeWorldRenderer,
  supportsSeedManWebGL
} from './three-world.mjs';

const API_VERSION = 'seed-man-three-public-v1';

function createRenderer(options) {
  return createThreeWorldRenderer(options);
}

const api = Object.freeze({
  version: API_VERSION,
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

export { API_VERSION, api, createRenderer, supportsSeedManWebGL };
