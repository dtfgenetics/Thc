#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root=process.cwd(), src=path.join(root,'data','encyclopedia-visual-promotion-manifest.json'), out=path.join(root,'data','encyclopedia-visual-approved-assets.json');
if(!fs.existsSync(src)) throw new Error('Missing visual promotion manifest.');
const promotion=JSON.parse(fs.readFileSync(src,'utf8')), assets=[], errors=[];
for(const item of promotion.items||[]){if(item.promotionEligible!==true) continue;
 const rel=String(item.targetRepositoryPath||''), abs=path.join(root,rel);
 if(!rel.startsWith('site/wordpress/assets/infographics/')||!/\.png$/i.test(rel)){errors.push(`${item.lessonId}: invalid target PNG path`);continue;}
 if(!fs.existsSync(abs)){errors.push(`${item.lessonId}: promotion-eligible raster missing`);continue;}
 const buf=fs.readFileSync(abs); if(buf.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){errors.push(`${item.lessonId}: target is not a PNG`);continue;}
 const sha256=crypto.createHash('sha256').update(buf).digest('hex');
 assets.push({lessonId:item.lessonId,approvedAssetId:`ENC-ASSET-${item.lessonId}-${sha256.slice(0,12)}`,repositoryPath:rel,sha256,bytes:buf.length,assetQaStatus:'approved',reviewDecision:item.independentVisualReview?.decision||null,reviewerId:item.independentVisualReview?.reviewerId||null,reviewedAt:item.independentVisualReview?.reviewedAt||null,publicationAuthorized:false});
}
if(errors.length){errors.forEach(e=>console.error(' - '+e));process.exit(1);}
const output={schemaVersion:'1.0.0',artifactId:'thc-encyclopedia-visual-approved-assets',generatedBy:'scripts/build-encyclopedia-visual-approved-assets.mjs',boundary:'Exact raster asset QA ledger. Records only promotion-eligible repository PNGs and never grants lesson publication authorization.',summary:{approvedAssetCount:assets.length},assets};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n'); console.log(JSON.stringify(output.summary,null,2));
