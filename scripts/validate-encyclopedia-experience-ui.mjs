#!/usr/bin/env node
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const html=read('site/public-route-patch/learn/encyclopedia/index.html');
const runtime=read('site/public-route-patch/learn/encyclopedia/encyclopedia-v1.mjs');
const wpRuntime=read('site/wordpress/mu-plugins/dtf-learning-search/encyclopedia-v1.js');
const builder=read('scripts/build-encyclopedia-discovery-index.mjs');
const errors=[];
const requireText=(src,needle,msg)=>{if(!src.includes(needle))errors.push(msg)};

requireText(html,'data-visual-filters','Encyclopedia UI is missing teaching-visual readiness filters.');
requireText(html,'data-sort','Encyclopedia UI is missing explicit lesson sorting.');
requireText(html,'class="quick-start"','Encyclopedia UI is missing goal-based fast paths.');
requireText(html,'registered lessons','Hero stats must label the total as registered lessons.');
if(/@media\(max-width:940px\)[^{]*\{[^}]*\.nav\{display:none/.test(html))errors.push('Primary navigation must not disappear on tablet/mobile.');
requireText(html,'overflow-x:auto','Mobile/tablet navigation must remain reachable through horizontal overflow.');

for(const [name,src] of [['public runtime',runtime],['WordPress runtime',wpRuntime]]){
  requireText(src,"activeVisual='all'",name+' missing visual readiness state.');
  requireText(src,"activeSort='relevance'",name+' missing sort state.');
  requireText(src,"data-visual",name+' missing visual filter behavior.');
  requireText(src,'Reviewed visual',name+' missing learner-facing visual readiness labels.');
  requireText(src,"item.visual||{}",name+' does not render discovery visual state.');
}
requireText(builder,'schemaVersion:4','Discovery index must use visual-aware schema v4.');
requireText(builder,'visualStateFor','Discovery builder must derive controlled visual readiness.');
requireText(builder,'encyclopediaLessonRoute','Discovery builder must use permanent-ID route helper.');

if(errors.length){
  console.error('Encyclopedia experience UI validation failed:');
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('Encyclopedia experience UI PASS: visual readiness, sorting, fast paths, permanent routes, and mobile navigation are protected.');
