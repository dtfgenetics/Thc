import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const sourcePath=join(process.cwd(),'scripts/build-public-learning-center.mjs');
const generatedPath=join(process.cwd(),'scripts/.build-public-learning-center-approved-only.generated.mjs');
const outputRoot=join(process.cwd(),'site/public-route-patch/learn');
const policy=JSON.parse(await readFile(join(process.cwd(),'site/wordpress/visual-quality-policy.json'),'utf8'));
if(Number(policy?.schemaVersion||0)<3) throw new Error('Visual quality policy v3+ is required');
if(policy?.replacementPolicy?.legacyInfographicReuseAllowed!==false) throw new Error('Legacy infographic reuse must stay disabled');

const source=await readFile(sourcePath,'utf8');
const imageMapPattern=/const images = \{[\s\S]*?\n\};/;
if(!imageMapPattern.test(source)) throw new Error('Expected learning-center legacy image map was not found');
const generated=source.replace(imageMapPattern,"const images = new Proxy({}, { get: () => '' });");
await writeFile(generatedPath,generated,'utf8');

try{
  await import(`${pathToFileURL(generatedPath).href}?approved=${Date.now()}`);
}finally{
  await unlink(generatedPath).catch(()=>{});
}

const forbidden=[
  ...(policy.bannedMedia?.urlContains||[]),
  ...(policy.bannedHtml?.urlContains||[]),
  'dtf-edu-'
].map(String);

async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(full));
    else if(entry.isFile()&&entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

await mkdir(outputRoot,{recursive:true});
for(const file of await walk(outputRoot)){
  let html=await readFile(file,'utf8');
  html=html.replace(/<picture\b[\s\S]*?<\/picture>/gi,(block)=>forbidden.some(x=>block.includes(x))?'':block);
  html=html.replace(/<figure\b[\s\S]*?<\/figure>/gi,(block)=>forbidden.some(x=>block.includes(x))?'':block);
  html=html.replace(/<img\b[^>]*(?:src|srcset)=["'](?:\s*|[^"']*(?:Cannabis_Plant_Anatomy_Infographic|THC-C005_Infographic|THC-C007_Infographic|Cannabis_Nutrition_Science_Behind_Healthy_Growth|Diagnosing_Deficiency_vs_Toxicity_Infographic|Beneficial_Insects_and_Biological_Controls|Cloning_Guide_with_Environment_Targets|Cannabis_Plant_Life_Cycle_Seed_to_Harvest_Infographic|THC-ENC-086_Air_VPD_Versus_Leaf_VPD|Cannabis_Sex_Expression_and_Chromosome_Combinations)[^"']*)["'][^>]*\/?\s*>/gi,'');
  html=html.replace(/<img\b[^>]*src=["']\s*["'][^>]*\/?\s*>/gi,'');
  for(const marker of forbidden){
    if(html.includes(marker)) throw new Error(`Generated learning route ${file} still contains quarantined visual marker: ${marker}`);
  }
  await writeFile(file,html,'utf8');
}

console.log('Public learning center built without legacy infographic imagery.');
