import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const loc=JSON.parse(fs.readFileSync(path.join(root,'data/game-location-registry.json'),'utf8'));
const dos=JSON.parse(fs.readFileSync(path.join(root,'data/game-dossier-registry.json'),'utf8'));
const errors=[];
if(dos.schemaVersion!==1) errors.push('game-dossier-registry schemaVersion must be 1');
const byId=new Map();
for(const g of dos.games||[]){if(!g.id)errors.push('dossier entry missing id');if(byId.has(g.id))errors.push('duplicate dossier '+g.id);byId.set(g.id,g);if(!Array.isArray(g.recommendedSkills)||g.recommendedSkills.length===0)errors.push(g.id+': recommendedSkills missing');}
for(const g of loc.games||[]){const d=byId.get(g.id);if(!d){errors.push('location game missing dossier: '+g.id);continue;}if(g.portfolioStage==='concept-only'){if(d.locationStatus!=='concept-only-no-canonical-code')errors.push(g.id+': concept dossier status mismatch');continue;}if(g.production){if(d.canonical?.repository!==g.production.repository)errors.push(g.id+': dossier repository drift');const a=JSON.stringify(d.canonical?.sourceRoots||[]),b=JSON.stringify(g.production.sourcePaths||[]);if(a!==b)errors.push(g.id+': dossier sourceRoots drift');}}
if(errors.length){console.error('Game dossier validation failed:\n- '+errors.join('\n- '));process.exitCode=1;}else console.log('Game dossier registry valid: '+byId.size+' game identities.');
