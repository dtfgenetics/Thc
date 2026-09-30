import fs from 'node:fs';

const path='data/encyclopedia-completion-scorecard.json';
if(!fs.existsSync(path)){
  console.error('Encyclopedia completion scorecard is missing. Run npm run build:encyclopedia-scorecard.');
  process.exit(1);
}
const scorecard=JSON.parse(fs.readFileSync(path,'utf8'));
const errors=[];
if(scorecard.lessonCount!==420)errors.push('scorecard must contain exactly 420 controlled base lessons');
if(!Array.isArray(scorecard.lessons)||scorecard.lessons.length!==420)errors.push('lessons array must contain 420 rows');
if(!Array.isArray(scorecard.parts)||scorecard.parts.length!==21)errors.push('parts summary must contain 21 rows');
if(new Set((scorecard.lessons||[]).map(x=>x.id)).size!==420)errors.push('lesson IDs must be unique');
for(const row of scorecard.lessons||[]){
  if(!/^THC-ENC-\d{3}$/.test(row.id||''))errors.push('invalid lesson id '+row.id);
  if(!Number.isFinite(row.score)||row.score<0||row.score>100)errors.push(row.id+': invalid readiness score');
  if(!Array.isArray(row.missing))errors.push(row.id+': missing field list absent');
}
if(errors.length){
  console.error('Encyclopedia scorecard validation failed:');
  errors.slice(0,50).forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log('Encyclopedia scorecard validation passed: 420 lessons across 21 parts.');
