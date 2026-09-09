export const VISUAL_WORLD_PALETTES = Object.freeze({
  'greenhouse-valley': Object.freeze({
    sky: 0x8fd9f6,
    fog: 0xc7f1e6,
    far: 0x4f8c79,
    mid: 0x2f6c4f,
    near: 0x1f4a34,
    ground: 0x315f3f,
    top: 0x78d85d,
    accent: 0x69e55b,
    hazard: 0xef6a3f,
    fill: 0xa7d6ff
  }),
  'forest-ruins': Object.freeze({
    sky: 0x83c6da,
    fog: 0xb8d9c7,
    far: 0x315e50,
    mid: 0x234b3b,
    near: 0x17342a,
    ground: 0x3c4a32,
    top: 0x59b653,
    accent: 0x38c96a,
    hazard: 0xb94a42,
    fill: 0x90c7ff
  }),
  'desert-canyon': Object.freeze({
    sky: 0xf2b37b,
    fog: 0xe9c6a0,
    far: 0xb6603e,
    mid: 0x8f442f,
    near: 0x613126,
    ground: 0x8a5035,
    top: 0xd77b42,
    accent: 0xff8b42,
    hazard: 0xff4a2f,
    fill: 0xffd2a1
  }),
  'frozen-peaks': Object.freeze({
    sky: 0xa6ddff,
    fog: 0xd9f3ff,
    far: 0x769fca,
    mid: 0x567aa8,
    near: 0x344e78,
    ground: 0x5d7392,
    top: 0xc2efff,
    accent: 0x54cfff,
    hazard: 0x685dff,
    fill: 0xd7f5ff
  }),
  'eco-city': Object.freeze({
    sky: 0x91dcff,
    fog: 0xcff4ef,
    far: 0x5c9d91,
    mid: 0x39756e,
    near: 0x244d49,
    ground: 0x3a6255,
    top: 0x79d97a,
    accent: 0x70f27b,
    hazard: 0xe55757,
    fill: 0xb5e8ff
  })
});

const WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });

export function getVisualWorldPalette(worldKey) {
  const canonicalWorldKey = WORLD_ALIASES[worldKey] || worldKey;
  const palette = VISUAL_WORLD_PALETTES[canonicalWorldKey];
  if (!palette) throw new Error(`Unknown Seed Man visual world palette: ${worldKey}`);
  return palette;
}

export function createVisualSceneStyle(worldKey) {
  const canonicalWorldKey = WORLD_ALIASES[worldKey] || worldKey;
  const palette = getVisualWorldPalette(canonicalWorldKey);
  return Object.freeze({
    worldKey: canonicalWorldKey,
    background: palette.sky,
    fog: { color: palette.fog, near: 11, far: 31 },
    hemisphere: { sky: 0xe8fff2, ground: palette.ground, intensity: 2.25 },
    keyLight: { color: 0xfff0cb, intensity: 3.6 },
    fillLight: { color: palette.fill, intensity: 1.05 },
    rimLight: { color: palette.accent, intensity: 0.58 },
    platform: { body: palette.ground, top: palette.top },
    hazard: palette.hazard,
    accent: palette.accent
  });
}
