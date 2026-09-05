import fs from 'node:fs';

function patch(file,replacements){
  let text=fs.readFileSync(file,'utf8');
  for(const [oldValue,newValue,label] of replacements){
    if(!text.includes(oldValue))throw new Error(`${file}: missing ${label}`);
    text=text.replace(oldValue,newValue);
  }
  fs.writeFileSync(file,text);
}

patch('games/protect-the-plants/test/burn-buds-branding.test.mjs',[
  ["for (const marker of [\"document.title = '● Your Turn · Burn Buds'\",'<small>BURN BUDS</small>','Confirm firing taps','tap again to fire.','BUDS BURNED','Join my Burn Buds game']) {","for (const marker of [\"document.title = '● Your Turn · Burn Buds'\",'<small>BURN BUDS</small>','BUDS BURNED','Join my Burn Buds game']) {",'enhancement markers'],
  ["for (const forbidden of ['<small>PROTECT THE PLANTS</small>','Confirm scouting taps','tap again to scout.','Join my Protect the Plants game','Garden state updated.','FORMATION FOUND']) {","for (const forbidden of ['<small>PROTECT THE PLANTS</small>','Confirm scouting taps','tap again to scout.','Confirm firing taps','confirmShots','ptp-shot-armed','Join my Protect the Plants game','Garden state updated.','FORMATION FOUND']) {",'enhancement forbidden markers'],
  ["assert.ok(index.includes('./targeting-policy-v1.js'));\n",'', 'policy page assertion'],
  ["ptp-shell-v7-burn-buds-targeting-policy-20260905","ptp-shell-v8-burn-buds-native-targeting-20260905",'v8 cache marker'],
  ["['./runtime-sync-v1.js','./targeting-policy-v1.js','./combat-a11y-v1.js'","['./runtime-sync-v1.js','./combat-a11y-v1.js'",'policy cache asset']
]);

patch('games/protect-the-plants/test/burn-buds-gameplay-v3.test.mjs',[
  ["'runtime-sync-v1.js', 'targeting-policy-v1.js', 'presence.php'","'runtime-sync-v1.js', 'presence.php'",'policy asset existence'],
  ["assert.ok(index.includes('./targeting-policy-v1.js'));\n",'', 'policy index assertion'],
  ["assert.ok(sw.includes('./targeting-policy-v1.js'));\n",'', 'policy sw assertion'],
  ["ptp-shell-v7-burn-buds-targeting-policy-20260905","ptp-shell-v8-burn-buds-native-targeting-20260905",'v8 gameplay cache marker']
]);

patch('games/protect-the-plants/test/runtime-sync-v1.test.mjs',[
  ["ptp-shell-v7-burn-buds-targeting-policy-20260905","ptp-shell-v8-burn-buds-native-targeting-20260905",'v8 runtime cache marker']
]);

patch('.github/workflows/burn-buds-branding-ci.yml',[
  ["combat-a11y-v1.js runtime-sync-v1.js targeting-policy-v1.js plant.svg","combat-a11y-v1.js runtime-sync-v1.js plant.svg",'policy asset list'],
  ["          node --check \"$root/targeting-policy-v1.js\"\n",'', 'policy syntax check'],
  ["          node games/protect-the-plants/test/targeting-policy-v1.test.mjs\n","          node games/protect-the-plants/test/native-targeting-source.test.mjs\n",'targeting policy test invocation'],
  ["          grep -Fq './targeting-policy-v1.js' \"$root/index.html\"\n",'', 'policy page grep'],
  ["          grep -Fq 'targeting-policy-v1.js' \"$root/sw.js\"\n",'', 'policy sw grep']
]);

const oldTest='games/protect-the-plants/test/targeting-policy-v1.test.mjs';
if(!fs.existsSync(oldTest))throw new Error('Old targeting policy test missing.');
fs.unlinkSync(oldTest);

fs.writeFileSync('games/protect-the-plants/test/native-targeting-source.test.mjs',`import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\n\nconst root=path.resolve('site/public-route-patch/games/protect-the-plants');\nconst read=file=>fs.readFileSync(path.join(root,file),'utf8');\nconst enhancements=read('enhancements.js');\nconst targeting=read('targeting-v1.js');\nconst index=read('index.html');\nconst sw=read('sw.js');\n\nfor(const forbidden of ['confirmShots','armedShotKey','armedShotUntil','ptp-shot-armed','Confirm firing taps']) assert.ok(!enhancements.includes(forbidden),\\`Legacy shot confirmation source remains: \\${forbidden}\\`);\nassert.ok(!fs.existsSync(path.join(root,'targeting-policy-v1.js')),'Temporary targeting policy guard must be retired.');\nassert.ok(!index.includes('./targeting-policy-v1.js'),'Production page must not load retired targeting policy guard.');\nassert.ok(!sw.includes('./targeting-policy-v1.js'),'Service worker must not cache retired targeting policy guard.');\nassert.ok(sw.includes('ptp-shell-v8-burn-buds-native-targeting-20260905'));\nfor(const marker of [\"const coarsePointer=()=>window.matchMedia?.('(pointer: coarse)').matches===true\",'Tap once to aim. Tap the same cell again to fire.','target-armed','aria-pressed']) assert.ok(targeting.includes(marker),\\`Missing native targeting marker: \\${marker}\\`);\nconsole.log('Burn Buds native targeting source is authoritative and legacy confirmShots code is removed.');\n`);

console.log('Updated Burn Buds native targeting contracts for v8 source cleanup.');
