'use strict';

const SPROUT_CAMPAIGN_RUNTIME_VERSION = 'sprout-campaign-v3';
const SPROUT_CAMPAIGN_EXPERIENCE_VERSION = 'seed-man-campaign-experience-v3';
const SPROUT_ANIMATION_VERSION = 'seed-man-animation-v2';
const SPROUT_PROGRESS_KEY = 'dtf-seed-man-campaign-v3';
const SPROUT_BEST_PREFIX = 'dtf-seed-man-best-v3:';

const SPROUT_CAMPAIGN_MANIFEST = Object.freeze({
  schemaVersion: 2,
  id: 'sprout-run-campaign',
  title: 'Seed Man: Greenhouse Gauntlet',
  defaultLevelId: 'sprout-run',
  levelCount: 11,
  newLevelCount: 10,
  worlds: [
    { id: 'world-01', title: 'Greenhouse District', order: 1, levels: [
      { id: 'sprout-run', title: 'Greenhouse Gauntlet', order: 1, status: 'playable', dataPath: 'data/level-01.json' },
      { id: 'nursery-night-shift', title: 'Nursery Night Shift', order: 2, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'nursery-night-shift' },
      { id: 'reservoir-run', title: 'Reservoir Run', order: 3, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'reservoir-run', boss: 'The Phantom Pump' }
    ]},
    { id: 'world-02', title: 'Rootworks', order: 2, levels: [
      { id: 'root-zone-rumble', title: 'Root Zone Rumble', order: 4, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'root-zone-rumble' },
      { id: 'mycelium-mile', title: 'Mycelium Mile', order: 5, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'mycelium-mile' },
      { id: 'trichome-transit', title: 'Trichome Transit', order: 6, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'trichome-transit', boss: 'Mite Queen' }
    ]},
    { id: 'world-03', title: 'Resin Works', order: 3, levels: [
      { id: 'kief-cavern-climb', title: 'Kief Cavern Climb', order: 7, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'kief-cavern-climb' },
      { id: 'rosin-refinery-rush', title: 'Rosin Refinery Rush', order: 8, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'rosin-refinery-rush' },
      { id: 'terpene-tunnel', title: 'Terpene Tunnel', order: 9, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'terpene-tunnel', boss: 'Mildew Wraith' }
    ]},
    { id: 'world-04', title: 'Sky Garden', order: 4, levels: [
      { id: 'frostline-canopy', title: 'Frostline Canopy', order: 10, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'frostline-canopy' },
      { id: 'cloud-nine-citadel', title: 'Cloud Nine Citadel', order: 11, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'cloud-nine-citadel', boss: 'Pollen Warden' }
    ]}
  ]
});

