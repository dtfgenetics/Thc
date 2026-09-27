import fs from 'node:fs';
const file='docs/CULTIVATION_MATH_ENGINE_FIXTURES.md';
if(!fs.existsSync(file)){console.error('fixture documentation missing');process.exit(1)}
const text=fs.readFileSync(file,'utf8');
for(const token of ['30.24','27.72','3.168','1.27','1.00','22.5','3.785411784','not cultivar-specific prescriptions']){
 if(!text.includes(token)){console.error('fixture documentation missing token: '+token);process.exit(1)}
}
console.log('Cultivation math fixture documentation passed.');
