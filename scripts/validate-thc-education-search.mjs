import fs from 'node:fs';

const files={
  page:'site/public-route-patch/learn/search/index.html',
  runtime:'site/public-route-patch/learn/search/search-v1.mjs',
  index:'site/public-route-patch/learn/search/search-index.json',
  fuse:'site/public-route-patch/assets/vendor/fuse-7.1.0.min.mjs',
  publisher:'scripts/publish-wordpress-learning-center-pages.mjs'
};
const errors=[];
for(const [name,file] of Object.entries(files)) if(!fs.existsSync(file)) errors.push(`${name} missing: ${file}`);
if(!errors.length){
 const page=fs.readFileSync(files.page,'utf8');
 const runtime=fs.readFileSync(files.runtime,'utf8');
 const index=JSON.parse(fs.readFileSync(files.index,'utf8'));
 const publisher=fs.readFileSync(files.publisher,'utf8');
 if(!page.includes('Search THC Education')||!page.includes('data-search-input')||!page.includes('search-v1.mjs')) errors.push('search page missing primary UI/runtime contract');
 if(!runtime.includes("Fuse from '/assets/vendor/fuse-7.1.0.min.mjs'")||!runtime.includes('threshold:.34')||!runtime.includes('includeScore:true')) errors.push('search runtime missing pinned fuzzy-search contract');
 if(!Array.isArray(index.documents)||index.documents.length<20) errors.push('search index must contain at least 20 canonical resources');
 for(const required of ['/learn/','/learn/encyclopedia/','/atlas/','/terpene-atlas/','/growlens/','/thc-grow-doc/','/vpd-chart/','/ppfd-chart/']){
   if(!index.documents.some(x=>x.route===required)) errors.push(`search index missing ${required}`);
 }
 if(!publisher.includes("slug: 'search'")) errors.push('WordPress learning publisher no longer includes search route');
}
if(errors.length){console.error('THC education search validation failed:');for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log('THC education search validation passed.');
