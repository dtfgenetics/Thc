import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const VERSION = 'seed-man-enemy-visuals-v3';

if (!fs.existsSync(combatPath)) throw new Error(`Missing Seed Man combat runtime: ${combatPath}`);

let source = fs.readFileSync(combatPath, 'utf8');
if (source.includes(VERSION)) {
  console.log(JSON.stringify({ ok: true, enemyVisuals: VERSION, patched: false }));
  process.exit(0);
}

const visualMarker = "  const ENEMY_VISUAL_VERSION = 'seed-man-enemy-visuals-v2';";
const drawEnemyMarker = '  function drawEnemy(enemy) {';
if (!source.includes(visualMarker) || !source.includes(drawEnemyMarker)) {
  throw new Error('Seed Man enemy visual v2 runtime is missing expected patch anchors.');
}

const helpers = `  const ENEMY_VISUAL_ENHANCEMENT_VERSION = '${VERSION}';

  function drawPhenotypeSignature(enemy, accent) {
    if (!enemy.phenotype) return;
    const key = String(enemy.phenotype).toLowerCase();
    const radius = Math.max(enemy.width, enemy.height) * 0.48;
    const t = simTime || 0;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = enemy.bossRank ? 14 : 8;
    ctx.globalAlpha = enemy.bossRank ? 0.82 : 0.62;

    if (/fire|flare|solar/.test(key)) {
      for (let i = 0; i < 5; i += 1) {
        const a = t * 1.8 + i * (Math.PI * 2 / 5);
        const r = radius * (0.74 + (i % 2) * 0.13);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.55;
        ctx.beginPath();
        ctx.moveTo(px, py - 5);
        ctx.quadraticCurveTo(px + 5, py, px, py + 8);
        ctx.quadraticCurveTo(px - 5, py + 1, px, py - 5);
        ctx.fill();
      }
    } else if (/static|electric|volt|lightning/.test(key)) {
      ctx.lineWidth = Math.max(2, enemy.width * 0.035);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * radius * 0.35, -radius * 0.72);
        ctx.lineTo(side * radius * 0.1, -radius * 0.2);
        ctx.lineTo(side * radius * 0.38, -radius * 0.12);
        ctx.lineTo(side * radius * 0.08, radius * 0.52);
        ctx.stroke();
      }
    } else if (/frost|ice|crystal/.test(key)) {
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + t * 0.35;
        const px = Math.cos(a) * radius * 0.82;
        const py = Math.sin(a) * radius * 0.5;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      for (let i = 0; i < 4; i += 1) {
        const a = t * 0.65 + i * Math.PI / 2;
        const px = Math.cos(a) * radius * 0.82;
        const py = Math.sin(a) * radius * 0.52;
        ctx.beginPath();
        ctx.ellipse(px, py, 6, 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBossCrown(enemy, accent) {
    if (!enemy.bossRank) return;
    const w = enemy.width;
    const h = enemy.height;
    ctx.save();
    ctx.strokeStyle = '#142019';
    ctx.fillStyle = accent;
    ctx.lineWidth = Math.max(2.5, w * 0.045);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -h * 0.34);
    ctx.lineTo(-w * 0.18, -h * 0.56);
    ctx.lineTo(-w * 0.04, -h * 0.39);
    ctx.lineTo(w * 0.08, -h * 0.61);
    ctx.lineTo(w * 0.22, -h * 0.4);
    ctx.lineTo(w * 0.3, -h * 0.53);
    ctx.lineTo(w * 0.34, -h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemyGrounding(enemy, accent) {
    const w = enemy.width;
    const h = enemy.height;
    ctx.save();
    ctx.globalAlpha = enemy.flying ? 0.18 : 0.28;
    ctx.fillStyle = enemy.flying ? accent : '#07120c';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.43, w * (enemy.flying ? 0.34 : 0.42), h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

`;

source = source.replace(visualMarker, `${visualMarker}\n${helpers}`);
source = source.replace(
  '    ctx.scale(enemy.dir, 1);\n',
  '    ctx.scale(enemy.dir, 1);\n    drawEnemyGrounding(enemy, accent);\n    drawPhenotypeSignature(enemy, accent);\n'
);
source = source.replace(
  '    drawEnemySilhouette(enemy, family, accent);',
  '    drawEnemySilhouette(enemy, family, accent);\n    drawBossCrown(enemy, accent);'
);

if (!source.includes(VERSION) || !source.includes('drawPhenotypeSignature(enemy, accent);') || !source.includes('drawBossCrown(enemy, accent);')) {
  throw new Error('Seed Man enemy visual v3 patch did not land completely.');
}
fs.writeFileSync(combatPath, source);
console.log(JSON.stringify({ ok: true, enemyVisuals: VERSION, patched: true, phenotypeSignatures: true, bossCrowns: true, grounding: true }));
