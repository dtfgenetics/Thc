#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const errors=[];
const ok=(v,m)=>{if(!v)errors.push(m)};
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const canonicalRootArg=process.argv[2] || process.env.TOOLS_REPO_DIR || null;
const sourceRevisionPath=path.join(root,'site/public-route-patch/assets/release-source-revisions/tools.txt');

const walk=(base,rel='')=>{
  const dir=path.join(base,rel);
  if(!fs.existsSync(dir)) return [];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const child=path.join(rel,entry.name);
    if(entry.isDirectory()) out.push(...walk(base,child));
    else if(entry.isFile()) out.push(child.replaceAll('\\','/'));
  }
  return out;
};
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const registry=readJson('site/deployment/public-apps.json');
const owned=(registry.apps||[]).filter(app=>app.canonicalRepository==='dtfgenetics/Tools');
ok(owned.length>=20,`expected at least 20 Tools-owned public apps; found ${owned.length}`);

for(const app of owned){
  ok(app.repository==='dtfgenetics/Tools',`${app.id}: repository must be dtfgenetics/Tools`);
  ok(app.integrationRepository==='dtfgenetics/Thc',`${app.id}: integrationRepository must be dtfgenetics/Thc`);
  ok(app.sourcePath===app.mirrorPath,`${app.id}: sourcePath and mirrorPath must identify the synchronized integration path`);
  ok(String(app.sourcePath||'').startsWith('site/public-route-patch/'),`${app.id}: mirror must live under site/public-route-patch`);
  if(app.sourcePath) ok(fs.existsSync(path.join(root,app.sourcePath,'index.html')),`${app.id}: mirrored index.html missing at ${app.sourcePath}`);
}

for(const route of ['tools','atlas','terpene-atlas']){
  ok(fs.existsSync(path.join(root,'site/public-route-patch',route,'index.html')),`required mirrored route missing: /${route}/`);
}

for(const asset of [
  'thc-cultivation-math-v1.mjs',
  'thc-light-lab-math-v1.mjs',
  'thc-measurement-journal-v1.js',
  'thc-tool-suite-v1.css',
  'thc-tool-suite-v1.js',
  'breeder-pedigree-graph-v1.js',
  'vendor/cytoscape-3.34.3.min.js',
  'vendor/uplot-1.6.32.min.js',
  'vendor/uplot-1.6.32.min.css',
  'vendor/papaparse-5.7.0.min.js'
]) ok(fs.existsSync(path.join(root,'site/public-route-patch/assets',asset)),`shared Tools mirror asset missing: ${asset}`);

let sourceRevision={};
if(!fs.existsSync(sourceRevisionPath)){
  if(canonicalRootArg) ok(false,'canonical Tools source revision pin is missing during canonical parity validation');
  else console.warn('Canonical Tools mirror is not source-pinned yet; the next canonical sync will create release-source-revisions/tools.txt.');
}
if(fs.existsSync(sourceRevisionPath)){
  sourceRevision=Object.fromEntries(
    fs.readFileSync(sourceRevisionPath,'utf8').trim().split(/\r?\n/)
      .map(line=>line.split('=',2))
      .filter(([key,value])=>key&&value)
  );
  ok(sourceRevision.repository==='dtfgenetics/Tools','Tools source revision pin repository mismatch');
  ok(/^[0-9a-f]{40}$/.test(sourceRevision.commit||''),'Tools source revision pin must use a full lowercase 40-character SHA');
  ok(sourceRevision.lane==='canonicalToolsMirror','Tools source revision pin lane mismatch');
}

for(const legacy of [
  'apps/growlens-web/public/atlas',
  'apps/growlens-web/public/terpene-atlas',
  'apps/growlens-web/public/assets/images/atlas'
]) ok(!fs.existsSync(path.join(root,legacy)),`legacy GrowLens-owned tool source must not exist: ${legacy}`);

for(const legacyArtifact of [
  'data/atlas/living-plant-atlas-v1.json',
  'data/atlas/leaf-module-visual-assets-v1.json',
  'data/atlas/root-system-visual-assets-v1.json',
  'docs/atlas/LEAF_MODULE_PRODUCTION_QUEUE.md',
  'docs/atlas/ROOT_SYSTEM_VISUAL_PRODUCTION_QUEUE.md',
  'docs/CULTIVATION_MATH_ENGINE_FIXTURES.md',
  'docs/CULTIVATION_MATH_ENGINE_INTEGRATION_PLAN.md',
  'docs/CULTIVATION_MATH_ENGINE_TEST_LOG.md',
  'docs/CULTIVATION_MATH_ENGINE_V1.md',
  'docs/TERPENE_ATLAS_SCOPE.md',
  'docs/THC_TOOL_SUITE_BENCHMARKS.md',
  'docs/TOOL_CODE_HARVEST_2026-09-27.md',
  '.github/workflows/plant-atlas-v3-ci.yml',
  '.github/workflows/cultivation-math-engine.yml',
  '.github/workflows/cultivation-math-release.yml'
]) ok(!fs.existsSync(path.join(root,legacyArtifact)),`legacy Tool/Atlas authoring artifact must stay in dtfgenetics/Tools: ${legacyArtifact}`);