const SPROUT_LEVEL_TEMPLATES = Object.freeze([
  {id:'nursery-night-shift',name:'Nursery Night Shift',levelNumber:2,theme:'nursery',setting:'Moonlit propagation nursery with glowing clone racks and mist lanes',difficulty:1,worldWidth:4200,requiredPickups:16,segmentLength:520,gaps:[90,100,90,110,95,100],elevations:[390,330,370,300,355,315],extraHighPlatforms:0,spikeCount:2,powerupCount:3,checkpointFractions:[0.34,0.68],palette:{sky:'#10172d',far:'#243653',ground:'#315943',accent:'#7cf4b5',hazard:'#ff7d7d'},mechanic:{type:'bounce-pads',count:3,strength:760}},
  {id:'reservoir-run',name:'Reservoir Run',levelNumber:3,theme:'hydro',setting:'Flooded hydro reservoir catwalks above rushing nutrient channels',difficulty:2,worldWidth:4400,requiredPickups:18,segmentLength:520,gaps:[100,110,95,120,100,110,95],elevations:[360,300,380,320,280,350,305],extraHighPlatforms:0,spikeCount:2,powerupCount:3,checkpointFractions:[0.34,0.68],palette:{sky:'#09243a',far:'#12627b',ground:'#315d68',accent:'#5be0ff',hazard:'#ff9e57'},mechanic:{type:'flow-zones',count:3,forceX:135,forceY:0},boss:{id:'phantom-pump',name:'The Phantom Pump',style:'pump',requiredHits:3,width:92,height:96,bounce:610,accent:'#69e8ff'}},
  {id:'root-zone-rumble',name:'Root Zone Rumble',levelNumber:4,theme:'root-zone',setting:'Oversized root maze beneath the pots with tangled bridges and packed media',difficulty:3,worldWidth:4600,requiredPickups:18,segmentLength:520,gaps:[100,120,110,100,125,105,115],elevations:[390,325,275,350,300,370,315],extraHighPlatforms:0,spikeCount:3,powerupCount:3,checkpointFractions:[0.34,0.68],palette:{sky:'#241a18',far:'#4f382c',ground:'#6a4c36',accent:'#a9d36e',hazard:'#ff805c'},mechanic:{type:'drag-zones',count:4,drag:0.82}},
  {id:'mycelium-mile',name:'Mycelium Mile',levelNumber:5,theme:'mycelium',setting:'Bioluminescent fungal undergarden with floating spores and mushroom lifts',difficulty:4,worldWidth:4800,requiredPickups:20,segmentLength:520,gaps:[110,100,120,110,130,105,120,95],elevations:[370,300,345,275,335,295,355,310],extraHighPlatforms:0,spikeCount:3,powerupCount:4,checkpointFractions:[0.34,0.68],palette:{sky:'#15132b',far:'#3b2c5d',ground:'#4f4960',accent:'#b38cff',hazard:'#ff77a8'},mechanic:{type:'updraft-zones',count:4,forceY:-210}},
  {id:'trichome-transit',name:'Trichome Transit',levelNumber:6,theme:'trichome',setting:'Crystal trichome rail yard with resin bridges and glittering gland towers',difficulty:5,worldWidth:5000,requiredPickups:20,segmentLength:520,gaps:[100,120,105,130,110,120,105,130],elevations:[360,285,335,260,320,290,350,275],extraHighPlatforms:0,spikeCount:4,powerupCount:4,checkpointFractions:[0.34,0.68],palette:{sky:'#18253a',far:'#42647a',ground:'#69797f',accent:'#d8fbff',hazard:'#ff6689'},mechanic:{type:'boost-zones',count:4,forceX:280,forceY:-25},boss:{id:'mite-queen',name:'Mite Queen',style:'mite',requiredHits:4,width:104,height:86,bounce:650,accent:'#ff708d'}},
  {id:'kief-cavern-climb',name:'Kief Cavern Climb',levelNumber:7,theme:'cavern',setting:'Golden kief cavern with crystal dust vents and steep ledge climbs',difficulty:6,worldWidth:5200,requiredPickups:22,segmentLength:480,gaps:[120,110,130,115,125,120,110,130,115],elevations:[380,315,250,330,270,350,285,240,325],extraHighPlatforms:2,spikeCount:4,powerupCount:4,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#1c1710',far:'#5a4524',ground:'#79623d',accent:'#f5d66d',hazard:'#ff784f'},mechanic:{type:'bounce-pads',count:4,strength:820}},
  {id:'rosin-refinery-rush',name:'Rosin Refinery Rush',levelNumber:8,theme:'refinery',setting:'Industrial rosin works with hot presses, warning lights and pressure vents',difficulty:7,worldWidth:5400,requiredPickups:22,segmentLength:480,gaps:[110,130,120,140,115,125,135,110,130],elevations:[360,300,345,275,320,255,335,285,350],extraHighPlatforms:2,spikeCount:5,powerupCount:5,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#231a18',far:'#55352f',ground:'#6a5148',accent:'#ffb45d',hazard:'#ff4f4f'},mechanic:{type:'heat-vents',count:4,forceY:-285}},
  {id:'terpene-tunnel',name:'Terpene Tunnel',levelNumber:9,theme:'terpene',setting:'Aromatic tunnel network with shifting vapor currents and neon terpene chambers',difficulty:8,worldWidth:5600,requiredPickups:24,segmentLength:480,gaps:[120,130,110,140,125,135,115,145,120,130],elevations:[350,275,330,250,305,280,340,260,315,285],extraHighPlatforms:3,spikeCount:5,powerupCount:5,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#17182f',far:'#433c78',ground:'#4e5371',accent:'#d28cff',hazard:'#ff647c'},mechanic:{type:'gust-zones',count:5,forceX:190,alternate:true},boss:{id:'mildew-wraith',name:'Mildew Wraith',style:'wraith',requiredHits:4,width:110,height:98,bounce:675,accent:'#d9e9d2'}},
  {id:'frostline-canopy',name:'Frostline Canopy',levelNumber:10,theme:'frost',setting:'High frozen canopy bridges coated in sparkling resin frost',difficulty:9,worldWidth:5800,requiredPickups:24,segmentLength:480,gaps:[125,140,120,135,145,125,140,120,135,145],elevations:[340,265,320,245,300,270,330,250,310,275],extraHighPlatforms:3,spikeCount:6,powerupCount:5,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#101d32',far:'#31546a',ground:'#526d78',accent:'#c9f6ff',hazard:'#fe6f8a'},mechanic:{type:'slip-zones',count:5,boost:1.018,maxSpeed:390}},
  {id:'cloud-nine-citadel',name:'Cloud Nine Citadel',levelNumber:11,theme:'citadel',setting:'Floating sky garden fortress above the clouds with wind bridges and the final gate',difficulty:10,worldWidth:6200,requiredPickups:26,segmentLength:480,gaps:[130,145,125,150,135,140,130,150,125,145,135],elevations:[330,250,310,235,295,260,320,240,300,250,285],extraHighPlatforms:3,spikeCount:6,powerupCount:6,checkpointFractions:[0.28,0.55,0.8],palette:{sky:'#16233f',far:'#526b9a',ground:'#667a91',accent:'#ffe27a',hazard:'#ff6681'},mechanic:{type:'wind-zones',count:6,forceX:220,alternate:true},boss:{id:'pollen-warden',name:'Pollen Warden',style:'warden',requiredHits:5,width:118,height:108,bounce:710,accent:'#ffe27a'}}
]);

function flattenCampaignLevels(campaign) {
  return campaign.worlds.flatMap((world) => world.levels.map((entry) => ({ ...entry, worldId: world.id, worldTitle: world.title, worldOrder: world.order })));
}

function validateCampaign(campaign) {
  if (!campaign || campaign.schemaVersion !== 2 || campaign.id !== 'sprout-run-campaign') throw new Error('campaign contract mismatch');
  const levels = flattenCampaignLevels(campaign);
  if (campaign.worlds.length !== 4 || levels.length !== 11 || campaign.levelCount !== 11 || campaign.newLevelCount !== 10) throw new Error('campaign must contain four worlds and eleven levels');
  const ids = new Set();
  levels.forEach((entry, index) => {
    if (!entry.id || ids.has(entry.id) || entry.status !== 'playable' || entry.order !== index + 1) throw new Error('invalid campaign level ordering');
    ids.add(entry.id);
  });
  return campaign;
}

function createCampaignRuntime(campaign) {
  const manifest = validateCampaign(campaign);
  const levels = flattenCampaignLevels(manifest);
  let activeLevelId = manifest.defaultLevelId;
  return Object.freeze({
    version: SPROUT_CAMPAIGN_RUNTIME_VERSION,
    campaignId: manifest.id,
    defaultLevelId: manifest.defaultLevelId,
    levelCount: levels.length,
    newLevelCount: manifest.newLevelCount,
    worlds: Object.freeze(manifest.worlds.map((world) => Object.freeze({ ...world }))),
    listLevels: () => levels.map((entry) => ({ ...entry })),
    getLevel: (id = activeLevelId) => levels.find((entry) => entry.id === id) || null,
    get activeLevelId() { return activeLevelId; },
    selectLevel(id) {
      const entry = levels.find((candidate) => candidate.id === id);
      if (!entry || entry.status !== 'playable') throw new Error(`campaign level is not playable: ${id}`);
      activeLevelId = id;
      window.dispatchEvent(new CustomEvent('sprout:level-selected', { detail: { levelId: id, level: { ...entry } } }));
      return { ...entry };
    }
  });
}

try {
  const manifestNode = document.querySelector('#seed-man-campaign');
  if (manifestNode) manifestNode.textContent = JSON.stringify(SPROUT_CAMPAIGN_MANIFEST);
  window.__SPROUT_CAMPAIGN__ = createCampaignRuntime(SPROUT_CAMPAIGN_MANIFEST);
  document.documentElement.dataset.sproutCampaign = SPROUT_CAMPAIGN_MANIFEST.id;
  document.documentElement.dataset.sproutCampaignLevels = '11';
} catch (error) {
  console.error('Seed Man campaign manifest failed to initialize.', error);
}

window.addEventListener('load', () => {
  try {
    if (typeof level === 'undefined' || typeof player === 'undefined' || typeof reset !== 'function' || typeof stepPlayer !== 'function' || typeof render !== 'function') {
      throw new Error('base Sprout Run runtime is unavailable');
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const rectsOverlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    const centerDistanceLocal = (a, b) => Math.hypot((a.x + a.width / 2) - (b.x + b.width / 2), (a.y + a.height / 2) - (b.y + b.height / 2));
    const powerTypes = ['speed', 'shield', 'magnet', 'jump'];

    function groundPlatformsFor(template) {
      const platforms = [], hazards = [];
      let x = 0, gapIndex = 0;
      while (x < template.worldWidth) {
        const remaining = template.worldWidth - x;
        if (remaining <= template.segmentLength) { platforms.push({ x, y: 480, width: remaining, height: 60 }); break; }
        platforms.push({ x, y: 480, width: template.segmentLength, height: 60 });
        const gap = template.gaps[gapIndex % template.gaps.length];
        hazards.push({ x: x + template.segmentLength, y: 500, width: gap, height: 40 });
        x += template.segmentLength + gap;
        gapIndex += 1;
      }
      return { platforms, hazards };
    }

    function upperPlatformsFor(template) {
      const platforms = template.elevations.map((y, index) => ({
        x: Math.round(240 + index * ((template.worldWidth - 600) / Math.max(1, template.elevations.length - 1))),
        y,
        width: 160 + (index % 3) * 20,
        height: 24
      }));
      for (let index = 0; index < Math.max(0, Math.min(3, template.extraHighPlatforms || 0)); index += 1) {
        const count = Math.max(1, template.extraHighPlatforms || 0);
        const fraction = count === 1 ? 0.5 : 0.34 + index * (0.56 / Math.max(1, count - 1));
        platforms.push({ x: Math.round(template.worldWidth * fraction), y: 220 - (index % 2) * 25, width: 150 - (index === 2 ? 5 : 0), height: 24 });
      }
      return platforms;
    }

    function safeGroundX(platforms, desired, margin = 60) {
      const containing = platforms.find((platform) => platform.width >= margin * 2 && desired >= platform.x + margin && desired <= platform.x + platform.width - margin);
      if (containing) return Math.round(desired);
      const candidates = platforms.filter((platform) => platform.width >= margin * 2).sort((a, b) => Math.abs((a.x + a.width / 2) - desired) - Math.abs((b.x + b.width / 2) - desired));
      if (!candidates.length) return Math.round(desired);
      const platform = candidates[0];
      return Math.round(clamp(desired, platform.x + margin, platform.x + platform.width - margin));
    }

    function generateCourse(template) {
      const ground = groundPlatformsFor(template);
      const upper = upperPlatformsFor(template);
      const hazards = [...ground.hazards];
      for (let index = 0; index < template.spikeCount; index += 1) {
        const usable = Math.max(400, template.worldWidth - 1800);
        const x = template.spikeCount === 1 ? template.worldWidth / 2 : 980 + index * (usable / Math.max(1, template.spikeCount - 1));
        hazards.push({ x: Math.round(x), y: 452, width: 48 + (index % 2) * 10, height: 28 });
      }
      const pickups = [];
      for (const platform of upper) {
        if (pickups.length >= template.requiredPickups) break;
        pickups.push({ id: `sprout-${String(template.levelNumber).padStart(2,'0')}-${String(pickups.length + 1).padStart(2,'0')}`, x: Math.round(platform.x + platform.width / 2 - 11), y: platform.y - 45, width: 22, height: 22 });
      }
      const groundPickupCount = template.requiredPickups - pickups.length;
      for (let index = 0; index < groundPickupCount; index += 1) {
        const desired = groundPickupCount === 1 ? template.worldWidth / 2 : 180 + index * ((template.worldWidth - 420) / Math.max(1, groundPickupCount - 1));
        pickups.push({ id: `sprout-${String(template.levelNumber).padStart(2,'0')}-${String(pickups.length + 1).padStart(2,'0')}`, x: safeGroundX(ground.platforms, desired, 50), y: 425, width: 22, height: 22 });
      }
      const powerups = Array.from({ length: template.powerupCount }, (_, index) => {
        const fraction = template.powerupCount === 1 ? 0.5 : 0.18 + index * (0.64 / Math.max(1, template.powerupCount - 1));
        const type = powerTypes[(index + template.levelNumber) % powerTypes.length];
        const item = { id: `power-${type}-${String(template.levelNumber).padStart(2,'0')}-${index + 1}`, type, x: safeGroundX(ground.platforms, template.worldWidth * fraction, 55), y: 425, width: 28, height: 28 };
        if (type === 'speed') item.duration = 8;
        else if (type === 'magnet') item.duration = 11;
        else if (type === 'jump') item.duration = 10;
        return item;
      });
      const checkpoints = template.checkpointFractions.map((fraction, index) => {
        const x = safeGroundX(ground.platforms, template.worldWidth * fraction, 80);
        return { id: `checkpoint-${String(template.levelNumber).padStart(2,'0')}-${index + 1}`, x, y: 420, width: 50, height: 60, respawnX: Math.max(60, x - 20), respawnY: 400 };
      });
      const mechanicZones = Array.from({ length: template.mechanic.count }, (_, index) => {
        const fraction = template.mechanic.count === 1 ? 0.5 : 0.16 + index * (0.68 / Math.max(1, template.mechanic.count - 1));
        const x = safeGroundX(ground.platforms, template.worldWidth * fraction, 90);
        const direction = template.mechanic.alternate && index % 2 === 1 ? -1 : 1;
        return {
          id: `mechanic-${String(template.levelNumber).padStart(2,'0')}-${index + 1}`,
          type: template.mechanic.type,
          x,
          y: template.mechanic.type === 'bounce-pads' ? 462 : 360,
          width: template.mechanic.type === 'bounce-pads' ? 62 : 150,
          height: template.mechanic.type === 'bounce-pads' ? 18 : 120,
          strength: template.mechanic.strength || 0,
          forceX: (template.mechanic.forceX || 0) * direction,
          forceY: template.mechanic.forceY || 0,
          drag: template.mechanic.drag || 1,
          boost: template.mechanic.boost || 1,
          maxSpeed: template.mechanic.maxSpeed || 0
        };
      });
      let boss = null;
      if (template.boss) {
        const center = safeGroundX(ground.platforms, template.worldWidth * 0.84, 150);
        boss = {
          ...template.boss,
          x: Math.round(center - template.boss.width / 2),
          y: 480 - template.boss.height,
          arenaStartX: Math.round(template.worldWidth * 0.74),
          arenaEndX: Math.round(template.worldWidth * 0.92),
          speed: 38 + template.difficulty * 4,
          defeated: false,
          hits: 0
        };
      }
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
        platforms: [...ground.platforms, ...upper],
        hazards,
        pickups,
        powerups,
        checkpoints,
        mechanicZones,
        boss,
        finish: { x: safeGroundX(ground.platforms, template.worldWidth - 90, 60), y: 390, width: 50, height: 90 }
      };
    }

    const generatedLevels = new Map(SPROUT_LEVEL_TEMPLATES.map((template) => [template.id, generateCourse(template)]));
    const campaignEntries = window.__SPROUT_CAMPAIGN__.listLevels();
    const levelById = new Map(campaignEntries.map((entry) => [entry.id, entry]));
    let activeBoss = null;
    let motionImpact = 0;
    let bossFlash = 0;

    function readProgress() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SPROUT_PROGRESS_KEY) || '{}');
        return { completed: Array.isArray(parsed.completed) ? parsed.completed.filter((id) => levelById.has(id)) : [], best: parsed.best && typeof parsed.best === 'object' ? parsed.best : {} };
      } catch { return { completed: [], best: {} }; }
    }

    function writeProgress(progress) {
      try { localStorage.setItem(SPROUT_PROGRESS_KEY, JSON.stringify(progress)); } catch {}
    }

    let campaignProgress = readProgress();

    function generatedLevelFor(id) {
      if (id === 'sprout-run') return readEmbeddedLevel();
      const generated = generatedLevels.get(id);
      if (!generated) throw new Error(`generated level missing: ${id}`);
      return JSON.parse(JSON.stringify(generated));
    }

    function checkpointList(levelData) {
      return Array.isArray(levelData.checkpoints) ? levelData.checkpoints : [];
    }

    function pickupRequirement(levelData) {
      const explicit = Number(levelData.requiredPickups);
      return Number.isInteger(explicit) && explicit >= 0 ? explicit : levelData.pickups.length;
    }

    function collectPower(next, powerup) {
      if (next.collectedPowerups.includes(powerup.id)) return;
      next.collectedPowerups.push(powerup.id);
      if (powerup.type === 'speed') next.power.speedTimer = Math.max(next.power.speedTimer, Number(powerup.duration) || 8);
      else if (powerup.type === 'jump') next.power.jumpTimer = Math.max(next.power.jumpTimer, Number(powerup.duration) || 10);
      else if (powerup.type === 'magnet') next.power.magnetTimer = Math.max(next.power.magnetTimer, Number(powerup.duration) || 10);
      else if (powerup.type === 'shield') next.power.shieldCharges = Math.min(2, next.power.shieldCharges + 1);
    }

    function collideX(next, platform) {
      if (!rectsOverlap(next, platform)) return;
      if (next.vx > 0) next.x = platform.x - next.width;
      else if (next.vx < 0) next.x = platform.x + platform.width;
      next.vx = 0;
    }

    function collideY(next, platform, config) {
      if (!rectsOverlap(next, platform)) return;
      if (next.vy > 0) {
        next.y = platform.y - next.height;
        next.vy = 0;
        next.grounded = true;
        next.airJumpsRemaining = config.maxAirJumps;
      } else if (next.vy < 0) {
        next.y = platform.y + platform.height;
        next.vy = 0;
      }
    }

    function respawnGenerated(next, config) {
      next.x = next.checkpoint.x;
      next.y = next.checkpoint.y;
      next.vx = 0;
      next.vy = 0;
      next.grounded = false;
      next.coyote = 0;
      next.jumpBuffer = 0;
      next.airJumpsRemaining = config.maxAirJumps;
      next.power.invulnerableTimer = 0.55;
      next.deaths += 1;
      next.finishBlocked = false;
      next.state = 'hurt';
    }

    function stepGeneratedPlayer(inputPlayer, inputState, levelData, dt, config = DEFAULTS) {
      const next = JSON.parse(JSON.stringify(inputPlayer));
      if (next.finished) return next;
      if (!next.power) next.power = { speedTimer:0, jumpTimer:0, magnetTimer:0, shieldCharges:0, invulnerableTimer:0 };
      if (!Array.isArray(next.collectedPowerups)) next.collectedPowerups = [];
      if (!Number.isInteger(next.airJumpsRemaining)) next.airJumpsRemaining = config.maxAirJumps;
      const step = Math.min(Math.max(dt, 0), 1 / 20);
      next.power.speedTimer = Math.max(0, next.power.speedTimer - step);
      next.power.jumpTimer = Math.max(0, next.power.jumpTimer - step);
      next.power.magnetTimer = Math.max(0, next.power.magnetTimer - step);
      next.power.invulnerableTimer = Math.max(0, next.power.invulnerableTimer - step);
      next.finishBlocked = false;
      next.missingPickups = Math.max(0, pickupRequirement(levelData) - next.collected.length);
      next.jumpBuffer = inputState.jumpPressed ? config.jumpBuffer : Math.max(0, next.jumpBuffer - step);
      next.coyote = next.grounded ? config.coyoteTime : Math.max(0, next.coyote - step);
      const direction = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
      const speedMultiplier = next.power.speedTimer > 0 ? config.speedBoostMultiplier : 1;
      const jumpMultiplier = next.power.jumpTimer > 0 ? config.jumpBoostMultiplier : 1;
      const targetVx = direction * config.moveSpeed * speedMultiplier;
      const acceleration = next.grounded ? config.groundAcceleration : config.airAcceleration;
      const deceleration = next.grounded ? config.groundDeceleration : config.airDeceleration;
      next.vx = approach(next.vx, targetVx, (direction === 0 ? deceleration : acceleration) * step);
      let jumped = false;
      if (next.jumpBuffer > 0 && next.coyote > 0) {
        next.vy = -config.jumpSpeed * jumpMultiplier;
        next.grounded = false;
        next.coyote = 0;
        next.jumpBuffer = 0;
        jumped = true;
      } else if (inputState.jumpPressed && next.airJumpsRemaining > 0) {
        next.vy = -config.doubleJumpSpeed * jumpMultiplier;
        next.grounded = false;
        next.coyote = 0;
        next.jumpBuffer = 0;
        next.airJumpsRemaining -= 1;
        jumped = true;
      }
      if (jumped) next.state = next.airJumpsRemaining < config.maxAirJumps ? 'double-jump' : 'jump';
      next.x += next.vx * step;
      next.x = clamp(next.x, 0, Math.max(0, levelData.worldWidth - next.width));
      for (const platform of levelData.platforms) collideX(next, platform);
      const wasGrounded = next.grounded;
      next.grounded = false;
      const jumpCut = !jumped && inputState.jumpHeld === false && next.vy < 0;
      next.vy = Math.min(config.maxFallSpeed, next.vy + config.gravity * (jumpCut ? config.jumpCutGravityMultiplier : 1) * step);
      next.y += next.vy * step;
      for (const platform of levelData.platforms) collideY(next, platform, config);
      for (const powerup of levelData.powerups || []) if (!next.collectedPowerups.includes(powerup.id) && rectsOverlap(next, powerup)) collectPower(next, powerup);
      for (const pickup of levelData.pickups) {
        const magnet = next.power.magnetTimer > 0 && centerDistanceLocal(next, pickup) <= config.magnetRadius;
        if (!next.collected.includes(pickup.id) && (rectsOverlap(next, pickup) || magnet)) next.collected.push(pickup.id);
      }
      next.missingPickups = Math.max(0, pickupRequirement(levelData) - next.collected.length);
      for (const checkpoint of checkpointList(levelData)) {
        if (rectsOverlap(next, checkpoint)) next.checkpoint = { x: checkpoint.respawnX, y: checkpoint.respawnY, id: checkpoint.id };
      }
      const hitHazard = levelData.hazards.some((hazard) => rectsOverlap(next, hazard)) || next.y > levelData.worldHeight + 160;
      if (hitHazard && next.power.invulnerableTimer <= 0) {
        if (next.power.shieldCharges > 0 && next.y <= levelData.worldHeight + 160) {
          next.power.shieldCharges -= 1;
          next.power.invulnerableTimer = config.shieldInvulnerability;
          next.vy = -Math.min(470, config.jumpSpeed * 0.74);
          next.state = 'shield-bounce';
        } else {
          respawnGenerated(next, config);
          return next;
        }
      }
      if (levelData.finish && next.x + next.width >= levelData.finish.x) {
        if (next.missingPickups > 0) {
          next.x = Math.min(next.x, levelData.finish.x - next.width);
          next.vx = 0;
          next.finishBlocked = true;
          next.state = 'finish-blocked';
        } else {
          next.finished = true;
          next.vx = 0;
          next.vy = 0;
          next.state = 'finish';
        }
      }
      if (!next.grounded && !['double-jump','shield-bounce'].includes(next.state)) next.state = next.vy < 0 ? 'jump' : 'fall';
      else if (next.grounded && Math.abs(next.vx) > 1) next.state = 'run';
      else if (next.grounded) next.state = 'idle';
      if (!wasGrounded && next.grounded && inputPlayer.vy > 300) motionImpact = Math.max(motionImpact, Math.min(1, inputPlayer.vy / 720));
      return next;
    }

    function applyMechanics(next, previous, levelData, dt) {
      for (const zone of levelData.mechanicZones || []) {
        if (!rectsOverlap(next, zone)) continue;
        if (zone.type === 'bounce-pads') {
          const previousFeet = previous.y + previous.height;
          const nextFeet = next.y + next.height;
          if (next.vy >= 0 && previousFeet <= zone.y + 7 && nextFeet >= zone.y - 5) {
            next.y = zone.y - next.height;
            next.vy = -(zone.strength || 760);
            next.grounded = false;
            next.airJumpsRemaining = Math.max(1, next.airJumpsRemaining);
            next.state = 'boost-bounce';
            motionImpact = 0.35;
          }
        } else if (zone.type === 'drag-zones') {
          next.vx *= Math.pow(clamp(zone.drag || 0.9, 0.75, 1), dt * 8);
        } else if (zone.type === 'slip-zones' && next.grounded) {
          const maxSpeed = zone.maxSpeed || 390;
          next.vx = clamp(next.vx * Math.pow(zone.boost || 1.01, dt * 60), -maxSpeed, maxSpeed);
        } else {
          next.vx = clamp(next.vx + (zone.forceX || 0) * dt, -440, 440);
          next.vy = clamp(next.vy + (zone.forceY || 0) * dt, -900, DEFAULTS.maxFallSpeed);
        }
      }
      return next;
    }

    function resetBoss(levelData) {
      activeBoss = levelData.boss ? { ...levelData.boss, hits: 0, defeated: false, dir: -1, hurtTimer: 0 } : null;
      bossFlash = 0;
    }

    function updateBoss(dt) {
      if (!activeBoss || activeBoss.defeated) return;
      activeBoss.hurtTimer = Math.max(0, activeBoss.hurtTimer - dt);
      activeBoss.x += activeBoss.dir * activeBoss.speed * dt;
      if (activeBoss.x <= activeBoss.arenaStartX) { activeBoss.x = activeBoss.arenaStartX; activeBoss.dir = 1; }
      const maxX = activeBoss.arenaEndX - activeBoss.width;
      if (activeBoss.x >= maxX) { activeBoss.x = maxX; activeBoss.dir = -1; }
      bossFlash = Math.max(0, bossFlash - dt);
    }

    function resolveBoss(next, previous, config) {
      if (!activeBoss || activeBoss.defeated || !rectsOverlap(next, activeBoss)) return next;
      const previousFeet = previous.y + previous.height;
      const fromAbove = previous.vy >= 0 && next.vy >= 0 && previousFeet <= activeBoss.y + 14 && activeBoss.hurtTimer <= 0;
      if (fromAbove) {
        activeBoss.hits += 1;
        activeBoss.hurtTimer = 0.48;
        bossFlash = 0.22;
        next.y = activeBoss.y - next.height;
        next.vy = -(activeBoss.bounce || 640);
        next.grounded = false;
        next.airJumpsRemaining = Math.max(1, next.airJumpsRemaining);
        next.state = 'boss-stomp';
        motionImpact = 0.55;
        if (activeBoss.hits >= activeBoss.requiredHits) activeBoss.defeated = true;
        return next;
      }
      if (activeBoss.hurtTimer > 0 || next.power.invulnerableTimer > 0) return next;
      if (next.power.shieldCharges > 0) {
        next.power.shieldCharges -= 1;
        next.power.invulnerableTimer = config.shieldInvulnerability;
        next.vx = next.x < activeBoss.x ? -350 : 350;
        next.vy = -320;
        next.state = 'shield-bounce';
      } else {
        respawnGenerated(next, config);
      }
      return next;
    }

    const levelOneStep = stepPlayer;
    stepPlayer = function seedManCampaignStep(inputPlayer, inputState, levelData, dt, config = DEFAULTS) {
      const previous = inputPlayer;
      motionImpact = Math.max(0, motionImpact - dt * 3.5);
      let next;
      if (levelData.id === 'sprout-run') {
        next = levelOneStep(inputPlayer, inputState, levelData, dt, config);
        if (!previous.grounded && next.grounded && previous.vy > 300) motionImpact = Math.max(motionImpact, Math.min(1, previous.vy / 720));
        return next;
      }
      updateBoss(dt);
      next = stepGeneratedPlayer(inputPlayer, inputState, levelData, dt, config);
      if (next.deaths > previous.deaths) return next;
      applyMechanics(next, previous, levelData, dt);
      resolveBoss(next, previous, config);
      if (next.finished && activeBoss && !activeBoss.defeated) {
        next.finished = false;
        next.finishBlocked = true;
        next.x = Math.min(next.x, levelData.finish.x - next.width - 4);
        next.vx = 0;
        next.state = 'boss-gated';
      }
      return next;
    };

    const baseReset = reset;
    reset = function seedManCampaignReset() {
      baseReset();
      resetBoss(level);
      document.body.dataset.seedTheme = level.theme || 'greenhouse';
      document.body.dataset.seedLevel = level.id;
      syncCampaignUi();
    };

    function drawGeneratedPlatforms() {
      const palette = level.palette || { ground:'#4e6f37', accent:'#93c868', hazard:'#d78644' };
      for (const platform of level.platforms) {
        worldRect(platform, platform.height > 40 ? palette.ground : palette.far || palette.ground, palette.accent);
        ctx.fillStyle = palette.accent;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(Math.round(platform.x - cameraX), platform.y, platform.width, Math.min(7, platform.height));
        ctx.globalAlpha = 1;
      }
      for (const hazard of level.hazards) {
        const x = Math.round(hazard.x - cameraX);
        ctx.fillStyle = palette.hazard;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(x, hazard.y, hazard.width, hazard.height);
        ctx.globalAlpha = 1;
        for (let px = x; px < x + hazard.width; px += 24) {
          ctx.beginPath();
          ctx.moveTo(px, hazard.y + 12);
          ctx.lineTo(px + 12, hazard.y - 10);
          ctx.lineTo(px + 24, hazard.y + 12);
          ctx.fill();
        }
      }
      drawMechanicZones();
      drawBoss();
    }

    function drawMechanicZones() {
      const accent = level.palette?.accent || '#c8f36a';
      for (const zone of level.mechanicZones || []) {
        const x = zone.x - cameraX;
        ctx.save();
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = accent;
        ctx.fillRect(x, zone.y, zone.width, zone.height);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, zone.y, zone.width, zone.height);
        ctx.fillStyle = '#f7fbf4';
        ctx.font = '800 8px system-ui';
        const label = zone.type.replaceAll('-', ' ').toUpperCase();
        ctx.fillText(label.slice(0, 15), x + 5, zone.y + 13);
        ctx.restore();
      }
    }

    function drawBoss() {
      if (!activeBoss || activeBoss.defeated) return;
      const x = activeBoss.x - cameraX;
      const y = activeBoss.y;
      const pulse = 1 + Math.sin(elapsed * 4) * 0.035;
      ctx.save();
      ctx.translate(x + activeBoss.width / 2, y + activeBoss.height / 2);
      ctx.scale(activeBoss.dir * pulse, pulse);
      ctx.strokeStyle = '#151b17';
      ctx.lineWidth = 4;
      ctx.fillStyle = bossFlash > 0 ? '#ffffff' : activeBoss.accent;
      if (activeBoss.style === 'pump') {
        ctx.fillRect(-34, -31, 68, 62); ctx.strokeRect(-34, -31, 68, 62);
        ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fillStyle = '#18384b'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = activeBoss.accent; ctx.fillRect(24, -44, 16, 27); ctx.strokeRect(24, -44, 16, 27);
      } else if (activeBoss.style === 'mite') {
        ctx.beginPath(); ctx.ellipse(0, 0, 36, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (const sy of [-18,-6,8,20]) { ctx.beginPath(); ctx.moveTo(-26, sy); ctx.lineTo(-48, sy + 10); ctx.moveTo(26, sy); ctx.lineTo(48, sy + 10); ctx.stroke(); }
        ctx.fillStyle = '#141814'; ctx.beginPath(); ctx.arc(12,-7,4,0,Math.PI*2); ctx.arc(25,-5,4,0,Math.PI*2); ctx.fill();
      } else if (activeBoss.style === 'wraith') {
        ctx.beginPath(); ctx.moveTo(-34,25); ctx.quadraticCurveTo(-42,-32,0,-40); ctx.quadraticCurveTo(42,-32,34,25); ctx.lineTo(18,14); ctx.lineTo(5,28); ctx.lineTo(-8,15); ctx.lineTo(-22,28); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2f33'; ctx.beginPath(); ctx.arc(-12,-10,5,0,Math.PI*2); ctx.arc(12,-10,5,0,Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0,0,38,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#48622f'; for (let i=0;i<10;i+=1){ const a=i*Math.PI/5; ctx.beginPath(); ctx.ellipse(Math.cos(a)*47,Math.sin(a)*47,9,18,a,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#141814'; ctx.beginPath(); ctx.arc(-12,-6,4,0,Math.PI*2); ctx.arc(12,-6,4,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    const levelOneDrawPlatforms = drawPlatforms;
    drawPlatforms = function seedManCampaignPlatforms() {
      if (level.id === 'sprout-run') levelOneDrawPlatforms();
      else drawGeneratedPlatforms();
    };

    const baseDrawBackground = drawBackground;
    drawBackground = function seedManCampaignBackground() {
      baseDrawBackground();
      if (level.id === 'sprout-run') return;
      const palette = level.palette;
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = palette.sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = palette.far;
      const drift = (cameraX * 0.12) % 180;
      for (let x = -180 - drift; x < canvas.width + 180; x += 180) {
        if (level.theme === 'nursery') { ctx.fillRect(x, 90, 78, 210); ctx.fillRect(x + 12, 105, 54, 8); ctx.fillRect(x + 12, 150, 54, 8); }
        else if (level.theme === 'hydro') { ctx.beginPath(); ctx.arc(x + 90, 150, 52, 0, Math.PI * 2); ctx.strokeStyle = palette.accent; ctx.lineWidth = 9; ctx.stroke(); }
        else if (level.theme === 'root-zone') { ctx.strokeStyle = palette.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 90, 0); ctx.bezierCurveTo(x + 30, 160, x + 150, 260, x + 70, 430); ctx.stroke(); }
        else if (level.theme === 'mycelium') { ctx.beginPath(); ctx.arc(x + 80, 170, 45, Math.PI, 0); ctx.fill(); ctx.fillRect(x + 72,170,16,110); }
        else if (level.theme === 'trichome') { ctx.beginPath(); ctx.arc(x + 70,110,22,0,Math.PI*2); ctx.fill(); ctx.fillRect(x + 66,130,8,165); }
        else if (level.theme === 'cavern') { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+55,130); ctx.lineTo(x+100,0); ctx.fill(); }
        else if (level.theme === 'refinery') { ctx.fillRect(x+30,80,34,250); ctx.fillRect(x,110,120,20); }
        else if (level.theme === 'terpene') { ctx.beginPath(); ctx.arc(x+80,150 + Math.sin(elapsed + x)*30,48,0,Math.PI*2); ctx.fill(); }
        else if (level.theme === 'frost') { for(let i=0;i<6;i+=1){ ctx.beginPath(); ctx.arc(x+20+i*24,70+(i%3)*65,3+(i%2)*2,0,Math.PI*2); ctx.fill(); } }
        else { ctx.beginPath(); ctx.arc(x+70,130,60,0,Math.PI*2); ctx.fill(); ctx.fillRect(x+55,180,30,120); }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.accent;
      ctx.font = '900 18px system-ui';
      ctx.fillText(level.name.replace('Sprout Run: ', ''), 24, 38);
      ctx.font = '700 11px system-ui';
      ctx.fillText(level.setting, 24, 57);
      ctx.restore();
    };

    const baseRender = render;
    render = function seedManCampaignRender() {
      baseRender();
      if (!activeBoss || activeBoss.defeated) return;
      const width = Math.min(330, canvas.width * 0.42);
      const x = (canvas.width - width) / 2;
      const y = 46;
      const remaining = Math.max(0, activeBoss.requiredHits - activeBoss.hits);
      ctx.save();
      ctx.fillStyle = '#0b130fdd'; ctx.fillRect(x, y, width, 31);
      ctx.fillStyle = activeBoss.accent; ctx.fillRect(x + 4, y + 20, (width - 8) * (remaining / activeBoss.requiredHits), 7);
      ctx.fillStyle = '#f5f7f4'; ctx.textAlign = 'center'; ctx.font = '900 11px system-ui';
      ctx.fillText(`${activeBoss.name} · ${remaining} stomp${remaining === 1 ? '' : 's'} left`, canvas.width / 2, y + 14);
      ctx.restore();
    };

    function drawLeaf(x, y, rotation, width = 7, height = 11) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(width*.75,-height*.3,width*.7,-height*.9,0,-height); ctx.bezierCurveTo(-width*.7,-height*.9,-width*.75,-height*.3,0,0); ctx.closePath(); ctx.fillStyle='#4fae58'; ctx.fill(); ctx.strokeStyle='#172019'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    }

    function drawGlove(x, y, rotation = 0) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.fillStyle='#fff'; ctx.strokeStyle='#171817'; ctx.lineWidth=2.1; ctx.beginPath(); ctx.ellipse(0,0,5,4.2,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(3.6,-2.6,2.1,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    function drawShoe(x, y, rotation = 0) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.fillStyle='#fff'; ctx.strokeStyle='#171817'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.ellipse(0,0,7,4.1,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    drawSeedMan = function seedManAnimationV2() {
      if (!player || !ctx) return;
      const now = performance.now() / 1000;
      const speedRatio = clamp(Math.abs(player.vx) / 340, 0, 1);
      const facing = player.vx < -1 ? -1 : 1;
      const running = player.grounded && Math.abs(player.vx) > 14;
      const airborne = !player.grounded;
      const runPhase = now * (10 + speedRatio * 7);
      const stride = running ? Math.sin(runPhase) : 0;
      const lift = running ? Math.cos(runPhase * 2) * 0.8 : Math.sin(now * 3.4) * 0.45;
      const lean = running ? facing * clamp(player.vx / 260, -1, 1) * 0.09 : airborne ? facing * clamp(player.vx / 420, -1, 1) * 0.05 : 0;
      const jumpStretch = airborne ? clamp(Math.abs(player.vy) / 700, 0, 1) * 0.08 : 0;
      const impactSquash = clamp(motionImpact, 0, 1) * 0.16;
      const doublePose = player.state === 'double-jump' || player.state === 'boss-stomp' ? 1 : 0;
      const hurt = player.state === 'hurt';
      const finishPose = player.state === 'finish';
      const blink = (now % 4.7) > 4.54;
      const screenX = player.x - cameraX + player.width / 2;
      const screenY = player.y + player.height / 2;

      ctx.save();
      ctx.translate(screenX, screenY + lift + impactSquash * 7);
      ctx.rotate(lean + (doublePose ? -0.08 * facing : 0));
      ctx.scale(facing * (1 + impactSquash * 0.13 - jumpStretch * 0.05), 1 - impactSquash + jumpStretch);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      if (player.power?.speedTimer > 0 || speedRatio > 0.78) {
        ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = level.palette?.accent || '#f3c867'; ctx.lineWidth = 2.5;
        for (let i=0;i<4;i+=1){ ctx.beginPath(); ctx.moveTo(-24-i*8,-12+i*7); ctx.lineTo(-38-i*11,-12+i*7); ctx.stroke(); }
        ctx.restore();
      }
      if (player.power?.shieldCharges > 0) {
        ctx.save(); ctx.globalAlpha=.34 + Math.sin(now*6)*.05; ctx.strokeStyle='#76d7ff'; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(0,-2,22,28,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }

      const legAmp = running ? 7 * speedRatio : airborne ? 2.5 : 0;
      const armAmp = running ? 8 * speedRatio : airborne ? 4 : 0;
      const leftLeg = stride * legAmp;
      const rightLeg = -stride * legAmp;
      const leftArm = -stride * armAmp;
      const rightArm = stride * armAmp;
      ctx.strokeStyle='#171817'; ctx.lineWidth=4.1;
      const limb = (x1,y1,x2,y2,x3,y3) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(x2,y2,x3,y3); ctx.stroke(); };
      limb(-5,9,-7-leftLeg*.45,15,-8-leftLeg,21); limb(5,9,7-rightLeg*.45,15,8-rightLeg,21);
      drawShoe(-9-leftLeg,22, running ? -stride*.18 : -0.04); drawShoe(9-rightLeg,22,running ? stride*.18 : 0.04);
      const armLift = finishPose ? -12 : doublePose ? -6 : 0;
      limb(-10,-3,-15-leftArm*.45,-1+armLift,-17-leftArm,7+armLift); limb(10,-3,15-rightArm*.45,-1+armLift,17-rightArm,7+armLift);
      drawGlove(-18-leftArm,8+armLift,-0.25); drawGlove(18-rightArm,8+armLift,0.25);

      ctx.fillStyle = hurt ? '#bd7547' : '#a9683f'; ctx.strokeStyle='#171817'; ctx.lineWidth=3.2;
      ctx.beginPath(); ctx.ellipse(0,-4,12.9,15.3,-0.08,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#c98b5f'; ctx.beginPath(); ctx.ellipse(-5.1,-9.5,2.1,4.8,-.35,0,Math.PI*2); ctx.fill();

      ctx.strokeStyle='#171817'; ctx.fillStyle='#171817';
      if (hurt) {
        ctx.lineWidth=1.9; ctx.beginPath(); ctx.moveTo(-6,-8); ctx.lineTo(-2,-4); ctx.moveTo(-2,-8); ctx.lineTo(-6,-4); ctx.moveTo(2,-8); ctx.lineTo(6,-4); ctx.moveTo(6,-8); ctx.lineTo(2,-4); ctx.stroke();
      } else if (blink) {
        ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-6,-6); ctx.lineTo(-2,-6); ctx.moveTo(2,-6); ctx.lineTo(6,-6); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.ellipse(-4.1,-6,1.45,2.15,0,0,Math.PI*2); ctx.ellipse(4.1,-6,1.45,2.15,0,0,Math.PI*2); ctx.fill();
      }
      ctx.lineWidth=1.8; ctx.beginPath();
      if (hurt) ctx.arc(0,3.4,3.7,Math.PI+.25,Math.PI*2-.25); else ctx.arc(0,-1.3,4.1,.18,Math.PI-.18);
      ctx.stroke();

      const leafLag = running ? stride * 0.12 : airborne ? clamp(player.vx / 900,-.25,.25) : Math.sin(now*2.7)*0.025;
      ctx.strokeStyle='#172019'; ctx.lineWidth=2.3; ctx.beginPath(); ctx.moveTo(0,-18); ctx.quadraticCurveTo(-leafLag*18,-21,-leafLag*24,-23); ctx.stroke();
      drawLeaf(-leafLag*24,-21.5,-leafLag,7.2,11.5); drawLeaf(-1-leafLag*18,-21,-.72-leafLag,7,10.5); drawLeaf(1-leafLag*18,-21,.72-leafLag,7,10.5);

      if (doublePose || player.state === 'boost-bounce') {
        ctx.save(); ctx.globalAlpha=.65; ctx.strokeStyle=level.palette?.accent || '#c8f36a'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(0,23,24,7,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    };

    const baseFinishGame = finishGame;
    finishGame = function seedManCampaignFinish() {
      baseFinishGame();
      const entry = levelById.get(level.id);
      if (!entry) return;
      if (!campaignProgress.completed.includes(level.id)) campaignProgress.completed.push(level.id);
      const oldBest = Number(campaignProgress.best[level.id]);
      if (!Number.isFinite(oldBest) || elapsed < oldBest) campaignProgress.best[level.id] = Number(elapsed.toFixed(3));
      writeProgress(campaignProgress);
      syncCampaignUi();
      const nextEntry = campaignEntries.find((candidate) => candidate.order === entry.order + 1);
      let nextButton = document.querySelector('#seed-man-next-level');
      if (!nextButton && ui.finish) {
        nextButton = document.createElement('button');
        nextButton.id = 'seed-man-next-level';
        nextButton.type = 'button';
        nextButton.className = 'primary';
        ui.finish.append(nextButton);
      }
      if (nextButton) {
        if (nextEntry) {
          nextButton.hidden = false;
          nextButton.textContent = `Next: ${nextEntry.title}`;
          nextButton.onclick = () => selectCampaignLevel(nextEntry.id);
        } else {
          nextButton.hidden = false;
          nextButton.textContent = 'Campaign Complete · Replay Level 1';
          nextButton.onclick = () => selectCampaignLevel('sprout-run');
        }
      }
      if (ui.summary) {
        const bossText = level.boss ? ` · ${level.boss.name} defeated` : '';
        ui.summary.textContent = `Level ${entry.order}/11 complete · ${player.collected.length}/${requiredSprouts()} sprouts${bossText} · ${player.deaths} falls · ${elapsed.toFixed(1)}s.`;
      }
    };

    function createCampaignUi() {
      if (document.querySelector('#seed-man-campaign-panel')) return;
      const shell = document.querySelector('.game-shell');
      if (!shell) return;
      const panel = document.createElement('section');
      panel.id = 'seed-man-campaign-panel';
      panel.setAttribute('aria-label', 'Seed Man level campaign');
      panel.innerHTML = `
        <div class="seed-campaign-copy">
          <span class="seed-campaign-kicker">11-LEVEL CAMPAIGN · 4 WORLDS · 4 BOSSES</span>
          <strong id="seed-campaign-title">Level 1 · Greenhouse Gauntlet</strong>
          <small id="seed-campaign-setting">Original greenhouse proving ground</small>
        </div>
        <label class="seed-level-picker">Level <select id="seed-man-level-select" aria-label="Choose Seed Man level"></select></label>
        <span id="seed-campaign-progress">0 / 11 cleared</span>`;
      shell.before(panel);
      const select = panel.querySelector('#seed-man-level-select');
      for (const entry of campaignEntries) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.order}. ${entry.title}${entry.boss ? ` · Boss: ${entry.boss}` : ''}`;
        select.append(option);
      }
      select.addEventListener('change', () => selectCampaignLevel(select.value));
      const style = document.createElement('style');
      style.textContent = `
        #seed-man-campaign-panel{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;margin:0 auto 14px;max-width:1160px;padding:14px 16px;border:1px solid rgba(200,243,106,.28);border-radius:16px;background:linear-gradient(135deg,rgba(9,27,18,.96),rgba(18,45,31,.92));box-shadow:0 16px 40px rgba(0,0,0,.25)}
        .seed-campaign-copy{display:grid;gap:3px}.seed-campaign-kicker{font-size:10px;font-weight:900;letter-spacing:.12em;color:#c8f36a}.seed-campaign-copy strong{font-size:16px}.seed-campaign-copy small{color:#aebbad;line-height:1.35}.seed-level-picker{display:grid;gap:4px;font-size:10px;font-weight:800;color:#cbd8c8}.seed-level-picker select{min-height:44px;max-width:300px;border:1px solid rgba(200,243,106,.35);border-radius:10px;background:#0e2117;color:#f5f7f4;padding:0 36px 0 12px;font:700 13px system-ui}#seed-campaign-progress{font-size:12px;font-weight:900;color:#f3c867;white-space:nowrap}
        body[data-seed-theme="hydro"] .game-shell{box-shadow:0 0 50px rgba(91,224,255,.12)}body[data-seed-theme="mycelium"] .game-shell{box-shadow:0 0 50px rgba(179,140,255,.13)}body[data-seed-theme="frost"] .game-shell{box-shadow:0 0 50px rgba(201,246,255,.14)}body[data-seed-theme="citadel"] .game-shell{box-shadow:0 0 58px rgba(255,226,122,.13)}
        @media(max-width:760px){#seed-man-campaign-panel{grid-template-columns:1fr;gap:9px}.seed-level-picker select{width:100%;max-width:none}#seed-campaign-progress{justify-self:start}}
        @media(prefers-reduced-motion:reduce){#seed-man-campaign-panel,.game-shell{transition:none!important}}
      `;
      document.head.append(style);
    }

    function syncCampaignUi() {
      const entry = levelById.get(level?.id || 'sprout-run');
      if (!entry) return;
      const select = document.querySelector('#seed-man-level-select');
      if (select) select.value = entry.id;
      const title = document.querySelector('#seed-campaign-title');
      if (title) title.textContent = `Level ${entry.order} / 11 · ${entry.title}${entry.boss ? ` · ${entry.boss}` : ''}`;
      const setting = document.querySelector('#seed-campaign-setting');
      if (setting) setting.textContent = level.setting || 'Original greenhouse proving ground';
      const progress = document.querySelector('#seed-campaign-progress');
      if (progress) progress.textContent = `${campaignProgress.completed.length} / 11 cleared`;
      const courseKicker = document.querySelector('.course-kicker');
      if (courseKicker) courseKicker.textContent = (entry.worldTitle || 'GREENHOUSE DISTRICT').toUpperCase();
      const courseStage = document.querySelector('#course-stage');
      if (courseStage) courseStage.textContent = `Level ${entry.order} / 11 · ${entry.title}`;
      document.title = `Seed Man: ${entry.title} | DTF Genetics`;
    }

    function selectCampaignLevel(id) {
      const entry = window.__SPROUT_CAMPAIGN__.selectLevel(id);
      level = generatedLevelFor(id);
      resetBoss(level);
      reset();
      running = true;
      paused = false;
      if (ui.finish) ui.finish.hidden = true;
      setObjectiveStatus(`Level ${entry.order}/11 · ${entry.title} · collect ${level.requiredPickups} sprouts${level.boss ? ` · defeat ${level.boss.name}` : ''}`, 'progress');
      syncCampaignUi();
      focusCanvas();
      return level;
    }

    createCampaignUi();
    resetBoss(level);
    syncCampaignUi();

    window.__SPROUT_CAMPAIGN_EXPERIENCE__ = Object.freeze({
      version: SPROUT_CAMPAIGN_EXPERIENCE_VERSION,
      levelCount: 11,
      newLevelCount: 10,
      bossCount: 4,
      mechanics: Object.freeze(['bounce-pads','flow-zones','drag-zones','updraft-zones','boost-zones','heat-vents','gust-zones','slip-zones','wind-zones']),
      generatedLevelIds: Object.freeze([...generatedLevels.keys()]),
      selectLevel: selectCampaignLevel,
      snapshot: () => ({
        activeLevelId: level.id,
        completed: [...campaignProgress.completed],
        boss: activeBoss ? { id:activeBoss.id, name:activeBoss.name, hits:activeBoss.hits, requiredHits:activeBoss.requiredHits, defeated:activeBoss.defeated } : null
      })
    });
    window.__SPROUT_ANIMATION_V2__ = Object.freeze({
      version: SPROUT_ANIMATION_VERSION,
      characterContract: 'seed-man-locked-v1',
      renderer: 'canvas2d-vector-animation',
      poses: Object.freeze(['idle-breathe','run-stride','jump-stretch','double-jump','landing-squash','hurt','boss-stomp','finish-celebration']),
      invariants: Object.freeze(['chubby-seed-silhouette','three-leaf-sprout','rubber-hose-limbs','white-gloves','white-shoes','flat-2d'])
    });
    document.documentElement.dataset.seedManAnimation = SPROUT_ANIMATION_VERSION;
  } catch (error) {
    console.error('Seed Man 11-level campaign failed to initialize.', error);
  }
}, { once: true });
