const POWER_TYPES = ['speed', 'shield', 'magnet', 'jump'];
const MECHANIC_TYPES = new Set(['bounce-pads','flow-zones','drag-zones','updraft-zones','boost-zones','heat-vents','gust-zones','slip-zones','wind-zones']);
const MIN_FINAL_LANDING = 260;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

export function validateCourseTemplate(template) {
  if (!template?.id || !template?.name || !template?.theme || !template?.setting) throw new Error('course template identity and setting are required');
  assertPositiveInteger(template.levelNumber, `${template.id}.levelNumber`);
  assertPositiveInteger(template.worldWidth, `${template.id}.worldWidth`);
  assertPositiveInteger(template.requiredPickups, `${template.id}.requiredPickups`);
  assertPositiveInteger(template.segmentLength, `${template.id}.segmentLength`);
  assertPositiveInteger(template.spikeCount, `${template.id}.spikeCount`);
  assertPositiveInteger(template.powerupCount, `${template.id}.powerupCount`);
  if (!template.palette?.sky || !template.palette?.ground || !template.palette?.accent || !template.palette?.hazard) throw new Error(`${template.id}.palette is incomplete`);
  if (!template.mechanic || !MECHANIC_TYPES.has(template.mechanic.type) || !Number.isInteger(template.mechanic.count) || template.mechanic.count < 1) throw new Error(`${template.id}.mechanic is invalid`);
  if (template.boss && (!template.boss.id || !template.boss.name || !Number.isInteger(template.boss.requiredHits) || template.boss.requiredHits < 2)) throw new Error(`${template.id}.boss is invalid`);
  if (!Array.isArray(template.gaps) || template.gaps.length < 2 || template.gaps.some((gap) => !Number.isFinite(gap) || gap < 70 || gap > 170)) throw new Error(`${template.id}.gaps must contain safe platformer gap widths`);
  if (!Array.isArray(template.elevations) || template.elevations.length < 4 || template.elevations.some((y) => !Number.isFinite(y) || y < 220 || y > 410)) throw new Error(`${template.id}.elevations must contain reachable platform heights`);
  if (!Array.isArray(template.checkpointFractions) || template.checkpointFractions.length < 2 || template.checkpointFractions.some((value) => !Number.isFinite(value) || value <= 0.15 || value >= 0.9)) throw new Error(`${template.id}.checkpointFractions must stay inside the course`);
  return template;
}

function groundPlatformsFor(template) {
  const platforms = [];
  const hazards = [];
  let x = 0;
  let gapIndex = 0;
  while (x < template.worldWidth) {
    const remaining = template.worldWidth - x;
    if (remaining <= template.segmentLength + MIN_FINAL_LANDING) {
      platforms.push({ x, y: 480, width: remaining, height: 60 });
      break;
    }

    const gap = template.gaps[gapIndex % template.gaps.length];
    const remainingAfterSegmentAndGap = remaining - template.segmentLength - gap;
    if (remainingAfterSegmentAndGap < MIN_FINAL_LANDING) {
      platforms.push({ x, y: 480, width: remaining, height: 60 });
      break;
    }

    platforms.push({ x, y: 480, width: template.segmentLength, height: 60 });
    hazards.push({ x: x + template.segmentLength, y: 500, width: gap, height: 40 });
    x += template.segmentLength + gap;
    gapIndex += 1;
  }
  return { platforms, hazards };
}

function upperPlatformsFor(template) {
  const platforms = template.elevations.map((y, index) => {
    const span = Math.max(1, template.elevations.length - 1);
    const x = Math.round(240 + index * ((template.worldWidth - 600) / span));
    return { x, y, width: 160 + (index % 3) * 20, height: 24 };
  });
  const extra = Math.max(0, Math.min(3, Number(template.extraHighPlatforms) || 0));
  for (let index = 0; index < extra; index += 1) {
    const fraction = extra === 1 ? 0.5 : 0.34 + index * (0.56 / (extra - 1));
    platforms.push({ x: Math.round(template.worldWidth * fraction), y: 220 - (index % 2) * 25, width: 150 - (index === 2 ? 5 : 0), height: 24 });
  }
  if (!template.boss) return platforms;

  const arenaStart = Math.round(template.worldWidth * 0.74) - 32;
  const arenaEnd = Math.round(template.worldWidth * 0.92) + 32;
  return platforms.filter((platform) => platform.x + platform.width <= arenaStart || platform.x >= arenaEnd);
}

function safeGroundX(groundPlatforms, desired, margin = 60) {
  const containing = groundPlatforms.find((platform) => platform.width >= margin * 2 && desired >= platform.x + margin && desired <= platform.x + platform.width - margin);
  if (containing) return Math.round(desired);
  const candidates = groundPlatforms.filter((platform) => platform.width >= margin * 2);
  if (!candidates.length) return Math.round(desired);
  candidates.sort((a, b) => Math.abs((a.x + a.width / 2) - desired) - Math.abs((b.x + b.width / 2) - desired));
  const platform = candidates[0];
  return Math.round(clamp(desired, platform.x + margin, platform.x + platform.width - margin));
}

function addSurfaceHazards(template, hazards) {
  for (let index = 0; index < template.spikeCount; index += 1) {
    const usable = Math.max(400, template.worldWidth - 1800);
    const x = template.spikeCount === 1 ? template.worldWidth / 2 : 980 + index * (usable / (template.spikeCount - 1));
    hazards.push({ x: Math.round(x), y: 452, width: 48 + (index % 2) * 10, height: 28 });
  }
}