for(const duplicate of [
  'scripts/validate-plant-atlas-v3.mjs',
  'scripts/validate-plant-atlas-v4.mjs',
  'scripts/validate-terpene-atlas.mjs',
  'scripts/validate-cultivation-reference-tools.mjs',
  'scripts/validate-thc-tool-suite-v1.mjs',
  'scripts/validate-breeder-pedigree-graph.mjs',
  'scripts/validate-grow-planner-timeline.mjs',
  'scripts/validate-ipm-scout-trend.mjs',
  'scripts/validate-shared-math-tool-migrations.mjs',
  'scripts/validate-light-lab-shared-math-integration.mjs',
  'scripts/validate-growlens-tool-diary-bridges.mjs',
  'scripts/run-cultivation-math-engine-checks.mjs',
  'scripts/run-cultivation-math-release-checks.mjs',
  'scripts/test-cultivation-math-engine.mjs',
  'scripts/test-cultivation-math-edge-cases.mjs',
  'scripts/test-light-lab-math-adapter.mjs',
  'scripts/validate-cultivation-math-engine-static.mjs',
  'scripts/validate-cultivation-math-engine-integration.mjs',
  'scripts/validate-cultivation-math-docs.mjs',
  'scripts/validate-tool-workflow-persistence.mjs'
]) ok(!fs.existsSync(path.join(root,duplicate)),`canonical Tools validator still duplicated in THC: ${duplicate}`);

if(canonicalRootArg){
  const canonicalManifestPath=path.join(canonicalRootArg,'migration','manifest.json');
  ok(fs.existsSync(canonicalManifestPath),`canonical Tools manifest missing: ${canonicalManifestPath}`);
  if(fs.existsSync(canonicalManifestPath)){
    const manifest=JSON.parse(fs.readFileSync(canonicalManifestPath,'utf8'));
    const canonicalGitHead=path.join(canonicalRootArg,'.git');
    if(fs.existsSync(canonicalGitHead)){
      try{
        const {execFileSync}=await import('node:child_process');
        const head=execFileSync('git',['-C',canonicalRootArg,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
        ok(head===sourceRevision.commit,`Tools source revision pin ${sourceRevision.commit||'<missing>'} does not match checked-out canonical HEAD ${head}`);
      }catch(error){
        ok(false,`unable to resolve canonical Tools git HEAD: ${error.message}`);
      }
    }
    ok(manifest.sourceOfTruth==='dtfgenetics/Tools','canonical manifest sourceOfTruth mismatch');
    const canonicalPatch=path.join(canonicalRootArg,'site','public-route-patch');
    const mirrorPatch=path.join(root,'site','public-route-patch');
    const ownedRoots=[...(manifest.canonicalToolSlugs||[]),'assets'];

    for(const ownedRoot of ownedRoots){
      const canonicalFiles=walk(canonicalPatch,ownedRoot);
      const mirrorFiles=walk(mirrorPatch,ownedRoot);
      const canonicalSet=new Set(canonicalFiles);
      const mirrorSet=new Set(mirrorFiles);

      for(const rel of canonicalFiles){
        ok(mirrorSet.has(rel),`missing mirror file: ${rel}`);
        if(mirrorSet.has(rel)){
          ok(
            sha256(path.join(canonicalPatch,rel))===sha256(path.join(mirrorPatch,rel)),
            `content drift from canonical Tools: ${rel}`
          );
        }
      }
      if(ownedRoot!=='assets'){
        for(const rel of mirrorFiles){
          ok(canonicalSet.has(rel),`non-canonical file inside Tools-owned route mirror: ${rel}`);
        }
      }
    }
  }
}

const sync=fs.readFileSync(path.join(root,'.github/workflows/sync-canonical-tools.yml'),'utf8');
ok(sync.includes('canonicalToolSlugs'),'sync workflow must derive routes from the canonical Tools manifest');
ok(sync.includes('cp -a /tmp/tools/site/public-route-patch/assets/. site/public-route-patch/assets/'),'sync workflow must mirror the full canonical shared asset tree');
ok(sync.includes('TOOLS_REPO_DIR=/tmp/tools npm run verify:cultivation-reference-tools'),'sync workflow must validate byte-for-byte parity against the cloned canonical Tools checkout');
ok(sync.includes('release-source-revisions/tools.txt'),'sync workflow must persist the canonical Tools source revision');

if(errors.length){
  console.error('Canonical Tools integration mirror validation failed:');
  for(const e of errors)console.error(' - '+e);
  process.exit(1);
}
console.log(`Canonical Tools integration mirror valid: ${owned.length} Tools-owned public apps, no legacy GrowLens Atlas source/assets, no duplicated canonical validators or tests${canonicalRootArg ? ', and byte-for-byte parity with dtfgenetics/Tools' : ''}.`);
