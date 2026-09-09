'use strict';

(() => {
  const VERSION = 'seed-man-v20-enemy-runtime-v3';
  const PHENOTYPE_DURATION_MS = 30000;

  const ENEMY_META = Object.freeze({
    'sproutling': { name:'Sproutling', role:'walker', hp:2, speed:48, width:34, height:32, attackPattern:'aimed-shot', drop:['resin',1] },
    'root-crawler': { name:'Root Crawler', role:'crawler', hp:3, speed:42, width:40, height:26, attackPattern:'ground-wave', drop:['nutrients',1] },
    'toxic-spore': { name:'Toxic Spore', role:'ranged', hp:3, speed:24, width:38, height:40, attackPattern:'aimed-shot', drop:['nutrients',2] },
    'drone-bot': { name:'Drone Bot', role:'flyer', hp:4, speed:72, width:42, height:30, attackPattern:'burst-shot', drop:['genetic-fragments',1] },
    'thorn-beetle': { name:'Thorn Beetle', role:'charger', hp:5, speed:64, width:46, height:34, attackPattern:'ground-wave', drop:['resin',2] },
    'sky-wasp': { name:'Sky Wasp', role:'flyer', hp:4, speed:90, width:38, height:28, attackPattern:'dive-charge', drop:['trichomes',2] },
    'spike-plant': { name:'Spike Plant', role:'turret', hp:5, speed:0, width:44, height:50, attackPattern:'aimed-shot', drop:['nutrients',2] },
    'sludge-monster': { name:'Sludge Monster', role:'tank', hp:8, speed:30, width:58, height:48, attackPattern:'ground-wave', drop:['resin',3] },
    'bone-weed': { name:'Bone Weed', role:'ambusher', hp:6, speed:38, width:46, height:48, attackPattern:'radial-burst', drop:['trichomes',3] },
    'shadow-root': { name:'Shadow Root', role:'teleporter', hp:7, speed:50, width:44, height:46, attackPattern:'blink-strike', drop:['genetic-fragments',2] }
  });

  const PHENOTYPE_CARRIERS = Object.freeze({
    fire: { base:'thorn-beetle', phenotype:'fire', form:'fire', label:'Fire' },
    electric: { base:'drone-bot', phenotype:'electric', form:'electric', label:'Electric' },
    ice: { base:'root-crawler', phenotype:'ice', form:'ice', label:'Ice' }
  });

  const PHENOTYPE_ORDER = Object.freeze(['fire','electric','ice']);
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

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
    const fraction = options.carrier ? 0.62 : 0.12 + (index * 0.68 / Math.max(1,count - 1));
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
      canonicalV20:true
    };
  }

  function buildBoss(levelData) {
    const boss = levelData?.boss;
    if (!boss?.id || boss.defeated) return null;
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
    if (order >= 2) {
      const form = PHENOTYPE_ORDER[(order - 2) % PHENOTYPE_ORDER.length];
      const carrier = PHENOTYPE_CARRIERS[form];
      encounter.push(buildEnemy(levelData,carrier.base,count,count + 1,{carrier:true,form}));
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
    phenotypeCarrierForms:Object.freeze([...PHENOTYPE_ORDER]),
    buildEncounter,
    buildAttackers,
    buildBoss
  });
})();
