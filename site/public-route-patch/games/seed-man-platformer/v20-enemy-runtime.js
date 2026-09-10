'use strict';

(() => {
  const VERSION = 'seed-man-v20-enemy-runtime-v2';
  const PHENOTYPE_DURATION_MS = 30000;
  const ATLAS_LAYOUT = Object.freeze({
    width:320,
    height:120,
    enemy:Object.freeze({ columns:6, y:0, height:0.5 }),
    boss:Object.freeze({ columns:4, y:0.5, height:0.5 })
  });

  const ENEMY_META = Object.freeze({
    'sproutling': { name:'Sproutling', role:'walker', hp:2, speed:48, width:34, height:32, attackPattern:'aimed-shot', drop:['resin',1], visualFrame:0 },
    'root-crawler': { name:'Root Crawler', role:'crawler', hp:3, speed:42, width:40, height:26, attackPattern:'ground-wave', drop:['nutrients',1], visualFrame:1 },
    'toxic-spore': { name:'Toxic Spore', role:'ranged', hp:3, speed:24, width:38, height:40, attackPattern:'aimed-shot', drop:['nutrients',2], visualFrame:2 },
    'drone-bot': { name:'Drone Bot', role:'flyer', hp:4, speed:72, width:42, height:30, attackPattern:'burst-shot', drop:['genetic-fragments',1], visualFrame:3 },
    'thorn-beetle': { name:'Thorn Beetle', role:'charger', hp:5, speed:64, width:46, height:34, attackPattern:'ground-wave', drop:['resin',2], visualFrame:4 },
    'sky-wasp': { name:'Sky Wasp', role:'flyer', hp:4, speed:90, width:38, height:28, attackPattern:'dive-charge', drop:['trichomes',2], visualFrame:5 },
    'spike-plant': { name:'Spike Plant', role:'turret', hp:5, speed:0, width:44, height:50, attackPattern:'aimed-shot', drop:['nutrients',2], visualFrame:2 },
    'sludge-monster': { name:'Sludge Monster', role:'tank', hp:8, speed:30, width:58, height:48, attackPattern:'ground-wave', drop:['resin',3], visualFrame:1 },
    'bone-weed': { name:'Bone Weed', role:'ambusher', hp:6, speed:38, width:46, height:48, attackPattern:'radial-burst', drop:['trichomes',3], visualFrame:4 },
    'shadow-root': { name:'Shadow Root', role:'teleporter', hp:7, speed:50, width:44, height:46, attackPattern:'blink-strike', drop:['genetic-fragments',2], visualFrame:0 }
  });

  // The approved 320x120 enemy/boss atlas contains six enemy cells on row 0
  // and four larger boss cells on row 1. Ancient Dryad and Blight King use
  // deterministic variants of approved boss cells until dedicated sprites land.
  const BOSS_VISUAL = Object.freeze({
    'overgrown-guardian': Object.freeze({ frame:0, variant:'guardian', mirrorX:false, sizeScale:1 }),
    'ancient-dryad': Object.freeze({ frame:0, variant:'dryad', mirrorX:true, sizeScale:0.94, aura:'#9bd46f' }),
    'scorchroot-titan': Object.freeze({ frame:1, variant:'scorchroot', mirrorX:false, sizeScale:1.04, aura:'#ff754b' }),
    'frostbite-colossus': Object.freeze({ frame:2, variant:'frostbite', mirrorX:false, sizeScale:1.06, aura:'#77dfff' }),
    'eco-sentinel': Object.freeze({ frame:3, variant:'sentinel', mirrorX:false, sizeScale:1, aura:'#8df5b1' }),
    'blight-king': Object.freeze({ frame:3, variant:'blight-king', mirrorX:true, sizeScale:1.16, aura:'#9cff2f' })
  });

  const PHENOTYPE_CARRIERS = Object.freeze({
    fire: { base:'thorn-beetle', phenotype:'fire', form:'fire', label:'Fire' },
    electric: { base:'drone-bot', phenotype:'electric', form:'electric', label:'Electric' },
    ice: { base:'root-crawler', phenotype:'ice', form:'ice', label:'Ice' }
  });

  const PHENOTYPE_ORDER = Object.freeze(['fire','electric','ice']);
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  function regionFor(row, frame) {
    const layout = ATLAS_LAYOUT[row];
    if (!layout) throw new Error(`Unknown approved atlas row: ${row}`);
    const safeFrame = clamp(Math.trunc(Number(frame) || 0), 0, layout.columns - 1);
    return Object.freeze({
      x:safeFrame / layout.columns,
      y:layout.y,
      width:1 / layout.columns,
      height:layout.height
    });
  }

  function levelOrder(levelData) {
    return Math.max(1, Number(levelData?.levelNumber || levelData?.difficulty || 1));
  }

  function movementFor(role) {
    if (role === 'flyer') return 'flying';
    if (role === 'teleporter') return 'blink';
    return 'ground';
  }

  function buildEnemy(levelData, type, index, count, options = {}) {
    const meta = ENEMY_META[type] || ENEMY_META.sproutling;
    const order = levelOrder(levelData);
    const worldWidth = Math.max(1600, Number(levelData?.worldWidth || 6200));
    const fraction = Number.isFinite(options.fraction)
      ? clamp(options.fraction, 0.08, 0.92)
      : options.carrier ? 0.62 : 0.12 + (index * 0.68 / Math.max(1,count - 1));
    const centerX = clamp(Math.round(worldWidth * fraction), 260, worldWidth - 300);
    const movement = movementFor(meta.role);
    const flying = movement === 'flying';
    const blink = movement === 'blink';
    const healthScale = Math.floor((order - 1) / 6);
    const elite = Boolean(options.carrier) || (order >= 8 && index === count - 1);
    const health = meta.hp + healthScale + (elite ? 2 : 0);
    const y = flying ? 285 + ((index * 37 + order * 19) % 80) : 480 - meta.height;
    const patrolRadius = flying ? 300 : 230;
    const carrier = options.carrier ? PHENOTYPE_CARRIERS[options.form] : null;

    return {
      id:`v20-${levelData?.id || 'level'}-${options.carrier ? `phenotype-${options.form}` : `${index + 1}-${type}`}`,
      archetype:type,
      name:carrier ? `${carrier.label} ${meta.name}` : meta.name,
      x:centerX,
      y,
      minX:Math.max(80,centerX - patrolRadius),
      maxX:Math.min(worldWidth - 80,centerX + patrolRadius),
      width:meta.width,
      height:meta.height,
      health,
      speed:meta.speed + Math.min(18,Math.floor(order / 3) * 2),
      flying,
      blink,
      elite,
      role:meta.role,
      movement,
      attackPattern:meta.attackPattern,
      phenotype:carrier?.phenotype || null,
      phenotypeForm:carrier?.form || null,
      phenotypeDurationMs:carrier ? PHENOTYPE_DURATION_MS : null,
      drop:carrier ? ['alleles',1] : [...meta.drop],
      approvedVisual:Object.freeze({
        atlas:'enemy-boss.atlas',
        row:'enemy',
        frame:meta.visualFrame,
        region:regionFor('enemy', meta.visualFrame),
        variant:carrier ? `carrier-${carrier.form}` : type
      }),
      canonicalV20:true
    };
  }

  function buildPhenotypeCarrier(levelData, form, index = 0, options = {}) {
    const carrier = PHENOTYPE_CARRIERS[form];
    if (!carrier) throw new Error(`Unknown phenotype carrier form: ${form}`);
    return buildEnemy(levelData, carrier.base, index, 3, {
      carrier:true,
      form,
      fraction:options.fraction
    });
  }

  function buildBoss(levelData) {
    const boss = levelData?.boss;
    if (!boss?.id || boss.defeated) return null;
    const visual = BOSS_VISUAL[boss.id];
    if (!visual) throw new Error(`Missing approved boss visual definition: ${boss.id}`);
    return {
      id:`v20-${levelData.id}-boss-${boss.id}`,
      archetype:boss.id,
      name:boss.name || boss.id,
      x:Number(boss.x || (levelData.worldWidth * 0.82)),
      y:Number(boss.y || 320),
      minX:Number(boss.arenaStartX || levelData.worldWidth * 0.72),
      maxX:Number(boss.arenaEndX || levelData.worldWidth * 0.94),
      width:Number(boss.width || 140),
      height:Number(boss.height || 130),
      health:Number(boss.requiredHits || 8),
      speed:Number(boss.speed || 68),
      flying:false,
      blink:boss.id === 'blight-king',
      elite:true,
      role:'boss',
      movement:boss.id === 'blight-king' ? 'blink' : 'ground',
      attackPattern:boss.id === 'blight-king' ? 'radial-burst' : 'burst-shot',
      phenotype:null,
      phenotypeForm:null,
      phenotypeDurationMs:null,
      drop:['genetic-fragments',Math.max(3,Number(boss.phase || 1) * 2)],
      bossRank:boss.finalBoss ? 'final' : 'major',
      finalBoss:Boolean(boss.finalBoss),
      phase:Number(boss.phase || 1),
      approvedVisual:Object.freeze({
        atlas:'enemy-boss.atlas',
        row:'boss',
        frame:visual.frame,
        region:regionFor('boss', visual.frame),
        variant:visual.variant,
        mirrorX:Boolean(visual.mirrorX),
        sizeScale:Number(visual.sizeScale || 1),
        aura:visual.aura || boss.accent || '#c8f36a'
      }),
      canonicalV20:true
    };
  }

  function buildEncounter(levelData) {
    const pool = Array.isArray(levelData?.enemyPool) && levelData.enemyPool.length
      ? levelData.enemyPool.filter((type) => ENEMY_META[type])
      : ['sproutling'];
    const order = levelOrder(levelData);
    const count = clamp(4 + Math.floor((order - 1) / 4),4,8);
    const encounter = Array.from({length:count},(_,index) => buildEnemy(levelData,pool[index % pool.length],index,count));

    if (levelData?.boss?.id === 'blight-king' || levelData?.mechanics?.includes?.('final-gauntlet')) {
      const fractions = Object.freeze({ fire:0.58, electric:0.68, ice:0.76 });
      PHENOTYPE_ORDER.forEach((form,index) => encounter.push(buildPhenotypeCarrier(levelData,form,count+index,{fraction:fractions[form]})));
    } else if (order >= 2) {
      const form = PHENOTYPE_ORDER[(order - 2) % PHENOTYPE_ORDER.length];
      encounter.push(buildPhenotypeCarrier(levelData,form,count));
    }

    const boss = buildBoss(levelData);
    if (boss) encounter.push(boss);
    return encounter;
  }

  function buildAttackers(levelData) {
    return buildEncounter(levelData).map((enemy) => ({...enemy,rank:enemy.bossRank || (enemy.elite ? 'elite' : 'standard')}));
  }

  window.__SEED_MAN_V20_ENEMY_RUNTIME__ = Object.freeze({
    version:VERSION,
    phenotypeDurationMs:PHENOTYPE_DURATION_MS,
    phenotypeForms:Object.freeze(['plant','fire','electric','ice']),
    enemyTypes:Object.freeze(Object.keys(ENEMY_META)),
    atlasLayout:ATLAS_LAYOUT,
    bossVisuals:BOSS_VISUAL,
    phenotypeCarrierForms:Object.freeze([...PHENOTYPE_ORDER]),
    buildEncounter,
    buildAttackers,
    buildBoss,
    buildPhenotypeCarrier,
    regionFor
  });
})();
