#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT=process.cwd();
const queuePath=path.join(ROOT,"site/wordpress/education/visual-production-queue-v1.json");
const coveragePath=path.join(ROOT,"docs/INFOGRAPHIC_COVERAGE_TARGETS.json");
const harvestBriefPath=path.join(ROOT,"site/wordpress/education/visual-art-briefs/harvest-readiness-trichomes-v1.json");
function fail(message){console.error(`ERROR: ${message}`);process.exit(1)}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch(error){fail(`Unable to read valid JSON from ${path.relative(ROOT,file)}: ${error.message}`)}}

const queue=readJson(queuePath); const coverage=readJson(coveragePath);
if(queue.schemaVersion!==1) fail("visual production queue schemaVersion must be 1");
if(!Array.isArray(queue.batches)||queue.batches.length===0) fail("visual production queue must contain batches");
const coverageById=new Map((coverage.categories||[]).map(category=>[category.id,{route:category.route,topics:new Set(category.requiredTopics||[])}]));
const ids=new Set(); const filenames=new Set(); const queueItems=new Map(); let itemCount=0; const summary=[];
for(const batch of queue.batches){
 const canonical=coverageById.get(batch.categoryId); if(!canonical) fail(`Unknown coverage category: ${batch.categoryId}`);
 if(batch.route!==canonical.route) fail(`${batch.id} route ${batch.route} does not match canonical route ${canonical.route}`);
 if(!Array.isArray(batch.items)||batch.items.length===0) fail(`${batch.id} has no visual items`);
 const seenTopics=new Set();
 for(const item of batch.items){
  itemCount+=1; if(!item.id||ids.has(item.id)) fail(`Missing or duplicate visual id: ${item.id||"(blank)"}`); ids.add(item.id); queueItems.set(item.id,item);
  if(!canonical.topics.has(item.requiredTopic)) fail(`${item.id} requiredTopic is not in canonical coverage: ${item.requiredTopic}`);
  if(seenTopics.has(item.requiredTopic)) fail(`${batch.id} duplicates required topic: ${item.requiredTopic}`); seenTopics.add(item.requiredTopic);
  if(item.route!==canonical.route) fail(`${item.id} route does not match canonical coverage route`);
  if(item.libraryCategoryId!==batch.categoryId) fail(`${item.id} libraryCategoryId does not match its batch`);
  if(!item.title||!item.imageType||!item.educationalPurpose) fail(`${item.id} is missing core educational metadata`);
  if(!item.altText||item.altText.length<40) fail(`${item.id} altText is too short to be useful`);
  if(!item.caption||item.caption.length<30) fail(`${item.id} caption is too short to be useful`);
  if(!item.masterFilename||!item.masterFilename.endsWith(".png")) fail(`${item.id} masterFilename must be a PNG filename`);
  if(item.masterFilename.includes("/")||item.masterFilename.includes("\\")) fail(`${item.id} masterFilename must stay flat inside the canonical infographic directory`);
  if(filenames.has(item.masterFilename)) fail(`Duplicate master filename: ${item.masterFilename}`); filenames.add(item.masterFilename);
  if(!Array.isArray(item.sourceRefs)) fail(`${item.id} sourceRefs must be an array`);
  if(!queue.statusValues.includes(item.status)) fail(`${item.id} has unsupported status ${item.status}`);
  const review=item.review||{}; for(const key of ["scientificQA","visualQA","labelSpellingQA","pagePlacementQA"]) if(typeof review[key]!=="boolean") fail(`${item.id} review.${key} must be boolean`);
  if(item.status==="approved"||item.status==="published"){
   const assetPath=path.join(ROOT,queue.canonicalAssetDirectory,item.masterFilename); if(!fs.existsSync(assetPath)) fail(`${item.id} is ${item.status} but master asset is missing: ${item.masterFilename}`);
   if(!item.sourceRefs.length) fail(`${item.id} is ${item.status} but has no sourceRefs`); if(!Object.values(review).every(Boolean)) fail(`${item.id} is ${item.status} but review gates are incomplete`);
  }
 }
 const missing=[...canonical.topics].filter(topic=>!seenTopics.has(topic)); if(missing.length) fail(`${batch.id} is missing canonical topics: ${missing.join(", ")}`);
 summary.push({batch:batch.id,category:batch.categoryId,route:batch.route,items:batch.items.length});
}
if(itemCount!==21) fail(`Expected 21 planned visuals across Harvest/Post-Harvest and Outdoor, found ${itemCount}`);

const brief=readJson(harvestBriefPath);
if(brief.schemaVersion!==1) fail("Harvest art brief schemaVersion must be 1");
if(brief.queueFile!==path.relative(ROOT,queuePath)) fail("Harvest art brief queueFile does not point at canonical production queue");
if(brief.categoryId!=="harvest-postharvest"||brief.route!=="/learn/harvest-postharvest/") fail("Harvest art brief category/route mismatch");
if(!Array.isArray(brief.sources)||brief.sources.length<3) fail("Harvest art brief must include at least three evidence sources");
const sourceIds=new Set();
for(const source of brief.sources){
 if(!source.id||sourceIds.has(source.id)) fail(`Missing or duplicate source id: ${source.id||"(blank)"}`); sourceIds.add(source.id);
 if(!source.citation||!source.doi||!Array.isArray(source.supports)||!source.supports.length) fail(`${source.id} is missing citation, DOI, or supported-claim metadata`);
}
if(!Array.isArray(brief.briefs)||brief.briefs.length!==2) fail("Expected exactly two first-wave Harvest art briefs");
const expected=new Set(["THC-HARV-01","THC-HARV-02"]);
for(const art of brief.briefs){
 if(!expected.delete(art.id)) fail(`Unexpected or duplicate Harvest art brief id: ${art.id}`);
 const queued=queueItems.get(art.id); if(!queued) fail(`${art.id} is not present in canonical production queue`);
 if(art.masterFilename!==queued.masterFilename) fail(`${art.id} masterFilename does not match canonical queue`);
 if(art.queueTitle!==queued.title) fail(`${art.id} title does not match canonical queue`);
 if(art.productionStatus!=="brief-approved-artwork-needed") fail(`${art.id} must remain brief-approved-artwork-needed before artwork exists`);
 if(!art.primaryMessage||art.primaryMessage.length<80) fail(`${art.id} primaryMessage is too weak`);
 for(const key of ["layout","requiredLabels","requiredCallouts","forbiddenClaims","sourceIds"]) if(!Array.isArray(art[key])||art[key].length<2) fail(`${art.id} ${key} is incomplete`);
 for(const sourceId of art.sourceIds) if(!sourceIds.has(sourceId)) fail(`${art.id} references unknown source ${sourceId}`);
 if(!art.altText||art.altText.length<80||!art.caption||art.caption.length<80) fail(`${art.id} accessibility metadata is too short`);
 const qa=art.qa||{}; for(const key of ["scientific","visual","spelling","placement"]) if(!Array.isArray(qa[key])||!qa[key].length) fail(`${art.id} qa.${key} is incomplete`);
}
if(expected.size) fail(`Missing first-wave Harvest art brief(s): ${[...expected].join(", ")}`);

console.log(JSON.stringify({valid:true,queue:path.relative(ROOT,queuePath),totalVisuals:itemCount,batches:summary,detailedArtBriefs:brief.briefs.map(x=>x.id),evidenceSources:brief.sources.length},null,2));
