import fs from 'node:fs';

const root='site/public-route-patch/games/protect-the-plants';
const enhancePath=`${root}/enhancements.js`;
let enhancements=fs.readFileSync(enhancePath,'utf8');

function replaceOnce(text,oldValue,newValue,label){
  if(!text.includes(oldValue))throw new Error(`Missing expected ${label}`);
  return text.replace(oldValue,newValue);
}

enhancements=replaceOnce(enhancements,
  "  const defaultPrefs = { sound: true, haptics: true, confirmShots: false };",
  "  const defaultPrefs = { sound: true, haptics: true };",
  'default preferences');
enhancements=replaceOnce(enhancements,
  "  let armedShotKey = '';\n  let armedShotUntil = 0;\n",
  '',
  'legacy armed-shot state');
enhancements=replaceOnce(enhancements,
  '          <label><span><strong>Confirm firing taps</strong><small>Tap a target once to aim, then again to fire. Helps prevent mobile mis-taps.</small></span><input type="checkbox" data-ptp-pref="confirmShots"></label>\n',
  '',
  'legacy confirm setting');
const interceptor=`  document.addEventListener('click', event => {\n    if (!prefs.confirmShots) return;\n    const cell = event.target.closest?.('.cell[data-fire]');\n    if (!cell || state?.status !== 'playing' || state?.turnPlayerId !== state?.me?.id) return;\n    const key = cell.dataset.fire;\n    const now = Date.now();\n    if (armedShotKey === key && now <= armedShotUntil) {\n      armedShotKey = '';\n      armedShotUntil = 0;\n      return;\n    }\n    event.preventDefault();\n    event.stopImmediatePropagation();\n    document.querySelectorAll('.cell.ptp-shot-armed').forEach(el => el.classList.remove('ptp-shot-armed'));\n    armedShotKey = key;\n    armedShotUntil = now + 4000;\n    cell.classList.add('ptp-shot-armed');\n    const [row, col] = key.split(',').map(Number);\n    toast(\`Target \${coord(row, col)} armed — tap again to fire.\`);\n    vibrate(18);\n  }, true);\n\n`;
enhancements=replaceOnce(enhancements,interceptor,'','legacy confirm click interceptor');
for(const forbidden of ['confirmShots','armedShotKey','armedShotUntil','ptp-shot-armed']){
  if(enhancements.includes(forbidden))throw new Error(`Legacy targeting marker remains: ${forbidden}`);
}
fs.writeFileSync(enhancePath,enhancements);

const indexPath=`${root}/index.html`;
let index=fs.readFileSync(indexPath,'utf8');
index=replaceOnce(index,'  <script src="./targeting-policy-v1.js" defer></script>\n','','targeting policy script tag');
fs.writeFileSync(indexPath,index);

const swPath=`${root}/sw.js`;
let sw=fs.readFileSync(swPath,'utf8');
sw=replaceOnce(sw,"const CACHE='ptp-shell-v7-burn-buds-targeting-policy-20260905';","const CACHE='ptp-shell-v8-burn-buds-native-targeting-20260905';",'service worker cache marker');
sw=replaceOnce(sw,"'./runtime-sync-v1.js','./targeting-policy-v1.js','./enhancements.js'","'./runtime-sync-v1.js','./enhancements.js'",'targeting policy cache entry');
fs.writeFileSync(swPath,sw);

const policyPath=`${root}/targeting-policy-v1.js`;
if(!fs.existsSync(policyPath))throw new Error('Targeting policy file was not found.');
fs.unlinkSync(policyPath);

console.log('Removed legacy confirmShots source path and retired targeting policy guard.');
