import fs from 'node:fs';
const file='site/public-route-patch/ppfd-chart/index.html';
const html=fs.readFileSync(file,'utf8');
const errors=[];
const ok=(v,m)=>{if(!v)errors.push(m)};
ok(html.includes('type="module"'),'PPFD Light Lab must use a module script');
ok(html.includes('/assets/thc-cultivation-math-v1.mjs'),'PPFD Light Lab must import shared cultivation math');
for(const name of ['dliFromPpfd','ppfdFromDli','integrateDli'])ok(html.includes(name),'PPFD Light Lab missing shared function '+name);
ok(!html.includes('dli=p*h*0.0036'),'PPFD Light Lab still contains duplicated primary DLI formula');
ok(!html.includes('td/(h*0.0036)'),'PPFD Light Lab still contains duplicated reverse PPFD formula');
ok(!html.includes('dli+=p*h*0.0036'),'PPFD Light Lab still contains duplicated schedule integration formula');
if(errors.length){console.error('PPFD shared-engine integration failed:');for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log('PPFD shared-engine integration passed.');
