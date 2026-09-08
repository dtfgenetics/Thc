import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const FX_VERSION = 'seed-man-impact-fx-v2';

if (!fs.existsSync(combatPath)) throw new Error(`Missing Seed Man combat runtime: ${combatPath}`);

let source = fs.readFileSync(combatPath, 'utf8');
if (source.includes(FX_VERSION)) {
  console.log(JSON.stringify({ ok: true, impactFx: FX_VERSION, patched: false }));
} else {
  const required = [
    ['projectile state', '  let projectiles = [];\n  let facing = 1;'],
    ['combat reset', '    projectiles = [];\n    facing = 1;'],
    ['reward hook', '  function rewardEnemy(enemy) {\n    defeated += 1;'],
    ['damage hook', '    enemy.hitFlash = 0.14;'],
    ['combat tick', '    simTime += step;'],
    ['combat draw', '    for (const projectile of projectiles) drawProjectile(projectile);']
  ];
  for (const [label, marker] of required) {
    if (!source.includes(marker)) throw new Error(`Could not locate Seed Man ${label} marker for impact FX.`);
  }

  source = source.replace(
    '  let projectiles = [];\n  let facing = 1;',
    `  let projectiles = [];\n  let combatFx = [];\n  let facing = 1;`
  );
  source = source.replace(
    '    projectiles = [];\n    facing = 1;',
    `    projectiles = [];\n    combatFx = [];\n    facing = 1;`
  );

  const helperAnchor = '  function rewardEnemy(enemy) {';
  const helpers = `  const IMPACT_FX_VERSION = '${FX_VERSION}';

  function pushCombatFx(type, x, y, accent, options = {}) {
    combatFx.push({
      type,
      x,
      y,
      accent: accent || '#c8f36a',
      age: 0,
      life: options.life || 0.48,
      size: options.size || 1,
      seed: ((x * 0.017 + y * 0.031 + simTime * 7.1) % 1 + 1) % 1
    });
    if (combatFx.length > 56) combatFx.splice(0, combatFx.length - 56);
  }

  function effectAccent(effect) {
    if (effect === 'burn') return '#ff7c35';
    if (effect === 'freeze') return '#8fe7ff';
    if (effect === 'chain') return '#ffe26b';
    if (effect === 'spore') return '#d2a6ff';
    if (effect === 'pierce') return '#d9fbff';
    if (effect === 'vine' || effect === 'root') return '#8ed85f';
    return '#c8f36a';
  }

  function spawnImpactFx(enemy, effect) {
    const x = enemy.x + enemy.width / 2;
    const y = enemy.y + enemy.height / 2;
    const accent = effectAccent(effect);
    pushCombatFx(effect === 'freeze' ? 'ice-shard' : effect === 'chain' ? 'electric-star' : effect === 'burn' ? 'fire-burst' : 'impact', x, y, accent, { size: Math.max(0.8, enemy.width / 38) });
  }

  function spawnRewardFx(enemy) {
    const x = enemy.x + enemy.width / 2;
    const y = enemy.y + enemy.height / 2;
    const accent = PHENOTYPES[enemy.phenotype]?.accent || (enemy.bossRank ? '#f3c867' : '#a9ef6d');
    pushCombatFx(enemy.phenotype ? 'absorb-ring' : enemy.bossRank ? 'boss-defeat' : 'reward-sparkle', x, y, accent, {
      life: enemy.bossRank ? 0.9 : enemy.phenotype ? 0.78 : 0.58,
      size: enemy.bossRank ? 1.8 : enemy.elite ? 1.25 : 1
    });
  }

  function tickCombatFx(step) {
    for (const fx of combatFx) fx.age += step;
    combatFx = combatFx.filter((fx) => fx.age < fx.life);
  }

  function drawCombatFx() {
    for (const fx of combatFx) {
      const t = Math.min(1, fx.age / fx.life);
      const ease = 1 - ((1 - t) * (1 - t));
      const x = fx.x - cameraX;
      const y = fx.y;
      const alpha = Math.max(0, 1 - t);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = fx.accent;
      ctx.fillStyle = fx.accent;
      ctx.shadowColor = fx.accent;
      ctx.shadowBlur = 14 * alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (fx.type === 'electric-star') {
        ctx.lineWidth = 2.4 * fx.size;
        for (let i = 0; i < 5; i += 1) {
          const angle = i * (Math.PI * 2 / 5) + fx.seed;
          const length = (8 + 19 * ease) * fx.size;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3);
          ctx.lineTo(Math.cos(angle + 0.16) * length * 0.48, Math.sin(angle + 0.16) * length * 0.48);
          ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
          ctx.stroke();
        }
      } else if (fx.type === 'ice-shard') {
        for (let i = 0; i < 6; i += 1) {
          const angle = i * (Math.PI * 2 / 6) + fx.seed;
          const distance = (4 + 20 * ease) * fx.size;
          const sx = Math.cos(angle) * distance;
          const sy = Math.sin(angle) * distance;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(angle + Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -5 * fx.size);
          ctx.lineTo(2.4 * fx.size, 1.5 * fx.size);
          ctx.lineTo(0, 5 * fx.size);
          ctx.lineTo(-2.4 * fx.size, 1.5 * fx.size);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (fx.type === 'fire-burst') {
        for (let i = 0; i < 7; i += 1) {
          const angle = i * (Math.PI * 2 / 7) + fx.seed;
          const distance = (3 + 18 * ease) * fx.size;
          const px = Math.cos(angle) * distance;
          const py = Math.sin(angle) * distance;
          ctx.beginPath();
          ctx.moveTo(px - 2.5 * fx.size, py + 3 * fx.size);
          ctx.quadraticCurveTo(px, py - (5 + 4 * (1 - t)) * fx.size, px + 2.5 * fx.size, py + 3 * fx.size);
          ctx.fill();
        }
      } else if (fx.type === 'absorb-ring') {
        ctx.lineWidth = 3.4 * fx.size;
        ctx.beginPath();
        ctx.arc(0, 0, (8 + 34 * ease) * fx.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.8;
        for (let i = 0; i < 8; i += 1) {
          const angle = i * Math.PI / 4 + t * 2;
          const radius = (12 + 26 * ease) * fx.size;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 2.2 * fx.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.type === 'boss-defeat') {
        ctx.lineWidth = 4 * fx.size;
        for (let ring = 0; ring < 2; ring += 1) {
          ctx.beginPath();
          ctx.arc(0, 0, (10 + (28 + ring * 18) * ease) * fx.size, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < 10; i += 1) {
          const angle = i * (Math.PI * 2 / 10) + fx.seed;
          const radius = (12 + 40 * ease) * fx.size;
          ctx.fillRect(Math.cos(angle) * radius - 1.5, Math.sin(angle) * radius - 1.5, 3, 3);
        }
      } else if (fx.type === 'reward-sparkle') {
        for (let i = 0; i < 6; i += 1) {
          const angle = i * Math.PI / 3 + fx.seed;
          const radius = (5 + 22 * ease) * fx.size;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius - 10 * ease;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle + t);
          ctx.beginPath();
          ctx.moveTo(0, -4 * fx.size);
          ctx.lineTo(1.4 * fx.size, -1.2 * fx.size);
          ctx.lineTo(4 * fx.size, 0);
          ctx.lineTo(1.4 * fx.size, 1.2 * fx.size);
          ctx.lineTo(0, 4 * fx.size);
          ctx.lineTo(-1.4 * fx.size, 1.2 * fx.size);
          ctx.lineTo(-4 * fx.size, 0);
          ctx.lineTo(-1.4 * fx.size, -1.2 * fx.size);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.lineWidth = 2.8 * fx.size;
        for (let i = 0; i < 6; i += 1) {
          const angle = i * Math.PI / 3 + fx.seed;
          const radius = (4 + 16 * ease) * fx.size;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3);
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

`;
  source = source.replace(helperAnchor, helpers + helperAnchor);
  source = source.replace(
    '  function rewardEnemy(enemy) {\n    defeated += 1;',
    `  function rewardEnemy(enemy) {\n    spawnRewardFx(enemy);\n    defeated += 1;`
  );
  source = source.replace(
    '    enemy.hitFlash = 0.14;',
    `    enemy.hitFlash = 0.14;\n    spawnImpactFx(enemy, projectile.effect);`
  );
  source = source.replace(
    '    simTime += step;',
    `    simTime += step;\n    tickCombatFx(step);`
  );
  source = source.replace(
    '    for (const projectile of projectiles) drawProjectile(projectile);',
    `    for (const projectile of projectiles) drawProjectile(projectile);\n    drawCombatFx();`
  );

  fs.writeFileSync(combatPath, source);
  console.log(JSON.stringify({ ok: true, impactFx: FX_VERSION, patched: true }));
}
