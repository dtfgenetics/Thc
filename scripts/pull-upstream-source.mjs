#!/usr/bin/env node
// Download one reviewed upstream Git revision to an isolated local research directory.
// Never modifies production assets or code.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(fs.readFileSync(new URL('../configuration/upstream-source-intake.json',import.meta.url)));
const [id,rev]=process.argv.slice(2);
if(!id||!rev||!(/^[a-f0-9]{40}$/i).test(rev)){
  console.error('Usage: node scripts/pull-upstream-source.mjs <source-id> <40-character-commit-sha>');
  process.exit(2);
}
const source=config.sources.find(s=>s.id===id);
if(!source){console.error('Unknown source identifier');process.exit(2);}
const dest=path.resolve('.artifacts/upstream-source',id,rev.toLowerCase());
const root=path.resolve('.artifacts/upstream-source');
if(!dest.startsWith(root+path.sep)){throw Error('Unsafe destination');}
fs.mkdirSync(path.dirname(dest),{recursive:true});
if(fs.existsSync(dest)){console.error('Destination already exists; refusing to overwrite: '+dest);process.exit(2);}
const url='https://github.com/'+source.repository+'.git';
const run=(args,cwd)=>{const result=spawnSync('git',args,{cwd,stdio:'inherit',timeout:180000});
  if(result.status!==0)throw Error('git '+args[0]+' failed');
};
try{
  fs.mkdirSync(dest);
  run(['init','--quiet'],dest);
  run(['remote','add','origin',url],dest);
  run(['fetch','--depth=1','origin',rev],dest);
  run(['checkout','--detach','FETCH_HEAD'],dest);
  const result=spawnSync('git',['rev-parse','HEAD'],{cwd:dest,encoding:'utf8'});
  if(result.status!==0||result.stdout.trim().toLowerCase()!==rev.toLowerCase())throw Error('Pinned revision mismatch');
  const licenseCandidates=['LICENSE','LICENSE.md','LICENSE.txt','COPYING'];
  const present=licenseCandidates.filter(name=>fs.existsSync(path.join(dest,name)));
  if(present.length===0)throw Error('Upstream license file missing; quarantine checkout');
  fs.writeFileSync(path.join(dest,'DTF-INJECTION-PROVENANCE.json'),JSON.stringify({
    source:source.repository,revision:rev.toLowerCase(),declaredLicense:source.license,
    reuseMode:source.mode,licenseFiles:present,
    productionApproved:false,reviewRequired:true
  },null,2)+'\n');
  console.log('Research checkout ready (NOT approved for production): '+dest);
}catch(err){console.error(err.message);process.exit(1);}
