const DEFAULT_PIXELS_PER_UNIT = 80;
const DEFAULT_VIEWPORT = Object.freeze({ width: 960, height: 540 });

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number`);
  return number;
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label);
  if (number <= 0) throw new Error(`${label} must be greater than zero`);
  return number;
}

function normalizeRect(rect, label) {
  if (!rect || typeof rect !== 'object') throw new Error(`${label} must be an object`);
  return {
    id: typeof rect.id === 'string' && rect.id ? rect.id : label,
    x: finiteNumber(rect.x, `${label}.x`),
    y: finiteNumber(rect.y, `${label}.y`),
    width: positiveNumber(rect.width, `${label}.width`),
    height: positiveNumber(rect.height, `${label}.height`)
  };
}

export function gameRectToWorldBox(rect, worldHeight, options = {}) {
  const source = normalizeRect(rect, options.label || 'rect');
  const pixelsPerUnit = positiveNumber(options.pixelsPerUnit || DEFAULT_PIXELS_PER_UNIT, 'pixelsPerUnit');
  const depth = positiveNumber(options.depth || 0.7, 'depth');
  const z = finiteNumber(options.z || 0, 'z');
  const height = positiveNumber(worldHeight, 'worldHeight');

  return {
    id: source.id,
    position: {
      x: (source.x + source.width / 2) / pixelsPerUnit,
      y: (height - (source.y + source.height / 2)) / pixelsPerUnit,
      z
    },
    size: {
      x: source.width / pixelsPerUnit,
      y: source.height / pixelsPerUnit,
      z: depth
    },
    source
  };
}

export function gamePointToWorld(point, worldHeight, options = {}) {
  if (!point || typeof point !== 'object') throw new Error('point must be an object');
  const pixelsPerUnit = positiveNumber(options.pixelsPerUnit || DEFAULT_PIXELS_PER_UNIT, 'pixelsPerUnit');
  const height = positiveNumber(worldHeight, 'worldHeight');
  return {
    x: finiteNumber(point.x, 'point.x') / pixelsPerUnit,
    y: (height - finiteNumber(point.y, 'point.y')) / pixelsPerUnit,
    z: finiteNumber(options.z || 0, 'z')
  };
}

function rectList(value, label, worldHeight, options) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((rect, index) => gameRectToWorldBox(rect, worldHeight, {
    ...options,
    label: `${label}[${index}]`
  }));
}

function checkpointList(level, pixelsPerUnit) {
  const checkpoints = Array.isArray(level.checkpoints)
    ? level.checkpoints
    : level.checkpoint
      ? [level.checkpoint]
      : [];
  return checkpoints.map((checkpoint, index) => gameRectToWorldBox(checkpoint, level.worldHeight, {
    label: `checkpoints[${index}]`,
    pixelsPerUnit,
    depth: 0.3,
    z: 0.42
  }));
}

export function buildThreeWorldDescriptor(level, options = {}) {
  if (!level || typeof level !== 'object') throw new Error('level is required');
  const pixelsPerUnit = positiveNumber(options.pixelsPerUnit || DEFAULT_PIXELS_PER_UNIT, 'pixelsPerUnit');
  const worldWidth = positiveNumber(level.worldWidth, 'level.worldWidth');
  const worldHeight = positiveNumber(level.worldHeight, 'level.worldHeight');

  const platforms = rectList(level.platforms || [], 'platforms', worldHeight, {
    pixelsPerUnit,
    depth: 0.85,
    z: 0
  });
  const hazards = rectList(level.hazards || [], 'hazards', worldHeight, {
    pixelsPerUnit,
    depth: 0.55,
    z: 0.18
  });
  const checkpoints = checkpointList(level, pixelsPerUnit);
  const finish = level.finish
    ? gameRectToWorldBox(level.finish, worldHeight, {
      label: 'finish',
      pixelsPerUnit,
      depth: 0.35,
      z: 0.4
    })
    : null;

  return {
    version: 'seed-man-three-world-v1',
    pixelsPerUnit,
    world: {
      widthPixels: worldWidth,
      heightPixels: worldHeight,
      width: worldWidth / pixelsPerUnit,
      height: worldHeight / pixelsPerUnit
    },
    platforms,
    hazards,
    checkpoints,
    finish
  };
}

export function buildThreeCameraState({
  cameraX = 0,
  viewportWidth = DEFAULT_VIEWPORT.width,
  viewportHeight = DEFAULT_VIEWPORT.height,
  worldHeight = DEFAULT_VIEWPORT.height,
  pixelsPerUnit = DEFAULT_PIXELS_PER_UNIT
} = {}) {
  const ppu = positiveNumber(pixelsPerUnit, 'pixelsPerUnit');
  const width = positiveNumber(viewportWidth, 'viewportWidth');
  const height = positiveNumber(viewportHeight, 'viewportHeight');
  const levelHeight = positiveNumber(worldHeight, 'worldHeight');
  const left = finiteNumber(cameraX, 'cameraX');

  return {
    center: {
      x: (left + width / 2) / ppu,
      y: levelHeight / ppu / 2,
      z: 0
    },
    visible: {
      width: width / ppu,
      height: height / ppu
    },
    aspect: width / height
  };
}

export function buildPlayerLightState(player, worldHeight, options = {}) {
  if (!player || typeof player !== 'object') return null;
  const width = positiveNumber(player.width, 'player.width');
  const height = positiveNumber(player.height, 'player.height');
  return gamePointToWorld({
    x: finiteNumber(player.x, 'player.x') + width / 2,
    y: finiteNumber(player.y, 'player.y') + height / 2
  }, worldHeight, {
    pixelsPerUnit: options.pixelsPerUnit || DEFAULT_PIXELS_PER_UNIT,
    z: options.z ?? 2.2
  });
}

export const THREE_WORLD_DEFAULTS = Object.freeze({
  pixelsPerUnit: DEFAULT_PIXELS_PER_UNIT,
  viewport: DEFAULT_VIEWPORT
});
