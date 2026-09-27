import fs from 'node:fs';

const html=fs.readFileSync('site/public-route-patch/ppfd-chart/index.html','utf8');
const errors=[];
const required=[
  "type=\"module\"",
  "/assets/thc-light-lab-math-v1.mjs",
  "calculateStableLight",
  "calculateVariableLight",
  "dliRangeForMap"
];
for(const token of required) if(!html.includes(token)) errors.push('Light Lab missing shared-math token: '+token);
for(const [name,pattern] of [
  ['direct PPFD×hours DLI',/\bp\*h\*0\.0036\b/],
  ['map DLI range',/stats\.min\*h\*0\.0036/],
  ['calibration DLI',/estimate\*h\*\.0036/],
  ['report DLI',/Number\(x\.ppfd\)\*Number\(x\.hours\)\*0?\.0036/]
]) if(pattern.test(html)) errors.push('Light Lab duplicated legacy '+name+' formula remains');
if(errors.length){
  console.error('Light Lab shared math integration failed:');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Light Lab shared math integration passed.');
