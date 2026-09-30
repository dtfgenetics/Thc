#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const errors=[];
const files=new Set();
const dirs=new Set();

function walk(dir,rel=''){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules'].includes(entry.name)) continue;
    const child=path.join(rel,entry.name).replaceAll('\\','/');
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){dirs.add(child);walk(full,child)}
    else if(entry.isFile()) files.add(child);
  }
}
walk(root);

const existsFile=p=>files.has(String(p).replace(/^\.\//,'').replaceAll('\\','/'));
const existsDir=p=>dirs.has(String(p).replace(/^\.\//,'').replace(/\/$/,'').replaceAll('\\','/'));

const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for(const [name,command] of Object.entries(pkg.scripts||{})){
  for(const match of String(command).matchAll(/\bnode\s+([^\s;&|]+)/g)){
    const ref=match[1].replace(/^["']|["']$/g,'');
    if(!ref.startsWith('-')&&!existsFile(ref)) errors.push(`package script ${name} references missing Node file: ${ref}`);
  }
  for(const match of String(command).matchAll(/\b(?:bash|sh|php)\s+([^\s;&|]+)/g)){
    const ref=match[1].replace(/^["']|["']$/g,'');
    if(ref.startsWith('scripts/')&&!existsFile(ref)) errors.push(`package script ${name} references missing executable: ${ref}`);
  }
  for(const match of String(command).matchAll(/npm\s+--prefix\s+([^\s]+)|npm\s+--workspace\s+([^\s]+)\s+/g)){
    const ref=(match[1]||match[2]||'').replace(/^["']|["']$/g,'');
    if(ref&&!existsDir(ref)) errors.push(`package script ${name} references missing workspace/prefix: ${ref}`);
  }
}

for(const workflow of [...files].filter(p=>/^\.github\/workflows\/.*\.ya?ml$/.test(p))){
  const source=fs.readFileSync(path.join(root,workflow),'utf8');
  for(const match of source.matchAll(/\b(?:node|bash|sh|php)\s+([A-Za-z0-9_./-]+\.(?:mjs|js|sh|php))/g)){
    const ref=match[1];
    if(ref.startsWith('scripts/')&&!existsFile(ref)) errors.push(`${workflow} references missing executable: ${ref}`);
  }
}

for(const file of files){
  if(!file.startsWith('scripts/')) continue;
  if(!/\.(?:md|txt|csv|json)$/i.test(file)) continue;
  const allowed=
    /^scripts\/studio\/retirements\/[^/]+\.json$/.test(file) ||
    /^scripts\/archive\/[^/]+\/README\.md$/.test(file);
  if(!allowed) errors.push(`non-executable artifact is misplaced under scripts/: ${file}`);
}


// Public route trees may carry deployment provenance, but not archival release-note folders.
for (const file of files) {
  if (!file.startsWith('site/public-route-patch/')) continue;
  if (/\/release-triggers\//.test(file)) errors.push(`historical release trigger must not live in public route tree: ${file}`);
  if (/\/README\.md$/i.test(file)) errors.push(`human README must not live in deployable public route tree: ${file}`);
}

for(const required of [
  'docs/operations/ATLAS_LIVE_VERIFIER.md',
  'docs/archive/releases/sitewide-visual-repair-v2-2026-09-17.txt',
  'docs/archive/releases/dtf420-shared-shell-v1-2026-09-12.txt',
  'docs/archive/releases/dtf420-reference-progressive-disclosure-2026-09-15.txt',
  'docs/archive/releases/seed-ascent-renderer-release-2026-09-08.txt',
  'docs/operations/PLANT_ATLAS_MODEL_CONTRACT.md',
  'docs/archive/retention-manifest.json'
]){
  if(!existsFile(required)) errors.push(`expected controlled documentation missing: ${required}`);
}

if(existsFile('docs/archive/retention-manifest.json')){
  try{
    const retention=JSON.parse(fs.readFileSync(path.join(root,'docs/archive/retention-manifest.json'),'utf8'));
    if(retention.schemaVersion!==1) errors.push('retention manifest: schemaVersion must equal 1');
    if(!Array.isArray(retention.records)) errors.push('retention manifest: records must be an array');
    for(const [index,record] of (retention.records||[]).entries()){
      const location=`retention manifest records[${index}]`;
      if(!record?.id) errors.push(`${location}: id is required`);
      if(!Array.isArray(record?.retiredPaths)||record.retiredPaths.length===0) errors.push(`${location}: retiredPaths are required`);
      if(record?.historyRetention!=='git-history') errors.push(`${location}: historyRetention must equal git-history`);
      for(const retiredPath of record?.retiredPaths||[]){
        if(existsFile(retiredPath)||existsDir(retiredPath)) errors.push(`${location}: retired path returned to active tree: ${retiredPath}`);
      }
    }
  }catch(error){
    errors.push(`retention manifest invalid: ${error.message}`);
  }
}
for(const retired of [
  'scripts/verify-dtf420-atlas-live.README.md',
  'scripts/wordpress-suite-v2/sitewide-visual-repair-v2-release.txt',
  'site/public-route-patch/release-triggers/dtf420-shared-shell-v1-2026-09-12.txt',
  'site/public-route-patch/release-triggers/dtf420-reference-progressive-disclosure-2026-09-15.txt',
  'site/public-route-patch/release-triggers/seed-ascent-renderer-release-2026-09-08.txt',
  'site/public-route-patch/atlas/models/README.md',
  'scripts/publish-wordpress-academy-v2.mjs',
  '.github/workflows/wordpress-academy-v2.yml',
  'site/wordpress/education/academy-v2.json'
]){
  if(existsFile(retired)) errors.push(`retired misplaced artifact returned: ${retired}`);
}

if(errors.length){
  console.error(`Repository file-boundary validation failed with ${errors.length} issue(s):`);
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log(`Repository file boundaries valid: ${files.size} files checked; package/CI executable references resolve and scripts/ contains only executable code or explicitly allowed script-owned data.`);
