'use strict';

(function installSeedManWorldFive() {
  const VERSION = 'seed-man-world-five-v1';
  const PROGRESS_KEY = 'dtf-seed-man-campaign-v3';
  const POWER_TYPES = ['speed', 'shield', 'magnet', 'jump'];
  const entries = Object.freeze([
    Object.freeze({ id: 'chromosome-crossing', title: 'Chromosome Crossing', order: 12, status: 'playable', worldId: 'world-05', worldTitle: 'Genetic Frontier', worldOrder: 5 }),
    Object.freeze({ id: 'mutation-marsh', title: 'Mutation Marsh', order: 13, status: 'playable', worldId: 'world-05', worldTitle: 'Genetic Frontier', worldOrder: 5, boss: 'Voltage Wasp Alpha' }),
    Object.freeze({ id: 'allele-array', title: 'Allele Array', order: 14, status: 'playable', worldId: 'world-05', worldTitle: 'Genetic Frontier', worldOrder: 5 }),
    Object.freeze({ id: 'genome-spire', title: 'Genome Spire', order: 15, status: 'playable', worldId: 'world-05', worldTitle: 'Genetic Frontier', worldOrder: 5, boss: 'Genome Hydra' })
  ]);
  const templates = Object.freeze([
    Object.freeze({id:'chromosome-crossing',name:'Chromosome Crossing',levelNumber:12,theme:'chromosome',setting:'Suspended chromosome bridges twist above a luminous genetics archive where paired rails split and reconnect across the route',difficulty:11,worldWidth:6400,requiredPickups:28,segmentLength:470,gaps:[130,145,135,150,125,145,140,130,150,135,145,130],elevations:[320,245,305,230,290,255,315,235,300,250,285,240],extraHighPlatforms:4,spikeCount:7,powerupCount:6,checkpointFractions:[0.24,0.48,0.72],palette:{sky:'#15162f',far:'#433b78',ground:'#50537a',accent:'#ff9bd8',hazard:'#ff5c75'},mechanic:{type:'boost-zones',count:6,forceX:310,forceY:-30}}),
    Object.freeze({id:'mutation-marsh',name:'Mutation Marsh',levelNumber:13,theme:'mutation-marsh',setting:'A glowing mutation marsh of unstable root islands, bubbling media pools and drifting gene spores that alter the safest route',difficulty:12,worldWidth:6500,requiredPickups:28,segmentLength:470,gaps:[135,150,130,145,155,130,145,135,150,140,130,150],elevations:[325,250,295,235,305,260,315,240,290,255,310,245],extraHighPlatforms:4,spikeCount:7,powerupCount:6,checkpointFractions:[0.24,0.48,0.72],palette:{sky:'#102b28',far:'#316454',ground:'#4c6e58',accent:'#9cff89',hazard:'#ff6b8f'},mechanic:{type:'updraft-zones',count:6,forceY:-235},boss:{id:'voltage-wasp-alpha',name:'Voltage Wasp Alpha',style:'hornet',requiredHits:5,width:112,height:82,bounce:720,accent:'#8de7ff'}}),
    Object.freeze({id:'allele-array',name:'Allele Array',levelNumber:14,theme:'allele-array',setting:'A precision allele sorting array packed with moving signal lanes, mirrored platforms and rapid polarity gates high above the archive floor',difficulty:13,worldWidth:6600,requiredPickups:30,segmentLength:460,gaps:[140,150,135,155,145,130,155,140,150,135,145,155,130],elevations:[315,240,300,225,285,250,310,230,295,245,305,235,280],extraHighPlatforms:5,spikeCount:8,powerupCount:7,checkpointFractions:[0.22,0.44,0.66,0.84],palette:{sky:'#101d35',far:'#315a84',ground:'#496987',accent:'#8de7ff',hazard:'#ff6882'},mechanic:{type:'gust-zones',count:6,forceX:215,alternate:true}}),
    Object.freeze({id:'genome-spire',name:'Genome Spire',levelNumber:15,theme:'genome-spire',setting:'The vertical Genome Spire crowns the Genetic Frontier with storm rails, frozen gene bridges and solar vents surrounding the final sequencing chamber',difficulty:14,worldWidth:6800,requiredPickups:32,segmentLength:450,gaps:[145,155,135,160,145,150,135,160,145,155,140,150,160,135],elevations:[310,235,295,220,280,245,305,225,290,240,300,230,285,245],extraHighPlatforms:6,spikeCount:9,powerupCount:8,checkpointFractions:[0.2,0.4,0.6,0.8],palette:{sky:'#11152d',far:'#424f86',ground:'#59658e',accent:'#ffe577',hazard:'#ff566f'},mechanic:{type:'wind-zones',count:7,forceX:245,alternate:true},boss:{id:'genome-hydra',name:'Genome Hydra',style:'hydra',requiredHits:5,width:132,height:116,bounce:740,accent:'#ffe577'}})
  ]);
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function groundPlatformsFor(template) {
    const platforms = [], hazards = [];
    let x = 0, gapIndex = 0;
    while (x < template.worldWidth) {
      const remaining = template.worldWidth - x;
      if (remaining <= template.segmentLength + 260) { platforms.push({ x, y: 480, width: remaining, height: 60 }); break; }
      const gap = template.gaps[gapIndex % template.gaps.length];
      if (remaining - template.segmentLength - gap < 260) { platforms.push({ x, y: 480, width: remaining, height: 60 }); break; }
      platforms.push({ x, y: 480, width: template.segmentLength, height: 60 });
      hazards.push({ x: x + template.segmentLength, y: 500, width: gap, height: 40 });
      x += template.segmentLength + gap;
      gapIndex += 1;
    }
    return { platforms, hazards };
  }

  function safeGroundX(platforms, desired, margin = 60) {
    const containing = platforms.find((platform) => platform.width >= margin * 2 && desired >= platform.x + margin && desired <= platform.x + platform.width - margin);
    if (containing) return Math.round(desired);
    const candidates = platforms.filter((platform) => platform.width >= margin * 2).sort((a, b) => Math.abs((a.x + a.width / 2) - desired) - Math.abs((b.x + b.width / 2) - desired));
    if (!candidates.length) return Math.round(desired);
    const platform = candidates[0];
    return Math.round(clamp(desired, platform.x + margin, platform.x + platform.width - margin));
  }

  function upperPlatformsFor(template) {
    const platforms = template.elevations.map((y, index) => ({
      x: Math.round(240 + index * ((template.worldWidth - 600) / Math.max(1, template.elevations.length - 1))),
      y,
      width: 160 + (index % 3) * 20,
      height: 24
    }));
    const extra = Math.max(0, Math.min(6, Number(template.extraHighPlatforms) || 0));
    for (let index = 0; index < extra; index += 1) {
      const fraction = extra === 1 ? 0.5 : 0.28 + index * (0.58 / Math.max(1, extra - 1));
      platforms.push({ x: Math.round(template.worldWidth * fraction), y: 220 - (index % 2) * 25, width: 150 - (index === 2 ? 5 : 0), height: 24 });
    }
    if (!template.boss) return platforms;
    const arenaStart = Math.round(template.worldWidth * 0.74) - 32;
    const arenaEnd = Math.round(template.worldWidth * 0.92) + 32;
    return platforms.filter((platform) => platform.x + platform.width <= arenaStart || platform.x >= arenaEnd);
  }

  function generate(template) {
    const ground = groundPlatformsFor(template);
    const upper = upperPlatformsFor(template);
    const hazards = [...ground.hazards];
    for (let index = 0; index < template.spikeCount; index += 1) {
      const usable = Math.max(400, template.worldWidth - 1800);
      const x = template.spikeCount === 1 ? template.worldWidth / 2 : 980 + index * (usable / (template.spikeCount - 1));
      hazards.push({ x: Math.round(x), y: 452, width: 48 + (index % 2) * 10, height: 28 });
    }
    const pickups = [];
    for (const platform of upper) {
      if (pickups.length >= template.requiredPickups) break;
      pickups.push({ id: `sprout-${String(template.levelNumber).padStart(2, '0')}-${String(pickups.length + 1).padStart(2, '0')}`, x: Math.round(platform.x + platform.width / 2 - 11), y: platform.y - 45, width: 22, height: 22 });
    }
    const remaining = template.requiredPickups - pickups.length;
    for (let index = 0; index < remaining; index += 1) {
      const desired = remaining === 1 ? template.worldWidth / 2 : 180 + index * ((template.worldWidth - 420) / Math.max(1, remaining - 1));
      pickups.push({ id: `sprout-${String(template.levelNumber).padStart(2, '0')}-${String(pickups.length + 1).padStart(2, '0')}`, x: safeGroundX(ground.platforms, desired, 50), y: 425, width: 22, height: 22 });
    }
    const powerups = Array.from({ length: template.powerupCount }, (_, index) => {
      const fraction = template.powerupCount === 1 ? 0.5 : 0.18 + index * (0.64 / Math.max(1, template.powerupCount - 1));
      const type = POWER_TYPES[(index + template.levelNumber) % POWER_TYPES.length];
      const power = { id: `power-${type}-${String(template.levelNumber).padStart(2, '0')}-${index + 1}`, type, x: safeGroundX(ground.platforms, template.worldWidth * fraction, 55), y: 425, width: 28, height: 28 };
      if (type === 'speed') power.duration = 8;
      if (type === 'magnet') power.duration = 11;
      if (type === 'jump') power.duration = 10;
      return power;
    });
    const checkpoints = template.checkpointFractions.map((fraction, index) => {
      const x = safeGroundX(ground.platforms, template.worldWidth * fraction, 80);
      return { id: `checkpoint-${String(template.levelNumber).padStart(2, '0')}-${index + 1}`, x, y: 420, width: 50, height: 60, respawnX: Math.max(60, x - 20), respawnY: 400 };
    });
    const mechanicZones = Array.from({ length: template.mechanic.count }, (_, index) => {
      const fraction = template.mechanic.count === 1 ? 0.5 : 0.16 + index * (0.68 / Math.max(1, template.mechanic.count - 1));
      const x = safeGroundX(ground.platforms, template.worldWidth * fraction, 90);
      const alternating = template.mechanic.alternate && index % 2 === 1 ? -1 : 1;
      return { id: `mechanic-${String(template.levelNumber).padStart(2, '0')}-${index + 1}`, type: template.mechanic.type, x, y: template.mechanic.type === 'bounce-pads' ? 462 : 360, width: template.mechanic.type === 'bounce-pads' ? 62 : 150, height: template.mechanic.type === 'bounce-pads' ? 18 : 120, strength: template.mechanic.strength || 0, forceX: (template.mechanic.forceX || 0) * alternating, forceY: template.mechanic.forceY || 0, drag: template.mechanic.drag || 1, boost: template.mechanic.boost || 1, maxSpeed: template.mechanic.maxSpeed || 0 };
    });
    let boss = null;
    if (template.boss) {
      const center = safeGroundX(ground.platforms, template.worldWidth * 0.84, 150);
      const width = template.boss.width || 100;
      const height = template.boss.height || 90;
      boss = { ...template.boss, x: Math.round(center - width / 2), y: 480 - height, arenaStartX: Math.round(template.worldWidth * 0.74), arenaEndX: Math.round(template.worldWidth * 0.92), speed: 38 + template.difficulty * 4, defeated: false, hits: 0 };
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

  const generated = new Map(templates.map((template) => [template.id, generate(template)]));

  function readProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return { completed: Array.isArray(parsed.completed) ? parsed.completed : [], best: parsed.best && typeof parsed.best === 'object' ? parsed.best : {} };
    } catch { return { completed: [], best: {} }; }
  }

  function syncFrontierUi(entry) {
    const kicker = document.querySelector('.seed-campaign-kicker');
    if (kicker) kicker.textContent = '15-LEVEL CAMPAIGN · 5 WORLDS · 6 BOSSES';
    const title = document.querySelector('#seed-campaign-title');
    if (title) title.textContent = `Level ${entry.order} / 15 · ${entry.title}${entry.boss ? ` · ${entry.boss}` : ''}`;
    const setting = document.querySelector('#seed-campaign-setting');
    if (setting) setting.textContent = level.setting;
    const progress = document.querySelector('#seed-campaign-progress');
    if (progress) progress.textContent = `${readProgress().completed.filter((id) => id === 'sprout-run' || entryById.has(id) || window.__SPROUT_CAMPAIGN_BASE_LEVELS__?.includes(id)).length} / 15 cleared`;
    document.body.dataset.seedTheme = level.theme;
    document.body.dataset.seedLevel = level.id;
    document.documentElement.dataset.sproutCampaignLevels = '15';
    document.title = `Seed Man: ${entry.title} | DTF Genetics`;
  }

  function selectFrontierLevel(id) {
    const entry = entryById.get(id);
    const next = generated.get(id);
    if (!entry || !next) return false;
    level = JSON.parse(JSON.stringify(next));
    reset();
    running = true;
    syncFrontierUi(entry);
    window.dispatchEvent(new CustomEvent('sprout:level-selected', { detail: { levelId: id, level: { ...entry }, worldFive: true } }));
    return true;
  }

  function installVisualLayer() {
    if (typeof drawBackground !== 'function') return;
    const baseDrawBackground = drawBackground;
    drawBackground = function seedManWorldFiveBackground() {
      baseDrawBackground();
      if (!entryById.has(level?.id) || !ctx || !canvas) return;
      const palette = level.palette || { accent: '#ffe577' };
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = palette.accent;
      ctx.fillStyle = palette.accent;
      ctx.lineWidth = 3;
      const drift = (cameraX * 0.08) % 220;
      for (let x = -220 - drift; x < canvas.width + 220; x += 220) {
        if (level.theme === 'chromosome') {
          ctx.beginPath();
          for (let y = 70; y < 410; y += 18) {
            const wave = Math.sin((y + elapsed * 70) * 0.035) * 24;
            if (y === 70) ctx.moveTo(x + 70 + wave, y); else ctx.lineTo(x + 70 + wave, y);
          }
          ctx.stroke();
          ctx.beginPath();
          for (let y = 70; y < 410; y += 18) {
            const wave = Math.sin((y + elapsed * 70) * 0.035 + Math.PI) * 24;
            if (y === 70) ctx.moveTo(x + 110 + wave, y); else ctx.lineTo(x + 110 + wave, y);
          }
          ctx.stroke();
        } else if (level.theme === 'mutation-marsh') {
          for (let i = 0; i < 7; i += 1) { ctx.beginPath(); ctx.arc(x + 30 + i * 24, 120 + ((i * 47) % 220) + Math.sin(elapsed * 2 + i) * 10, 4 + (i % 3) * 2, 0, Math.PI * 2); ctx.fill(); }
        } else if (level.theme === 'allele-array') {
          for (let y = 90; y < 380; y += 54) { ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 180, y); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 55 + ((y / 54) % 2) * 70, y, 7, 0, Math.PI * 2); ctx.fill(); }
        } else if (level.theme === 'genome-spire') {
          ctx.strokeRect(x + 60, 80, 82, 280);
          for (let y = 100; y < 350; y += 36) { ctx.beginPath(); ctx.moveTo(x + 60, y); ctx.lineTo(x + 142, y + 22); ctx.stroke(); }
        }
      }
      ctx.restore();
    };
  }

  function installCampaignExtension() {
    const baseCampaign = window.__SPROUT_CAMPAIGN__;
    if (!baseCampaign || typeof reset !== 'function' || typeof level === 'undefined') throw new Error('Seed Man campaign runtime is unavailable');
    const baseLevels = baseCampaign.listLevels();
    window.__SPROUT_CAMPAIGN_BASE_LEVELS__ = Object.freeze(baseLevels.map((entry) => entry.id));
    let activeLevelId = baseCampaign.activeLevelId;
    const allLevels = Object.freeze([...baseLevels.map((entry) => Object.freeze({ ...entry })), ...entries]);
    window.__SPROUT_CAMPAIGN__ = Object.freeze({
      version: VERSION,
      campaignId: baseCampaign.campaignId,
      defaultLevelId: baseCampaign.defaultLevelId,
      levelCount: 15,
      newLevelCount: 14,
      worlds: Object.freeze([...baseCampaign.worlds.map((world) => Object.freeze({ ...world })), Object.freeze({ id: 'world-05', title: 'Genetic Frontier', order: 5, levels: entries })]),
      listLevels: () => allLevels.map((entry) => ({ ...entry })),
      getLevel: (id = activeLevelId) => allLevels.find((entry) => entry.id === id) || null,
      get activeLevelId() { return activeLevelId; },
      selectLevel(id) {
        if (entryById.has(id)) { activeLevelId = id; return { ...entryById.get(id) }; }
        const selected = baseCampaign.selectLevel(id);
        activeLevelId = selected.id;
        return selected;
      }
    });

    const select = document.querySelector('#seed-man-level-select');
    if (select) {
      for (const entry of entries) {
        if (select.querySelector(`option[value="${entry.id}"]`)) continue;
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.order}. ${entry.title}${entry.boss ? ` · Boss: ${entry.boss}` : ''}`;
        select.append(option);
      }
      select.addEventListener('change', (event) => {
        if (!entryById.has(select.value)) return;
        event.stopImmediatePropagation();
        selectFrontierLevel(select.value);
      }, true);
    }

    const finish = document.querySelector('#finish-panel');
    if (finish) {
      new MutationObserver(() => {
        if (finish.hidden || !level) return;
        const entry = entryById.get(level.id);
        const cloudNine = level.id === 'cloud-nine-citadel';
        if (!entry && !cloudNine) return;
        let nextButton = document.querySelector('#seed-man-next-level');
        if (!nextButton) {
          nextButton = document.createElement('button');
          nextButton.id = 'seed-man-next-level';
          nextButton.type = 'button';
          nextButton.className = 'primary';
          finish.append(nextButton);
        }
        const order = cloudNine ? 11 : entry.order;
        const nextEntry = entries.find((candidate) => candidate.order === order + 1);
        if (nextEntry) {
          nextButton.hidden = false;
          nextButton.textContent = `Next: ${nextEntry.title}`;
          nextButton.onclick = () => selectFrontierLevel(nextEntry.id);
        } else if (entry?.id === 'genome-spire') {
          nextButton.hidden = false;
          nextButton.textContent = 'Genetic Frontier Complete · Replay Level 1';
          nextButton.onclick = () => { window.__SPROUT_CAMPAIGN__.selectLevel('sprout-run'); location.reload(); };
        }
      }).observe(finish, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    }

    const panel = document.querySelector('#seed-man-campaign-panel');
    if (panel) panel.dataset.worldFive = 'ready';
    document.documentElement.dataset.sproutWorldFive = VERSION;
    document.documentElement.dataset.sproutCampaignLevels = '15';
    installVisualLayer();
  }

  window.addEventListener('load', () => {
    try { installCampaignExtension(); }
    catch (error) { console.error('Seed Man Genetic Frontier failed to initialize.', error); }
  });
})();
