import fs from 'node:fs';

const file='site/public-route-patch/games/protect-the-plants/enhancements.js';
const original=fs.readFileSync(file,'utf8');
const oldBlock=`  const observer = new MutationObserver(queueEnhance);\n  observer.observe(app, { childList: true, subtree: true });\n  queueEnhance();\n`;
const newBlock=`  if (window.BurnBudsSync) window.BurnBudsSync.subscribe(queueEnhance, { immediate: false });\n  queueEnhance();\n`;
if(!original.includes(oldBlock))throw new Error('Expected enhancements observer block was not found.');
const next=original.replace(oldBlock,newBlock);
if(next.includes('new MutationObserver'))throw new Error('Enhancements still owns a MutationObserver after patch.');
if(!next.includes('BurnBudsSync.subscribe(queueEnhance'))throw new Error('Shared sync subscription was not installed.');
fs.writeFileSync(file,next);
console.log('Patched Burn Buds enhancements render sync.');