function pickupsFor(template, groundPlatforms, upperPlatforms) {
  const pickups = [];
  for (const platform of upperPlatforms) {
    if (pickups.length >= template.requiredPickups) break;
    pickups.push({ id: `sprout-${String(template.levelNumber).padStart(2, '0')}-${String(pickups.length + 1).padStart(2, '0')}`, x: Math.round(platform.x + platform.width / 2 - 11), y: platform.y - 45, width: 22, height: 22 });
  }
  const remaining = template.requiredPickups - pickups.length;
  for (let index = 0; index < remaining; index += 1) {
    const desired = remaining === 1 ? template.worldWidth / 2 : 180 + index * ((template.worldWidth - 420) / (remaining - 1));
    pickups.push({ id: `sprout-${String(template.levelNumber).padStart(2, '0')}-${String(pickups.length + 1).padStart(2, '0')}`, x: safeGroundX(groundPlatforms, desired, 50), y: 425, width: 22, height: 22 });
  }
  return pickups;
}

function powerupsFor(template, groundPlatforms) {
  const powerups = [];
  for (let index = 0; index < template.powerupCount; index += 1) {
    const fraction = template.powerupCount === 1 ? 0.5 : 0.18 + index * (0.64 / (template.powerupCount - 1));
    const type = POWER_TYPES[(index + template.levelNumber) % POWER_TYPES.length];
    const powerup = { id: `power-${type}-${String(template.levelNumber).padStart(2, '0')}-${index + 1}`, type, x: safeGroundX(groundPlatforms, template.worldWidth * fraction, 55), y: 425, width: 28, height: 28 };
    if (type === 'speed') powerup.duration = 8;
    else if (type === 'magnet') powerup.duration = 11;
    else if (type === 'jump') powerup.duration = 10;
    powerups.push(powerup);
  }
  return powerups;
}

function checkpointsFor(template, groundPlatforms) {
  return template.checkpointFractions.map((fraction, index) => {
    const x = safeGroundX(groundPlatforms, template.worldWidth * fraction, 80);
    return { id: `checkpoint-${String(template.levelNumber).padStart(2, '0')}-${index + 1}`, x, y: 420, width: 50, height: 60, respawnX: Math.max(60, x - 20), respawnY: 400 };
  });
}

function mechanicZonesFor(template, groundPlatforms) {
  const count = template.mechanic.count;
  return Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? 0.5 : 0.16 + index * (0.68 / (count - 1));
    const x = safeGroundX(groundPlatforms, template.worldWidth * fraction, 90);
    const alternating = template.mechanic.alternate && index % 2 === 1 ? -1 : 1;
    return {
      id: `mechanic-${String(template.levelNumber).padStart(2, '0')}-${index + 1}`,
      type: template.mechanic.type,
      x,
      y: template.mechanic.type === 'bounce-pads' ? 462 : 360,
      width: template.mechanic.type === 'bounce-pads' ? 62 : 150,
      height: template.mechanic.type === 'bounce-pads' ? 18 : 120,
      strength: template.mechanic.strength || 0,
      forceX: (template.mechanic.forceX || 0) * alternating,
      forceY: template.mechanic.forceY || 0,
      drag: template.mechanic.drag || 1,
      boost: template.mechanic.boost || 1,
      maxSpeed: template.mechanic.maxSpeed || 0
    };
  });
}

function bossFor(template, groundPlatforms) {
  if (!template.boss) return null;
  const x = safeGroundX(groundPlatforms, template.worldWidth * 0.84, 150);
  const width = template.boss.width || 100;
  const height = template.boss.height || 90;
  return {
    ...template.boss,
    x: Math.round(x - width / 2),
    y: 480 - height,
    arenaStartX: Math.round(template.worldWidth * 0.74),
    arenaEndX: Math.round(template.worldWidth * 0.92),
    speed: 38 + template.difficulty * 4,
    defeated: false,
    hits: 0
  };
}

export function generateCourse(inputTemplate) {
  const template = validateCourseTemplate(inputTemplate);
  const ground = groundPlatformsFor(template);
  const upperPlatforms = upperPlatformsFor(template);
  const hazards = [...ground.hazards];
  addSurfaceHazards(template, hazards);
  const finishX = safeGroundX(ground.platforms, template.worldWidth - 90, 60);
  return {
    schemaVersion: 3,
    id: template.id,
    name: `Sprout Run: ${template.name}`,
    levelNumber: template.levelNumber,
    theme: template.theme,
    setting: template.setting,
    difficulty: template.difficulty,
    palette: { ...template.palette },
    worldWidth: template.worldWidth,
    worldHeight: 540,
    requiredPickups: template.requiredPickups,
    spawn: { x: 80, y: 390 },
    platforms: [...ground.platforms, ...upperPlatforms],
    hazards,
    pickups: pickupsFor(template, ground.platforms, upperPlatforms),
    powerups: powerupsFor(template, ground.platforms),
    checkpoints: checkpointsFor(template, ground.platforms),
    mechanicZones: mechanicZonesFor(template, ground.platforms),
    boss: bossFor(template, ground.platforms),
    finish: { x: finishX, y: 390, width: 50, height: 90 }
  };
}

export function generateCoursePack(pack) {
  if (!pack || pack.schemaVersion !== 2 || pack.generator !== 'seed-man-course-v2' || !Array.isArray(pack.levels)) throw new Error('Seed Man course pack contract mismatch');
  return pack.levels.map(generateCourse);
}
