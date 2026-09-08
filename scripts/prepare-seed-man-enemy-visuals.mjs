import fs from 'node:fs';

const combatPath = 'site/public-route-patch/games/seed-man-platformer/combat-browser-v1.js';
const BASE_VERSION = 'seed-man-enemy-visuals-v2';
const VERSION = 'seed-man-enemy-visuals-v3';

if (!fs.existsSync(combatPath)) throw new Error(`Missing Seed Man combat runtime: ${combatPath}`);

let source = fs.readFileSync(combatPath, 'utf8');
if (source.includes(VERSION)) {
  console.log(JSON.stringify({ ok: true, enemyVisuals: VERSION, patched: false }));
  process.exit(0);
}

const start = source.indexOf('  function drawEnemy(enemy) {');
const end = source.indexOf('  function drawProjectile(projectile) {', start);
if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Seed Man enemy renderer replacement boundaries.');

const replacement = `  const ENEMY_VISUAL_VERSION = '${BASE_VERSION}';
  const ENEMY_VISUAL_ENHANCEMENT_VERSION = '${VERSION}';

  function enemyVisualFamily(enemy) {
    const key = \`${'${enemy.id}'} ${'${enemy.name}'}\`.toLowerCase();
    if (enemy.bossRank === 'major') {
      if (/queen|mite/.test(key)) return 'tank';
      if (/spore|seraph|moth|wraith/.test(key)) return 'corrupted-tree';
      if (/warp|weaver|gravity|hydra/.test(key)) return 'sky-fortress';
      return 'boss';
    }
    if (enemy.bossRank === 'minor') {
      if (/golem|guardian/.test(key)) return 'golem';
      if (/hornet|wasp|drone/.test(key)) return 'drone';
      return 'brute';
    }
    if (/fungus|mushroom|spore|moth/.test(key)) return 'fungus';
    if (/gnat|wasp|hornet|midge|fly|drone/.test(key) || enemy.flying) return 'drone';
    if (/mite|beetle|borer|weevil/.test(key)) return 'beetle';
    if (/thrip/.test(key)) return 'runner';
    if (/aphid|slime/.test(key)) return 'slime';
    return 'creature';
  }

  function drawEnemyEye(x, y, radius, accent) {
    ctx.fillStyle = '#0b1210';
    ctx.beginPath(); ctx.arc(x, y, radius * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent;
    ctx.shadowBlur = 8; ctx.shadowColor = accent;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawEnemyLegs(width, height, count = 3) {
    ctx.strokeStyle = '#18231d';
    ctx.lineWidth = Math.max(2, width * 0.055);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i += 1) {
      const y = -height * 0.17 + i * height * 0.17;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * width * 0.22, y);
        ctx.lineTo(side * width * 0.42, y + height * 0.17);
        ctx.stroke();
      }
    }
  }

  function drawEnemyGrounding(enemy, accent) {
    ctx.save();
    ctx.globalAlpha = enemy.flying ? 0.18 : 0.28;
    ctx.fillStyle = enemy.flying ? accent : '#07120c';
    ctx.beginPath();
    ctx.ellipse(0, enemy.height * 0.43, enemy.width * (enemy.flying ? 0.34 : 0.42), enemy.height * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPhenotypeSignature(enemy, accent) {
    if (!enemy.phenotype) return;
    const key = String(enemy.phenotype).toLowerCase();
    const radius = Math.max(enemy.width, enemy.height) * 0.48;
    const t = simTime || 0;
    ctx.save();
    ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.shadowColor = accent;
    ctx.shadowBlur = enemy.bossRank ? 14 : 8;
    ctx.globalAlpha = enemy.bossRank ? 0.82 : 0.65;
    if (/fire|flare|solar/.test(key)) {
      for (let i = 0; i < 5; i += 1) {
        const a = t * 1.8 + i * Math.PI * 0.4;
        const px = Math.cos(a) * radius * 0.82, py = Math.sin(a) * radius * 0.48;
        ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.quadraticCurveTo(px + 5, py, px, py + 8); ctx.quadraticCurveTo(px - 5, py + 1, px, py - 6); ctx.fill();
      }
    } else if (/static|electric|volt|lightning/.test(key)) {
      ctx.lineWidth = Math.max(2, enemy.width * 0.035);
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * radius * .35, -radius * .72); ctx.lineTo(side * radius * .1, -radius * .2); ctx.lineTo(side * radius * .38, -radius * .12); ctx.lineTo(side * radius * .08, radius * .52); ctx.stroke();
      }
    } else if (/frost|ice|crystal/.test(key)) {
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + t * .35;
        ctx.save(); ctx.translate(Math.cos(a) * radius * .82, Math.sin(a) * radius * .5); ctx.rotate(a + Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(5,0); ctx.lineTo(0,8); ctx.lineTo(-5,0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    } else {
      for (let i = 0; i < 4; i += 1) {
        const a = t * .65 + i * Math.PI / 2;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * radius * .82, Math.sin(a) * radius * .52, 6, 3, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBossCrown(enemy, accent) {
    if (!enemy.bossRank) return;
    const w = enemy.width, h = enemy.height;
    ctx.save(); ctx.strokeStyle = '#142019'; ctx.fillStyle = accent;
    ctx.lineWidth = Math.max(2.5, w * .045); ctx.shadowColor = accent; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(-w*.28,-h*.34); ctx.lineTo(-w*.18,-h*.56); ctx.lineTo(-w*.04,-h*.39); ctx.lineTo(w*.08,-h*.61); ctx.lineTo(w*.22,-h*.4); ctx.lineTo(w*.3,-h*.53); ctx.lineTo(w*.34,-h*.3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawEnemySilhouette(enemy, family, accent) {
    const w = enemy.width, h = enemy.height, flash = enemy.hitFlash > 0;
    ctx.strokeStyle = '#142019'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (family === 'slime') {
      ctx.fillStyle = flash ? '#fff' : enemy.elite ? '#80d7de' : '#617b35'; ctx.lineWidth = Math.max(2,w*.07);
      ctx.beginPath(); ctx.moveTo(-w*.42,h*.22); ctx.quadraticCurveTo(-w*.38,-h*.32,-w*.12,-h*.32); ctx.quadraticCurveTo(0,-h*.52,w*.12,-h*.32); ctx.quadraticCurveTo(w*.38,-h*.31,w*.42,h*.22); ctx.quadraticCurveTo(0,h*.48,-w*.42,h*.22); ctx.fill(); ctx.stroke();
      drawEnemyEye(-w*.12,-h*.05,Math.max(1.6,w*.055),accent); drawEnemyEye(w*.12,-h*.05,Math.max(1.6,w*.055),accent); return;
    }
    if (family === 'beetle') {
      drawEnemyLegs(w,h,3); ctx.fillStyle = flash ? '#fff' : enemy.elite ? '#49377e' : '#923d30'; ctx.lineWidth = Math.max(2.5,w*.07);
      ctx.beginPath(); ctx.ellipse(0,0,w*.35,h*.34,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.strokeStyle=accent; ctx.lineWidth=Math.max(1.5,w*.035); ctx.beginPath(); ctx.moveTo(0,-h*.27); ctx.lineTo(0,h*.27); ctx.stroke(); drawEnemyEye(w*.2,-h*.05,Math.max(1.5,w*.045),accent); return;
    }
    if (family === 'drone') {
      const wing = 1 + Math.sin(simTime*24)*.16; ctx.fillStyle='rgba(221,244,234,.82)'; ctx.strokeStyle='#263832'; ctx.lineWidth=Math.max(1.5,w*.04);
      for (const side of [-1,1]) { ctx.save(); ctx.scale(side,1); ctx.beginPath(); ctx.ellipse(w*.28,-h*.16,w*.28*wing,h*.18,-.35,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle=flash?'#fff':enemy.elite?'#50535e':'#343a3b'; ctx.lineWidth=Math.max(2.2,w*.06); ctx.beginPath(); ctx.ellipse(0,0,w*.31,h*.3,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); drawEnemyEye(0,-h*.02,Math.max(2,w*.06),accent); return;
    }
    if (family === 'fungus' || family === 'corrupted-tree') {
      ctx.strokeStyle='#281e2d'; ctx.lineWidth=Math.max(3,w*.065); ctx.fillStyle=flash?'#fff':family==='fungus'?'#8b456f':'#46304b';
      ctx.beginPath(); ctx.ellipse(0,h*.03,w*.25,h*.34,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0,-h*.25,w*.38,h*.18,0,Math.PI,Math.PI*2); ctx.fill(); ctx.stroke(); drawEnemyEye(-w*.08,-h*.04,Math.max(2,w*.045),accent); drawEnemyEye(w*.08,-h*.04,Math.max(2,w*.045),accent); return;
    }
    if (family === 'golem' || family === 'brute' || family === 'tank') {
      ctx.fillStyle=flash?'#fff':family==='tank'?'#445244':family==='golem'?'#6b756f':'#667c37'; ctx.lineWidth=Math.max(3,w*.07);
      ctx.beginPath(); ctx.moveTo(-w*.38,h*.26); ctx.lineTo(-w*.32,-h*.25); ctx.lineTo(-w*.12,-h*.4); ctx.lineTo(w*.18,-h*.34); ctx.lineTo(w*.4,-h*.08); ctx.lineTo(w*.34,h*.28); ctx.closePath(); ctx.fill(); ctx.stroke(); drawEnemyEye(-w*.1,-h*.05,Math.max(2,w*.045),accent); drawEnemyEye(w*.12,-h*.06,Math.max(2,w*.045),accent); return;
    }
    if (family === 'sky-fortress' || family === 'boss') {
      ctx.fillStyle=flash?'#fff':'#343843'; ctx.lineWidth=Math.max(3.5,w*.055); ctx.beginPath(); ctx.roundRect(-w*.4,-h*.22,w*.8,h*.44,w*.13); ctx.fill(); ctx.stroke(); ctx.fillStyle=accent; ctx.shadowBlur=12; ctx.shadowColor=accent; ctx.beginPath(); ctx.arc(0,0,Math.max(4,w*.09),0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; return;
    }
    ctx.fillStyle=flash?'#fff':enemy.elite?'#6c4ed8':'#789d45'; ctx.lineWidth=Math.max(2,w*.06); ctx.beginPath(); ctx.ellipse(0,0,w*.38,h*.34,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); drawEnemyEye(w*.12,-h*.05,Math.max(1.5,w*.05),accent);
  }

  function drawEnemy(enemy) {
    if (enemy.defeated) return;
    const x=enemy.x-cameraX, y=enemy.y, elite=Boolean(enemy.elite), boss=Boolean(enemy.bossRank);
    const family=enemyVisualFamily(enemy);
    const accent=PHENOTYPES[enemy.phenotype]?.accent || (boss?'#ff6b72':elite?'#c8f36a':'#e2f0d9');
    ctx.save(); ctx.translate(x+enemy.width/2,y+enemy.height/2); ctx.scale(enemy.dir,1);
    drawEnemyGrounding(enemy,accent); drawPhenotypeSignature(enemy,accent);
    if (enemy.telegraphClock>0) { ctx.globalAlpha=.18+Math.abs(Math.sin(simTime*18))*.28; ctx.fillStyle=accent; ctx.shadowBlur=18; ctx.shadowColor=accent; ctx.beginPath(); ctx.arc(0,0,Math.max(enemy.width,enemy.height)*.72,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.globalAlpha=1; }
    if (elite||boss) { ctx.save(); ctx.globalAlpha=boss?.32:.22; ctx.strokeStyle=accent; ctx.lineWidth=boss?4:2.5; ctx.shadowBlur=boss?16:10; ctx.shadowColor=accent; ctx.beginPath(); ctx.arc(0,0,Math.max(enemy.width,enemy.height)*(boss?.58:.5)+Math.sin(simTime*5)*2,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
    drawEnemySilhouette(enemy,family,accent); drawBossCrown(enemy,accent);
    if (enemy.freeze>0) { ctx.save(); ctx.globalAlpha=.72; ctx.strokeStyle='#b8efff'; ctx.lineWidth=2; for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*enemy.width*.24,-enemy.height*.34);ctx.lineTo(side*enemy.width*.38,-enemy.height*.52);ctx.lineTo(side*enemy.width*.43,-enemy.height*.25);ctx.stroke();}ctx.restore(); }
    if (enemy.burn>0) { ctx.save();ctx.fillStyle='#ff8d43';ctx.shadowBlur=10;ctx.shadowColor='#ff6a2d';for(const offset of [-.2,.12]){ctx.beginPath();ctx.moveTo(enemy.width*offset-4,-enemy.height*.35);ctx.quadraticCurveTo(enemy.width*offset,-enemy.height*.68,enemy.width*offset+5,-enemy.height*.34);ctx.fill();}ctx.restore(); }
    ctx.restore();
    const barWidth=Math.max(24,enemy.width); ctx.fillStyle='rgba(8,16,12,.82)'; ctx.fillRect(x,y-(boss?13:10),barWidth,boss?8:5); ctx.fillStyle=boss?'#ff6d74':elite?accent:'#8ed85f'; ctx.fillRect(x,y-(boss?13:10),barWidth*(enemy.health/enemy.maxHealth),boss?8:5);
    if(boss){ctx.font='900 11px system-ui';ctx.fillStyle='#f4f7ee';ctx.textAlign='center';ctx.fillText(\`${'${enemy.bossRank === \'major\' ? \'MAJOR\' : \'MINOR\'}'} · ${'${enemy.name}'}\`,x+enemy.width/2,y-18);}
  }

`;

source = source.slice(0,start) + replacement + source.slice(end);
fs.writeFileSync(combatPath,source);
console.log(JSON.stringify({ok:true,enemyVisuals:VERSION,baseEnemyVisuals:BASE_VERSION,patched:true,phenotypeSignatures:true,bossCrowns:true,grounding:true}));
