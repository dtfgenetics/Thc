import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const VISUAL_VERSION = 'seed-man-enemy-visuals-v2';

if (!fs.existsSync(combatPath)) throw new Error(`Missing Seed Man combat runtime: ${combatPath}`);

let source = fs.readFileSync(combatPath, 'utf8');
if (source.includes(VISUAL_VERSION)) {
  console.log(JSON.stringify({ ok: true, enemyVisuals: VISUAL_VERSION, patched: false }));
} else {
  const start = source.indexOf('  function drawEnemy(enemy) {');
  const end = source.indexOf('  function drawProjectile(projectile) {', start);
  if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Seed Man enemy renderer replacement boundaries.');

  const replacement = `  const ENEMY_VISUAL_VERSION = '${VISUAL_VERSION}';

  function enemyVisualFamily(enemy) {
    const key = \`${'${enemy.id}'} ${'${enemy.name}'}\`.toLowerCase();
    if (enemy.bossRank === 'major') {
      if (/queen|mite/.test(key)) return 'tank';
      if (/spore|seraph|moth/.test(key)) return 'corrupted-tree';
      if (/warp|weaver|gravity/.test(key)) return 'sky-fortress';
      return 'boss';
    }
    if (enemy.bossRank === 'minor') {
      if (/golem/.test(key)) return 'golem';
      if (/hornet|wasp/.test(key)) return 'drone';
      return 'brute';
    }
    if (/fungus|mushroom|spore|moth/.test(key)) return 'fungus';
    if (/gnat|wasp|hornet|midge|fly/.test(key) || enemy.flying) return 'drone';
    if (/mite|beetle|borer|weevil/.test(key)) return 'beetle';
    if (/thrip/.test(key)) return 'runner';
    if (/aphid/.test(key)) return 'slime';
    return 'creature';
  }

  function drawEnemyEye(x, y, radius, accent = '#ff554c') {
    ctx.fillStyle = '#0b1210';
    ctx.beginPath(); ctx.arc(x, y, radius * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent;
    ctx.shadowBlur = 8;
    ctx.shadowColor = accent;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawEnemyLegs(width, height, count = 3) {
    ctx.strokeStyle = '#18231d';
    ctx.lineWidth = Math.max(2, width * 0.055);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i += 1) {
      const y = -height * 0.17 + i * (height * 0.17);
      ctx.beginPath();
      ctx.moveTo(-width * 0.22, y);
      ctx.lineTo(-width * 0.42, y + height * 0.17);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width * 0.22, y);
      ctx.lineTo(width * 0.42, y + height * 0.17);
      ctx.stroke();
    }
  }

  function drawEnemySilhouette(enemy, family, accent) {
    const width = enemy.width;
    const height = enemy.height;
    const flash = enemy.hitFlash > 0;
    ctx.strokeStyle = '#142019';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (family === 'slime') {
      ctx.fillStyle = flash ? '#ffffff' : enemy.elite ? '#80d7de' : '#617b35';
      ctx.lineWidth = Math.max(2, width * 0.07);
      ctx.beginPath();
      ctx.moveTo(-width * 0.42, height * 0.22);
      ctx.quadraticCurveTo(-width * 0.38, -height * 0.32, -width * 0.12, -height * 0.32);
      ctx.quadraticCurveTo(0, -height * 0.52, width * 0.12, -height * 0.32);
      ctx.quadraticCurveTo(width * 0.38, -height * 0.31, width * 0.42, height * 0.22);
      ctx.quadraticCurveTo(width * 0.18, height * 0.42, 0, height * 0.29);
      ctx.quadraticCurveTo(-width * 0.2, height * 0.42, -width * 0.42, height * 0.22);
      ctx.fill(); ctx.stroke();
      drawEnemyEye(-width * 0.12, -height * 0.05, Math.max(1.6, width * 0.055), accent);
      drawEnemyEye(width * 0.12, -height * 0.05, Math.max(1.6, width * 0.055), accent);
      return;
    }

    if (family === 'runner') {
      ctx.fillStyle = flash ? '#ffffff' : enemy.elite ? '#e66c3f' : '#b96b32';
      ctx.lineWidth = Math.max(2, width * 0.065);
      ctx.beginPath(); ctx.ellipse(0, 0, width * 0.37, height * 0.27, -0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#253629';
      ctx.beginPath(); ctx.ellipse(width * 0.28, -height * 0.03, width * 0.18, height * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawEnemyLegs(width, height, 2);
      drawEnemyEye(width * 0.34, -height * 0.07, Math.max(1.5, width * 0.05), accent);
      return;
    }

    if (family === 'beetle') {
      drawEnemyLegs(width, height, 3);
      ctx.fillStyle = flash ? '#ffffff' : enemy.elite ? '#49377e' : '#923d30';
      ctx.lineWidth = Math.max(2.5, width * 0.07);
      ctx.beginPath(); ctx.ellipse(0, 0, width * 0.35, height * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, width * 0.035);
      ctx.beginPath(); ctx.moveTo(0, -height * 0.27); ctx.lineTo(0, height * 0.27); ctx.stroke();
      drawEnemyEye(width * 0.2, -height * 0.05, Math.max(1.5, width * 0.045), accent);
      return;
    }

    if (family === 'drone') {
      const wing = 1 + Math.sin(simTime * 24) * 0.16;
      ctx.fillStyle = 'rgba(221,244,234,.82)';
      ctx.strokeStyle = '#263832';
      ctx.lineWidth = Math.max(1.5, width * 0.04);
      for (const side of [-1, 1]) {
        ctx.save(); ctx.scale(side, 1);
        ctx.beginPath(); ctx.ellipse(width * 0.28, -height * 0.16, width * 0.28 * wing, height * 0.18, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = flash ? '#ffffff' : enemy.elite ? '#50535e' : '#343a3b';
      ctx.lineWidth = Math.max(2.2, width * 0.06);
      ctx.beginPath(); ctx.ellipse(0, 0, width * 0.31, height * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1c2523';
      ctx.fillRect(-width * 0.3, -height * 0.08, width * 0.16, height * 0.15);
      ctx.fillRect(width * 0.14, -height * 0.08, width * 0.16, height * 0.15);
      drawEnemyEye(0, -height * 0.02, Math.max(2, width * 0.06), accent);
      return;
    }

    if (family === 'fungus') {
      ctx.strokeStyle = '#20251e';
      ctx.lineWidth = Math.max(2.4, width * 0.06);
      ctx.fillStyle = flash ? '#ffffff' : '#7c5a78';
      ctx.beginPath(); ctx.roundRect(-width * 0.12, -height * 0.02, width * 0.24, height * 0.38, width * 0.09); ctx.fill(); ctx.stroke();
      ctx.fillStyle = enemy.elite ? '#b257a0' : '#8b456f';
      ctx.beginPath(); ctx.ellipse(0, -height * 0.2, width * 0.38, height * 0.22, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e9bed9';
      for (const x of [-0.2, 0.02, 0.22]) { ctx.beginPath(); ctx.arc(width * x, -height * 0.23, Math.max(1.5, width * 0.035), 0, Math.PI * 2); ctx.fill(); }
      drawEnemyEye(0, height * 0.08, Math.max(1.7, width * 0.045), accent);
      return;
    }

    if (family === 'golem' || family === 'brute') {
      ctx.fillStyle = flash ? '#ffffff' : family === 'golem' ? '#6b756f' : '#667c37';
      ctx.lineWidth = Math.max(3, width * 0.07);
      ctx.beginPath();
      ctx.moveTo(-width * 0.38, height * 0.26); ctx.lineTo(-width * 0.32, -height * 0.25); ctx.lineTo(-width * 0.12, -height * 0.4);
      ctx.lineTo(width * 0.18, -height * 0.34); ctx.lineTo(width * 0.4, -height * 0.08); ctx.lineTo(width * 0.34, height * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke();
      drawEnemyEye(-width * 0.1, -height * 0.05, Math.max(2, width * 0.045), accent);
      drawEnemyEye(width * 0.12, -height * 0.06, Math.max(2, width * 0.045), accent);
      return;
    }

    if (family === 'tank') {
      ctx.fillStyle = flash ? '#ffffff' : '#445244';
      ctx.lineWidth = Math.max(3.5, width * 0.06);
      ctx.beginPath(); ctx.roundRect(-width * 0.42, -height * 0.27, width * 0.84, height * 0.58, width * 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a322d';
      ctx.beginPath(); ctx.arc(0, -height * 0.06, width * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#27312c'; ctx.lineWidth = Math.max(3, width * 0.05);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * width * 0.27, height * 0.18); ctx.lineTo(side * width * 0.44, height * 0.38); ctx.stroke(); }
      drawEnemyEye(0, -height * 0.06, Math.max(3, width * 0.06), accent);
      return;
    }

    if (family === 'corrupted-tree') {
      ctx.strokeStyle = '#281e2d';
      ctx.lineWidth = Math.max(4, width * 0.075);
      ctx.beginPath(); ctx.moveTo(0, height * 0.34); ctx.lineTo(-width * 0.04, -height * 0.1); ctx.lineTo(-width * 0.22, -height * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -height * 0.08); ctx.lineTo(width * 0.27, -height * 0.39); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-width * 0.03, -height * 0.05); ctx.lineTo(-width * 0.34, -height * 0.2); ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#46304b';
      ctx.beginPath(); ctx.ellipse(0, -height * 0.03, width * 0.26, height * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawEnemyEye(-width * 0.08, -height * 0.1, Math.max(2.5, width * 0.045), accent);
      drawEnemyEye(width * 0.08, -height * 0.1, Math.max(2.5, width * 0.045), accent);
      return;
    }

    if (family === 'sky-fortress' || family === 'boss') {
      ctx.fillStyle = flash ? '#ffffff' : '#343843';
      ctx.lineWidth = Math.max(3.5, width * 0.055);
      ctx.beginPath(); ctx.roundRect(-width * 0.4, -height * 0.22, width * 0.8, height * 0.44, width * 0.13); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#262a33';
      for (const x of [-0.28, 0.28]) { ctx.beginPath(); ctx.arc(width * x, height * 0.03, width * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = accent;
      ctx.shadowBlur = 12; ctx.shadowColor = accent;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(4, width * 0.09), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      return;
    }

    ctx.fillStyle = flash ? '#ffffff' : enemy.elite ? '#6c4ed8' : '#789d45';
    ctx.lineWidth = Math.max(2, width * 0.06);
    ctx.beginPath(); ctx.ellipse(0, 0, width * 0.38, height * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawEnemyEye(width * 0.12, -height * 0.05, Math.max(1.5, width * 0.05), accent);
  }

  function drawEnemy(enemy) {
    if (enemy.defeated) return;
    const x = enemy.x - cameraX;
    const y = enemy.y;
    const elite = Boolean(enemy.elite);
    const boss = Boolean(enemy.bossRank);
    const family = enemyVisualFamily(enemy);
    const accent = PHENOTYPES[enemy.phenotype]?.accent || (boss ? '#ff6b72' : elite ? '#c8f36a' : '#e2f0d9');

    ctx.save();
    ctx.translate(x + enemy.width / 2, y + enemy.height / 2);
    ctx.scale(enemy.dir, 1);

    if (enemy.telegraphClock > 0) {
      ctx.globalAlpha = 0.18 + Math.abs(Math.sin(simTime * 18)) * 0.28;
      ctx.fillStyle = accent;
      ctx.shadowBlur = 18;
      ctx.shadowColor = accent;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(enemy.width, enemy.height) * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.save();
    if (elite || boss) {
      ctx.globalAlpha = boss ? 0.32 : 0.22;
      ctx.strokeStyle = accent;
      ctx.lineWidth = boss ? 4 : 2.5;
      ctx.shadowBlur = boss ? 16 : 10;
      ctx.shadowColor = accent;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(enemy.width, enemy.height) * (boss ? 0.58 : 0.5) + Math.sin(simTime * 5) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    drawEnemySilhouette(enemy, family, accent);

    if (enemy.freeze > 0) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = '#b8efff';
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * enemy.width * 0.24, -enemy.height * 0.34); ctx.lineTo(side * enemy.width * 0.38, -enemy.height * 0.52); ctx.lineTo(side * enemy.width * 0.43, -enemy.height * 0.25); ctx.stroke();
      }
      ctx.restore();
    }
    if (enemy.burn > 0) {
      ctx.save();
      ctx.fillStyle = '#ff8d43';
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff6a2d';
      for (const offset of [-0.2, 0.12]) {
        ctx.beginPath(); ctx.moveTo(enemy.width * offset - 4, -enemy.height * 0.35); ctx.quadraticCurveTo(enemy.width * offset, -enemy.height * 0.68, enemy.width * offset + 5, -enemy.height * 0.34); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    const barWidth = Math.max(24, enemy.width);
    ctx.fillStyle = 'rgba(8,16,12,.82)';
    ctx.fillRect(x, y - (boss ? 13 : 10), barWidth, boss ? 8 : 5);
    ctx.fillStyle = boss ? '#ff6d74' : elite ? accent : '#8ed85f';
    ctx.fillRect(x, y - (boss ? 13 : 10), barWidth * (enemy.health / enemy.maxHealth), boss ? 8 : 5);
    if (boss) {
      ctx.font = '900 11px system-ui';
      ctx.fillStyle = '#f4f7ee';
      ctx.textAlign = 'center';
      ctx.fillText(\`${'${enemy.bossRank === \'major\' ? \'MAJOR\' : \'MINOR\'}'} · ${'${enemy.name}'}\`, x + enemy.width / 2, y - 18);
    }
  }

`;

  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(combatPath, source);
  console.log(JSON.stringify({ ok: true, enemyVisuals: VISUAL_VERSION, patched: true }));
}
