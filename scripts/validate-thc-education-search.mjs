import fs from 'node:fs';

const files={
  page:'site/public-route-patch/learn/search/index.html',
  runtime:'site/public-route-patch/learn/search/search-v1.mjs',
  index:'site/public-route-patch/learn/search/search-index.json',
  fuse:'site/public-route-patch/assets/vendor/fuse-7.1.0.min.mjs',
  publisher:'scripts/publish-wordpress-learning-center-pages.mjs',
  encyclopediaPage:'site/public-route-patch/learn/encyclopedia/index.html',
  encyclopediaRuntime:'site/public-route-patch/learn/encyclopedia/encyclopedia-v1.mjs',
  encyclopediaIndex:'site/public-route-patch/learn/encyclopedia/encyclopedia-index.json',
  learnData:'site/public-route-patch/learn/section-data-v1.json'
};
const errors=[];
for(const [name,file] of Object.entries(files)) if(!fs.existsSync(file)) errors.push(`${name} missing: ${file}`);
if(!errors.length){
 const page=fs.readFileSync(files.page,'utf8');
 const runtime=fs.readFileSync(files.runtime,'utf8');
 const index=JSON.parse(fs.readFileSync(files.index,'utf8'));
 const publisher=fs.readFileSync(files.publisher,'utf8');
 const encyclopediaPage=fs.readFileSync(files.encyclopediaPage,'utf8');
 const encyclopediaRuntime=fs.readFileSync(files.encyclopediaRuntime,'utf8');
 const encyclopediaIndex=JSON.parse(fs.readFileSync(files.encyclopediaIndex,'utf8'));
 const learnData=JSON.parse(fs.readFileSync(files.learnData,'utf8'));
 if(!page.includes('Search THC Education')||!page.includes('data-search-input')||!page.includes('search-v1.mjs')) errors.push('search page missing primary UI/runtime contract');
 if(!runtime.includes("Fuse from '/assets/vendor/fuse-7.1.0.min.mjs'")||!runtime.includes('threshold:.34')||!runtime.includes('includeScore:true')) errors.push('search runtime missing pinned fuzzy-search contract');
 if(!runtime.includes("../encyclopedia/encyclopedia-index.json")) errors.push('global education search must merge the complete encyclopedia index');
 if(!Array.isArray(index.documents)||index.documents.length<20) errors.push('search index must contain at least 20 canonical resources');
 for(const required of ['/learn/','/learn/encyclopedia/','/atlas/','/terpene-atlas/','/growlens/','/thc-grow-doc/','/vpd-chart/','/ppfd-chart/']){
   if(!index.documents.some(x=>x.route===required)) errors.push(`search index missing ${required}`);
 }
 if(!publisher.includes("slug: 'search'")) errors.push('WordPress learning publisher no longer includes search route');
 if(!encyclopediaPage.includes('data-q')||!encyclopediaPage.includes('data-topics')||!encyclopediaPage.includes('encyclopedia-v1.mjs')) errors.push('encyclopedia page missing searchable library UI');
 if(!encyclopediaRuntime.includes("Fuse from '/assets/vendor/fuse-7.1.0.min.mjs'")||!encyclopediaRuntime.includes('activePart')) errors.push('encyclopedia runtime missing fuzzy search/topic filtering');
 if(!Array.isArray(encyclopediaIndex.lessons)||encyclopediaIndex.lessons.length<420) errors.push('encyclopedia discovery index must contain at least the 420 controlled entries');
 if(!Array.isArray(encyclopediaIndex.topics)||encyclopediaIndex.topics.length<21) errors.push('encyclopedia discovery index must contain at least the 21 controlled base topics');
 if(Number(encyclopediaIndex.schemaVersion)<2) errors.push('encyclopedia discovery index must use rich search schema v2+');
 if(!encyclopediaIndex.facets?.topic||!encyclopediaIndex.facets?.format||!encyclopediaIndex.facets?.status) errors.push('encyclopedia discovery index missing topic/format/status facets');
 const sample=encyclopediaIndex.lessons?.find(x=>x.status==='published');
 for(const field of ['objective','terms','coreScience','measurements','misconceptions','tools']) if(!sample||!(field in sample)) errors.push('encyclopedia discovery document missing rich field '+field);
 if(encyclopediaIndex.lessons?.filter(x=>x.status==='published').length!==Number(encyclopediaIndex.publicationCutoff||0)) errors.push('encyclopedia published discovery count must match the generated publication cutoff');
 const requiredLearn=['cultivation-science','symptoms'];
 for(const key of requiredLearn) if(!learnData.sections?.[key]) errors.push('learning section data missing '+key);
 for(const key of requiredLearn){const file=`site/public-route-patch/learn/${key}/index.html`;if(!fs.existsSync(file)) errors.push('route-patch learning hub missing file: '+file)}
 const wordpressOwned=['start-here','beginner-guides','sops','glossary','records','plant-health'];
 for(const slug of wordpressOwned) if(!publisher.includes(`slug: '${slug}'`)) errors.push('WordPress learning publisher missing owned slug '+slug);
}
if(errors.length){console.error('THC education search validation failed:');for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log('THC education search validation passed.');
