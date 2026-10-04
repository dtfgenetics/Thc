#!/usr/bin/env node
import fs from 'node:fs';

const manifestPath=process.env.ENCYCLOPEDIA_FULL_BATCH_FILE||'site/wordpress/education/encyclopedia/full-420-production-batch.generated.json';
const fullMapPath=process.env.ENCYCLOPEDIA_FULL_VISUAL_MAP||'site/wordpress/education/encyclopedia/all-visual-map-v1.json';
const outPath=process.env.ENCYCLOPEDIA_VISUAL_MAP||'site/wordpress/education/encyclopedia/publishable-visual-map.generated.json';

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const fullMap=JSON.parse(fs.readFileSync(fullMapPath,'utf8'));
const authorizedIds=new Set((manifest.lessonFiles||[]).map(file=>{
  const match=String(file).match(/thc-enc-(\d{3})\.json$/i);
  if(!match) throw new Error(`Invalid encyclopedia lesson path in manifest: ${file}`);
  return `THC-ENC-${match[1]}`;
}));
const items=(fullMap.items||[]).filter(item=>authorizedIds.has(item.id));
if(items.length!==authorizedIds.size) throw new Error(`Visual map mismatch: expected ${authorizedIds.size} authorized lessons, found ${items.length} mapped visuals.`);
const output={...fullMap,batch:'encyclopedia-authorized-visuals-v1',fullLessonCount:(fullMap.items||[]).length,publicationAuthorizedLessonCount:items.length,heldLessonCount:Number(manifest.heldLessonCount||0),reviewState:'generated_candidates_pending_independent_science_accessibility_and_asset_qa',items};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(`Publishable encyclopedia visual map: ${items.length} authorized lesson(s); ${output.heldLessonCount} held.`);
