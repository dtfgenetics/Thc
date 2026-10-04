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
  learnData:'site/public-route-patch/learn/section-data-v1.json',
  searchLanguage:'configuration/encyclopedia-search-language.json',
  wordpressRuntime:'site/wordpress/mu-plugins/dtf-learning-search.php',
  wordpressRuntimeBuilder:'scripts/build-wordpress-learning-search-runtime.mjs',
  courseCatalog:'site/wordpress/education/course-catalog-v4.json',
  tech1Public:'site/wordpress/education/tech1-courses-public-v1.json',
  tech2Public:'site/wordpress/education/tech2-courses-public-v1.json',
  academyTarget:'site/wordpress/education/academy-deployment-target.json',
  staticRecords:'configuration/education-search-static-records.json',
  builder:'scripts/build-thc-education-search-index.mjs'
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
 const searchLanguage=JSON.parse(fs.readFileSync(files.searchLanguage,'utf8'));
 const courseCatalog=JSON.parse(fs.readFileSync(files.courseCatalog,'utf8'));
 const tech1Public=JSON.parse(fs.readFileSync(files.tech1Public,'utf8'));
 const tech2Public=JSON.parse(fs.readFileSync(files.tech2Public,'utf8'));
 const academyTarget=JSON.parse(fs.readFileSync(files.academyTarget,'utf8'));
 const staticRecords=JSON.parse(fs.readFileSync(files.staticRecords,'utf8'));
 if(!page.includes('Search THC Education')||!page.includes('data-search-input')||!page.includes('search-v1.mjs')) errors.push('search page missing primary UI/runtime contract');
 if(!page.includes('DTF_STATIC_SEARCH_FALLBACK_START')||!page.includes('data-static-search-fallback')||(page.match(/class="search-card"/g)||[]).length<20) errors.push('search page missing materialized static fallback directory');
 if(!runtime.includes("Fuse from '/assets/vendor/fuse-7.1.0.min.mjs'")||!runtime.includes('threshold:.34')||!runtime.includes('includeScore:true')) errors.push('search runtime missing pinned fuzzy-search contract');
 if(!runtime.includes("../encyclopedia/encyclopedia-index.json")) errors.push('global education search must merge the complete encyclopedia index');
 if(!runtime.includes("name:'aliases'")||!runtime.includes('history.replaceState')) errors.push('global search missing alias/deep-link contract');
 if(!runtime.includes("data-static-search-fallback")||!runtime.includes('staticFallback.hidden=true')||!runtime.includes('static resource directory remains available')) errors.push('global search runtime no longer preserves static fallback until successful initialization');
 if(!Array.isArray(index.documents)||index.documents.length<20) errors.push('search index must contain at least 20 canonical resources');
 if(!Array.isArray(staticRecords.documents)||staticRecords.documents.length<1)errors.push('curated static search records must be explicit and non-empty');
 const routeCounts=new Map();
 for(const row of index.documents||[]){
   routeCounts.set(row.route,(routeCounts.get(row.route)||0)+1);
 }
 for(const [route,count] of routeCounts)if(count>1)errors.push('search index contains duplicate route '+route+' ('+count+' records)');
 const builderSource=fs.readFileSync(files.builder,'utf8');
 if(builderSource.includes("readJson('site/public-route-patch/learn/search/search-index.json')"))errors.push('search generator must not ingest its own previous output');
 if(!builderSource.includes("configuration/education-search-static-records.json"))errors.push('search generator must consume explicit curated static records');
 if(!builderSource.includes('DTF_STATIC_SEARCH_FALLBACK_START')||!builderSource.includes('DTF_STATIC_ENCYCLOPEDIA_FALLBACK_START')||!builderSource.includes('replaceGeneratedBlock'))errors.push('search generator must materialize static search and encyclopedia fallbacks from canonical indexes');
 const publicCourseRefs=[...(tech1Public.courses||[]),...(tech2Public.courses||[])];
 for(const ref of publicCourseRefs){
   const row=index.documents?.find(x=>x.id===ref.id);
   if(!row)errors.push('search index missing public Academy course '+ref.id);
   else{
     if(row.type!=='Courses')errors.push(ref.id+': public Academy search row must use Courses type');
     if(row.status!=='public-academic')errors.push(ref.id+': public Academy search row must identify public-academic status');
     if(row.sourceRepository!=='dtfgenetics/Thc-learning-courses-')errors.push(ref.id+': public Academy search row lost canonical source repository');
     if(row.sourceRef!==academyTarget.sourceSha)errors.push(ref.id+': public Academy search row source ref does not match deployment target');
     if(!String(row.route||'').startsWith('/learn/learning-hub/'))errors.push(ref.id+': public Academy search row has unexpected route '+(row.route||'<missing>'));
   }
 }
 const course1=courseCatalog.courses?.find(x=>x.id==='COURSE-LH-TECH1-001');
 if(course1?.publicLessonReleaseAvailable===true&&!index.documents?.some(x=>x.id===course1.id&&x.route===course1.href))errors.push('search index missing public Technician I Course 1');
 const globalEncyclopediaSample=index.documents?.find(x=>x.type==='Encyclopedia');
 for(const field of ['aliases','terms','objective','measurements','misconceptions','coreScience','cultivation','tools','evidence']) if(!globalEncyclopediaSample||!(field in globalEncyclopediaSample)) errors.push('global education search encyclopedia document missing rich field '+field);
 for(const required of ['/learn/','/learn/encyclopedia/','/atlas/','/terpene-atlas/','/growlens/','/thc-grow-doc/','/vpd-chart/','/ppfd-chart/']){
   if(!index.documents.some(x=>x.route===required)) errors.push(`search index missing ${required}`);
 }
 if(!publisher.includes("slug: 'search'")) errors.push('WordPress learning publisher no longer includes search route');
 if(!publisher.includes('/wp-json/dtf-learning/v1/index/search')||!publisher.includes('/wp-json/dtf-learning/v1/index/encyclopedia')||!publisher.includes('/wp-json/dtf-learning/v1/health')) errors.push('WordPress learning publisher missing MU-plugin search index publication contract');
 const wordpressRuntime=fs.readFileSync(files.wordpressRuntime,'utf8');
 const wordpressRuntimeBuilder=fs.readFileSync(files.wordpressRuntimeBuilder,'utf8');
 for(const marker of ['register_rest_route','wp_footer','data-dtf-learning-search-runtime="mu-v1"','current_user_can(\'manage_options\')']) if(!wordpressRuntime.includes(marker)) errors.push('WordPress learning search runtime missing '+marker);
 if(!wordpressRuntimeBuilder.includes('build-wordpress-learning-search-runtime')&&!wordpressRuntimeBuilder.includes('dtf-learning-search')) errors.push('WordPress learning search runtime builder contract missing');
 const searchPage=fs.readFileSync(files.page,'utf8');
 const fallbackBuilder=fs.readFileSync('scripts/build-static-search-fallbacks.mjs','utf8');
 if(!searchPage.includes('DTF_STATIC_SEARCH_FALLBACK_START')||!searchPage.includes('data-static-fallback')) errors.push('education search page missing static crawlable fallback');
 if(!encyclopediaPage.includes('DTF_STATIC_ENCYCLOPEDIA_FALLBACK_START')||!encyclopediaPage.includes('data-static-fallback')) errors.push('encyclopedia page missing static crawlable fallback');
 const publishedRows=(encyclopediaIndex.lessons||[]).filter(x=>x.status==='published');
 const missingStaticRoutes=publishedRows.filter(row=>!encyclopediaPage.includes('href="'+row.route+'"'));
 if(missingStaticRoutes.length) errors.push('static encyclopedia directory missing '+missingStaticRoutes.length+' published lesson routes; first '+missingStaticRoutes.slice(0,3).map(x=>x.id).join(', '));
 if(!fallbackBuilder.includes('Static education fallbacks built')) errors.push('static education fallback builder contract missing');
 if(!fs.readFileSync(files.builder,'utf8').includes('build-static-search-fallbacks.mjs')) errors.push('education search index build no longer materializes static fallbacks');
 if(!encyclopediaPage.includes('data-q')||!encyclopediaPage.includes('data-topics')||!encyclopediaPage.includes('encyclopedia-v1.mjs')) errors.push('encyclopedia page missing searchable library UI');
 if(!encyclopediaPage.includes('DTF_STATIC_ENCYCLOPEDIA_FALLBACK_START')||!encyclopediaPage.includes('data-static-encyclopedia-fallback')||(encyclopediaPage.match(/class="lesson"/g)||[]).length<420) errors.push('encyclopedia page missing complete materialized static fallback directory');
 if(!encyclopediaPage.includes('Search naturally.')||!encyclopediaPage.includes('data-reset-all')||!encyclopediaPage.includes('data-stat-subjects')||!encyclopediaPage.includes('data-subject-count')) errors.push('encyclopedia hub missing plain-language search guidance or dynamic 420+ summary controls');
 if(/All 420 topics|<b>21<\/b><span>subject areas/.test(encyclopediaPage)) errors.push('encyclopedia hub must not hard-code the expandable lesson or subject totals');
 if(!encyclopediaRuntime.includes("Fuse from '/assets/vendor/fuse-7.1.0.min.mjs'")||!encyclopediaRuntime.includes('activePart')) errors.push('encyclopedia runtime missing fuzzy search/topic filtering');
 if(!encyclopediaRuntime.includes("name:'aliases'")||!encyclopediaRuntime.includes('history.replaceState')) errors.push('encyclopedia runtime missing alias/deep-link contract');
 if(!encyclopediaRuntime.includes("data-static-encyclopedia-fallback")||!encyclopediaRuntime.includes('staticFallback.hidden=true')||!encyclopediaRuntime.includes('static encyclopedia directory remains available')) errors.push('encyclopedia runtime no longer preserves static fallback until successful initialization');
 if(!encyclopediaRuntime.includes('Math.max(1000,payload.lessons.length)')||!encyclopediaRuntime.includes('aria-pressed')||!encyclopediaRuntime.includes('resetFilters')) errors.push('encyclopedia runtime missing expandable search limit, accessible topic state, or unified filter reset');
 if(!encyclopediaRuntime.includes('PAGE_SIZE=60')||!encyclopediaRuntime.includes('data-load-more')) errors.push('encyclopedia runtime missing progressive result rendering for large 420+ catalogs');
 if(encyclopediaRuntime.includes("q.addEventListener('input',()=>{activePart=null")) errors.push('encyclopedia search must preserve an explicitly selected subject while typing');
 if(!Array.isArray(encyclopediaIndex.lessons)||encyclopediaIndex.lessons.length<420) errors.push('encyclopedia discovery index must contain at least the 420 controlled entries');
 if(!Array.isArray(encyclopediaIndex.topics)||encyclopediaIndex.topics.length<21) errors.push('encyclopedia discovery index must contain at least the 21 controlled base topics');
 if(Number(encyclopediaIndex.schemaVersion)<3) errors.push('encyclopedia discovery index must use evidence-aware search schema v3+');
 if(!encyclopediaIndex.facets?.topic||!encyclopediaIndex.facets?.format||!encyclopediaIndex.facets?.status) errors.push('encyclopedia discovery index missing topic/format/status facets');
 const sample=encyclopediaIndex.lessons?.find(x=>x.status==='published');
 for(const field of ['objective','terms','coreScience','measurements','misconceptions','tools','aliases','evidence']) if(!sample||!(field in sample)) errors.push('encyclopedia discovery document missing rich field '+field);
 if(Number(encyclopediaIndex.searchLanguageVersion)<1) errors.push('encyclopedia discovery index missing search-language version');
 if(!Array.isArray(searchLanguage.rules)||searchLanguage.rules.length<20) errors.push('controlled encyclopedia search language must contain at least 20 useful alias rules');
 for(const rule of searchLanguage.rules||[]){if(!rule.id||!Array.isArray(rule.aliases)||rule.aliases.length<1)errors.push('invalid encyclopedia search-language rule '+(rule.id||'<missing-id>'));}
 const aliasCorpus=(encyclopediaIndex.lessons||[]).flatMap(x=>x.aliases||[]).map(x=>String(x).toLowerCase());
 for(const phrase of ['yellow leaves','hermie','bud rot','high runoff ec']) if(!aliasCorpus.includes(phrase)) errors.push('generated encyclopedia aliases missing '+phrase);
 if(encyclopediaIndex.lessons?.filter(x=>x.status==='published').length!==Number(encyclopediaIndex.publicationCutoff||0)) errors.push('encyclopedia published discovery count must match the generated publication cutoff');
 const privateFields=['objective','terms','coreScience','cultivation','measurements','misconceptions','evidenceLimits','crossLinks','synonyms'];
 for(const row of encyclopediaIndex.lessons?.filter(x=>x.status==='catalogued-review')||[]){
   for(const field of privateFields){
     const value=row[field];
     const empty=Array.isArray(value)?value.length===0:String(value??'').trim()==='';
     if(!empty)errors.push(row.id+': review-only public discovery row leaked '+field);
   }
 }
 const requiredLearn=['cultivation-science','symptoms'];
 for(const key of requiredLearn) if(!learnData.sections?.[key]) errors.push('learning section data missing '+key);
 for(const key of requiredLearn){const file=`site/public-route-patch/learn/${key}/index.html`;if(!fs.existsSync(file)) errors.push('route-patch learning hub missing file: '+file)}
 const wordpressOwned=['start-here','beginner-guides','records','search','encyclopedia'];
 for(const slug of wordpressOwned) if(!publisher.includes(`slug: '${slug}'`)) errors.push('WordPress learning publisher missing owned slug '+slug);
 const overlayOwned=['academy','sops','glossary','plant-health'];
 for(const slug of overlayOwned) if(publisher.includes(`slug: '${slug}'`)) errors.push('generic WordPress learning publisher must not rewrite overlay-owned slug '+slug);
}
if(errors.length){console.error('THC education search validation failed:');for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log('THC education search validation passed.');
