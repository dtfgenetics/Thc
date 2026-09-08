import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const VFX_VERSION = 'seed-man-elemental-vfx-v2';

if (!fs.existsSync(combatPath)) throw new Error(`Missing Seed Man combat runtime: ${combatPath}`);

let source = fs.readFileSync(combatPath, 'utf8');
if (source.includes(VFX_VERSION)) {
  console.log(JSON.stringify({ ok: true, elementalVfx: VFX_VERSION, patched: false }));
} else {
  const start = source.indexOf('  function drawProjectile(projectile) {');
  const end = source.indexOf('  function drawPhenotypeFormFx() {', start);
  if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Seed Man projectile renderer replacement boundaries.');

  const replacement = `  const ELEMENTAL_VFX_VERSION = '${VFX_VERSION}';

  function drawProjectileTrail(x, y, color, direction, length, width) {
    const gradient = ctx.createLinearGradient(x - direction * length, y, x, y);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.55, color + '55');
    gradient.addColorStop(1, color + 'cc');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, y - width * 0.5);
    ctx.lineTo(x - direction * length, y);
    ctx.lineTo(x, y + width * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  function drawProjectile(projectile) {
    const x = projectile.x - cameraX + projectile.width / 2;
    const y = projectile.y + projectile.height / 2;
    const direction = Math.sign(projectile.vx || 1) || 1;
    const size = Math.max(projectile.width, projectile.height);
    const time = simTime;
    const effect = projectile.effect || 'seed';

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (effect === 'burn') {
      drawProjectileTrail(x, y, '#ff7b32', direction, size * 2.9, size * 1.2);
      ctx.shadowBlur = projectile.ability ? 20 : 13;
      ctx.shadowColor = '#ff5b25';
      ctx.fillStyle = '#ff6b2c';
      ctx.beginPath();
      ctx.moveTo(x + direction * size * 0.7, y);
      ctx.quadraticCurveTo(x - direction * size * 0.05, y - size * 0.65, x - direction * size * 0.45, y - size * 0.15);
      ctx.quadraticCurveTo(x - direction * size * 0.85, y, x - direction * size * 0.45, y + size * 0.18);
      ctx.quadraticCurveTo(x - direction * size * 0.02, y + size * 0.62, x + direction * size * 0.7, y);
      ctx.fill();
      ctx.fillStyle = '#ffd46a';
      ctx.beginPath();
      ctx.ellipse(x + direction * size * 0.12, y, size * 0.33, size * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect === 'chain') {
      ctx.shadowBlur = projectile.ability ? 20 : 14;
      ctx.shadowColor = '#ffe26b';
      ctx.strokeStyle = '#fff6a3';
      ctx.lineWidth = Math.max(2.2, size * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - direction * size * 0.85, y + Math.sin(time * 22) * 1.5);
      ctx.lineTo(x - direction * size * 0.35, y - size * 0.45);
      ctx.lineTo(x, y + size * 0.18);
      ctx.lineTo(x + direction * size * 0.32, y - size * 0.38);
      ctx.lineTo(x + direction * size * 0.82, y + Math.cos(time * 20) * 1.5);
      ctx.stroke();
      ctx.strokeStyle = '#f2c73d';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.stroke();
    } else if (effect === 'freeze') {
      drawProjectileTrail(x, y, '#8fe7ff', direction, size * 2.2, size * 0.8);
      ctx.shadowBlur = projectile.ability ? 18 : 11;
      ctx.shadowColor = '#7ce5ff';
      ctx.fillStyle = '#baf3ff';
      ctx.strokeStyle = '#56bfe3';
      ctx.lineWidth = Math.max(1.4, size * 0.1);
      ctx.beginPath();
      ctx.moveTo(x + direction * size * 0.75, y);
      ctx.lineTo(x - direction * size * 0.05, y - size * 0.55);
      ctx.lineTo(x - direction * size * 0.62, y);
      ctx.lineTo(x - direction * size * 0.05, y + size * 0.55);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + direction * size * 0.46, y);
      ctx.lineTo(x - direction * size * 0.03, y - size * 0.23);
      ctx.lineTo(x - direction * size * 0.2, y);
      ctx.closePath(); ctx.fill();
    } else if (effect === 'spore') {
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#d2a6ff';
      for (let i = 0; i < 5; i += 1) {
        const angle = time * 3 + i * (Math.PI * 2 / 5);
        const radius = size * (0.38 + (i % 2) * 0.12);
        ctx.fillStyle = i % 2 ? '#d2a6ff' : '#9ae0b4';
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.max(1.2, size * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#efe5ff';
      ctx.beginPath(); ctx.arc(x, y, size * 0.28, 0, Math.PI * 2); ctx.fill();
    } else if (effect === 'pierce') {
      drawProjectileTrail(x, y, '#d9fbff', direction, size * 2.5, size * 0.55);
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#d9fbff';
      ctx.fillStyle = '#e8fdff';
      ctx.strokeStyle = '#8ddbe7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + direction * size * 0.95, y);
      ctx.lineTo(x - direction * size * 0.5, y - size * 0.24);
      ctx.lineTo(x - direction * size * 0.28, y);
      ctx.lineTo(x - direction * size * 0.5, y + size * 0.24);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      drawProjectileTrail(x, y, '#8cf36b', direction, size * 1.7, size * 0.42);
      ctx.shadowBlur = projectile.ability ? 12 : 6;
      ctx.shadowColor = '#8cf36b';
      ctx.fillStyle = '#b8f58f';
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.48, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4b8f3d';
      ctx.beginPath();
      ctx.ellipse(x - direction * size * 0.08, y - size * 0.04, size * 0.18, size * 0.09, direction * -0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

`;

  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(combatPath, source);
  console.log(JSON.stringify({ ok: true, elementalVfx: VFX_VERSION, patched: true }));
}
