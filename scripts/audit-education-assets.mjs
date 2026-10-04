#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { loadEncyclopediaRegistry } from './lib/encyclopedia-registry.mjs';

const root=process.cwd();
const assetRoots=[
  path.join(root,'site','wordpress','assets','infographics'),
  path.join(root,'site','public-route-patch','assets','education','infographics')
];
const libraryMetaPath=path.join(root,'site','public-route-patch','learn','infographics','library.json');
const reportPath=path.join(root,'content','encyclopedia','visual-coverage-report-v1.json');
const libraryMeta=JSON.parse(fs.readFileSync(libraryMetaPath,'utf8'));
const bannedStems=[...new Set((libraryMeta.removedAssets||[]).map(x=>String(x).replace(/\.(?:png|jpe?g|webp|avif)$/i,'')))];
const lessons=readCanonicalEncyclopediaLessons(root);
const registry=loadEncyclopediaRegistry(root);
const errors=[];
const warnings=[];

const allFiles=(dir)=>{
  if(!fs.existsSync(dir)) return [];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...allFiles(p));
    else out.push(p);
  }
  return out;
};
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const imageExt=/\.(?:png|jpe?g|webp|avif)$/i;

const canonicalById=new Map();
for(const assetRoot of assetRoots){
  if(!fs.existsSync(assetRoot)) continue;
  for(const file of fs.readdirSync(assetRoot)){
    if(!imageExt.test(file)) continue;
    const m=file.match(/^(THC-ENC-\d{3})(?:_|\b)/i);
    if(!m) continue;
    const id=m[1].toUpperCase();
    const rows=canonicalById.get(id)||[];
    rows.push(rel(path.join(assetRoot,file)));
    canonicalById.set(id,[...new Set(rows)].sort());
  }
}

const mapDir=path.join(root,'site','wordpress','education');
const mapFiles=allFiles(mapDir).filter(p=>/visual-map\.json$/i.test(p));
let mappedVisualRecords=0;
for(const file of mapFiles){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const visuals=[];
  if(Array.isArray(data.items)) visuals.push(...data.items);
  if(Array.isArray(data.visuals)) visuals.push(...data.visuals);
  if(data.chapters&&typeof data.chapters==='object'){
    for(const rows of Object.values(data.chapters)) if(Array.isArray(rows)) visuals.push(...rows);
  }
  for(const visual of visuals){
    const asset=String(visual?.assetPath||visual?.file||'');
    if(!asset) continue;
    mappedVisualRecords++;
    if(!imageExt.test(asset)) errors.push(`${rel(file)}: non-raster production visual ${asset}`);
    if(!String(visual?.altText||visual?.alt||'').trim()) warnings.push(`${rel(file)}: missing alt text for ${asset}`);
    for(const stem of bannedStems) if(asset.includes(stem)) errors.push(`${rel(file)}: rejected visual is active: ${asset}`);
    const exists=assetRoots.some(rootDir=>fs.existsSync(path.join(rootDir,path.basename(asset))));
    if(!exists) errors.push(`${rel(file)}: mapped asset missing from canonical roots: ${asset}`);
  }
}

const liveSurfaceRoots=[
  path.join(root,'site','public-route-patch'),
  path.join(root,'site','wordpress','pages')
];
const liveFiles=liveSurfaceRoots
  .flatMap(allFiles)
  .filter(p=>/\.(?:html?|css|js|mjs|json)$/i.test(p))
  .filter(p=>{
    const rp=rel(p);
    if(/\/assets\/education\/infographics\/import-[^/]+\.json$/i.test(rp)) return false;
    return true;
  });
const referencePatternFor=stem=>new RegExp(`(?:src|href|srcset|url|background(?:-image)?|image|asset|thumbnail)[^\\n\\r]{0,240}${stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\.(?:png|jpe?g|webp|avif)`,'i');
for(const file of liveFiles){
  const rp=rel(file);
  if(rp==='site/public-route-patch/learn/infographics/library.json') continue;
  const body=fs.readFileSync(file,'utf8');
  for(const stem of bannedStems){
    if(referencePatternFor(stem).test(body)) errors.push(`${rp}: live-facing rejected visual reference: ${stem}`);
  }
}

const lessonRows=lessons.map(lesson=>{
  const paths=canonicalById.get(lesson.id)||[];
  return {
    lessonId:lesson.id,
    number:Number(lesson.number),
    title:lesson.title,
    visualStatus:paths.length?'produced-raster-present':'artwork-needed',
    candidateCount:paths.length,
    canonicalAssetPaths:paths
  };
});
const withRaster=lessonRows.filter(x=>x.candidateCount>0);
const missing=lessonRows.filter(x=>x.candidateCount===0);
const report={
  schemaVersion:1,
  artifactId:'thc-education-asset-coverage-v1',
  generatedAt:new Date().toISOString(),
  lessonCount:lessons.length,
  registryLessonCount:registry.totalCount,
  rasterCoveredLessonCount:withRaster.length,
  rasterCoveragePercent:Number((withRaster.length/Math.max(1,lessons.length)*100).toFixed(1)),
  artworkNeededCount:missing.length,
  mappedVisualRecords,
  bannedAssetStemCount:bannedStems.length,
  liveFacingFilesScanned:liveFiles.length,
  visualMapFilesScanned:mapFiles.length,
  warnings,
  errors,
  missingLessons:missing.map(({lessonId,number,title})=>({lessonId,number,title})),
  coveredLessons:withRaster
};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');

if(lessons.length!==registry.totalCount) errors.push(`Canonical lesson count ${lessons.length} does not match registry ${registry.totalCount}`);
if(errors.length){
  console.error(`Education asset audit failed with ${errors.length} error(s):`);
  for(const error of errors.slice(0,100)) console.error(' - '+error);
  console.error(`Coverage: ${withRaster.length}/${lessons.length} lessons have canonical raster assets.`);
  process.exit(1);
}
console.log(`Education asset audit PASS: ${withRaster.length}/${lessons.length} lessons have canonical raster assets (${report.rasterCoveragePercent}%). ${missing.length} remain in artwork production; ${mapFiles.length} visual maps and ${liveFiles.length} live-facing files scanned; no rejected production references found.`);
