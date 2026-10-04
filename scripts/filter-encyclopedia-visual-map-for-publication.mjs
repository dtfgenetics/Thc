#!/usr/bin/env node
import fs from 'node:fs';

const manifestPath=process.env.ENCYCLOPEDIA_FULL_BATCH_FILE||'site/wordpress/education/encyclopedia/full-420-production-batch.generated.json';
const fullMapPath=process.env.ENCYCLOPEDIA_FULL_VISUAL_MAP||'site/wordpress/education/encyclopedia/all-visual-map-v1.json';
const outPath=process.env.ENCYCLOPEDIA_VISUAL_MAP||'site/wordpress/education/encyclopedia/publishable-visual-map.generated.json';

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const fullMap=JSON.parse(fs.readFileSync(fullMapPath,'utf8'));
const authorizedIds=new Set((manifest.lessonFiles||[]).map(file=>{
  const match=String(file).match(/thc-enc-(\d{3,})\.json$/i);
  if(!match) throw new Error(`Invalid encyclopedia lesson path in manifest: ${file}`);
  return `THC-ENC-${match[1]}`;
}));

const allAuthorized=(fullMap.items||[]).filter(item=>authorizedIds.has(item.id));
const publishable=allAuthorized.filter(item=>
  item?.assetKind==='existing-canonical-raster' &&
  typeof item?.assetPath==='string' &&
  /\.(?:png|jpe?g|webp)$/i.test(item.assetPath)
);

for(const item of publishable){
  const assetPath=`site/wordpress/assets/infographics/${item.assetPath}`;
  if(!fs.existsSync(assetPath)) throw new Error(`${item.id}: mapped canonical raster does not exist: ${assetPath}`);
}

const heldGenerated=allAuthorized.filter(item=>item?.assetKind==='generated-raster-review-pending');
const heldMissing=allAuthorized.filter(item=>!item?.assetPath||item?.assetKind==='raster-artwork-needed');
const unsupported=allAuthorized.filter(item=>
  !['existing-canonical-raster','generated-raster-review-pending','raster-artwork-needed'].includes(String(item?.assetKind||''))
);
if(unsupported.length) throw new Error(`Unsupported encyclopedia visual assetKind values: ${unsupported.map(item=>`${item.id}:${item.assetKind}`).join(', ')}`);

const output={
  schemaVersion:1,
  batch:'encyclopedia-authorized-approved-raster-visuals-v2',
  sourceBatch:fullMap.batch||null,
  generatedAt:new Date().toISOString(),
  fullLessonCount:(fullMap.items||[]).length,
  publicationAuthorizedLessonCount:allAuthorized.length,
  publishableApprovedRasterCount:publishable.length,
  heldGeneratedReviewPendingCount:heldGenerated.length,
  heldMissingArtworkCount:heldMissing.length,
  heldLessonCount:Number(manifest.heldLessonCount||0),
  reviewState:'approved-existing-canonical-raster-only',
  publicationRule:'Only existing canonical raster assets are eligible for production attachment. Generated review-pending candidates and missing artwork remain held until independently reviewed and promoted to canonical raster.',
  items:publishable
};

if(!publishable.length) throw new Error('No approved existing canonical raster encyclopedia visuals are available for publication.');
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(`Publishable encyclopedia visual map: ${publishable.length} approved canonical raster(s); ${heldGenerated.length} generated candidate(s) held; ${heldMissing.length} missing artwork item(s) held.`);
