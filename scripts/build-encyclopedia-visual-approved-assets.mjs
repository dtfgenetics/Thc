#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const promotionPath=path.join(root,'data','encyclopedia-visual-promotion-manifest.json');
const out=path.join(root,'data','encyclopedia-visual-approved-assets.json');

if(!fs.existsSync(promotionPath)) throw new Error('Missing visual promotion manifest.');
const promotion=JSON.parse(fs.readFileSync(promotionPath,'utf8'));
const rows=[];
const errors=[];

for(const item of promotion.items||[]){
  if(!item.promotionEligible) continue;
  const rel=String(item.targetRepositoryPath||'');
  const abs=path.join(root,rel);
  if(!rel.startsWith('site/wordpress/assets/infographics/')||!rel.toLowerCase().endsWith('.png')){
    errors.push(`${item.lessonId}: invalid target path`);
    continue;
  }
  if(!fs.existsSync(abs)){
    errors.push(`${item.lessonId}: eligible target raster missing`);
    continue;
  }
  const buf=fs.readFileSync(abs);
  if(buf.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){
    errors.push(`${item.lessonId}: target is not PNG`);
    continue;
  }
  const sha256=crypto.createHash('sha256').update(buf).digest('hex');
  rows.push({
    lessonId:item.lessonId,
    approvedAssetId:`ENC-ASSET-${item.lessonId}-${sha256.slice(0,12)}`,
    repositoryPath:rel,
    sha256,
    bytes:buf.length,
    assetQaStatus:'approved',
    reviewDecision:item.independentVisualReview?.decision||null,
    reviewerId:item.independentVisualReview?.reviewerId||null,
    reviewedAt:item.independentVisualReview?.reviewedAt||null,
    publicationAuthorized:false
  });
}
if(errors.length){
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-visual-approved-assets',
  generatedBy:'scripts/build-encyclopedia-visual-approved-assets.mjs',
  boundary:'This ledger records exact repository rasters that cleared machine preflight and validated independent visual review. It does not grant lesson publication authorization.',
  summary:{approvedAssetCount:rows.length},
  assets:rows
};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary,null,2));
