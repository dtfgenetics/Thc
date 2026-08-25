import { readFile } from 'node:fs/promises';

const stablePath=process.env.GENETICS_CATALOG||'data/genetics/catalog.json';
const controlPath=process.env.GENETICS_RELEASE_CONTROL||'data/genetics/release-control.json';
const libraryPath=process.env.SEED_LINE_CATALOG||'site/wordpress/products/seed-line-catalog.json';
const productsPath=process.env.GENETICS_PRODUCTS||'site/wordpress/products/genetics.json';
const seedsPath=process.env.SEEDS_PAGE||'site/wordpress/pages/seeds.html';

const [stableText,controlText,libraryText,productsText,seedsHtml]=await Promise.all([
  readFile(stablePath,'utf8'),
  readFile(controlPath,'utf8'),
  readFile(libraryPath,'utf8'),
  readFile(productsPath,'utf8'),
  readFile(seedsPath,'utf8')
]);

const stable=JSON.parse(stableText);
const controls=JSON.parse(controlText);
const library=JSON.parse(libraryText);
const products=JSON.parse(productsText);
const errors=[];
const warnings=[];

const fail=(msg)=>errors.push(msg);
const warn=(msg)=>warnings.push(msg);
const norm=(value)=>String(value??'').trim().toLowerCase();

for(const [label,obj] of [['stable catalog',stable],['release control',controls],['public library',library],['commerce registry',products]]){
  if(obj?.schemaVersion!==1) fail(`${label}: schemaVersion must be 1`);
}
if(!Array.isArray(stable?.lines)||!stable.lines.length) fail('stable catalog: lines must be non-empty');
if(!Array.isArray(controls?.lineControls)) fail('release control: lineControls must be an array');
if(!Array.isArray(library?.lines)||!library.lines.length) fail('public library: lines must be non-empty');
if(!Array.isArray(products?.products)||!products.products.length) fail('commerce registry: products must be non-empty');

const stableById=new Map();
const stableByName=new Map();
for(const line of stable.lines||[]){
  if(!line.id||!line.name||!line.lineage) fail(`stable catalog: incomplete line ${line.id||line.name||'(unknown)'}`);
  if(stableById.has(line.id)) fail(`stable catalog: duplicate id ${line.id}`);
  if(stableByName.has(line.name)) fail(`stable catalog: duplicate name ${line.name}`);
  stableById.set(line.id,line);
  stableByName.set(line.name,line);
  if(!Array.isArray(line.parents)||line.parents.length!==2) fail(`${line.id}: stable pedigree must have exactly two parent records`);
  if(!line.claimsPolicy||Object.values(line.claimsPolicy).some(value=>value!==false)) fail(`${line.id}: stable claims policy must remain non-guaranteed`);
}

const controlsById=new Map();
for(const row of controls.lineControls||[]){
  if(!row.lineId) fail('release control: missing lineId');
  if(controlsById.has(row.lineId)) fail(`release control: duplicate lineId ${row.lineId}`);
  controlsById.set(row.lineId,row);
  if(!stableById.has(row.lineId)) fail(`release control: orphan lineId ${row.lineId}`);
  if(row.publicListingAllowed!==false && row.publicAvailability==='not-asserted') fail(`${row.lineId}: listing cannot be allowed while availability is not asserted`);
}
for(const line of stable.lines||[]){
  if(!controlsById.has(line.id)) fail(`${line.id}: missing fail-closed release-control record`);
}

const libraryById=new Map();
const libraryByName=new Map();
const cardSlugs=new Set();
const storePaths=new Set();
for(const line of library.lines||[]){
  if(!line.id||!line.name||!line.slug||!line.summary) fail(`public library: incomplete line ${line.id||line.name||'(unknown)'}`);
  if(libraryById.has(line.id)) fail(`public library: duplicate id ${line.id}`);
  if(libraryByName.has(line.name)) fail(`public library: duplicate name ${line.name}`);
  libraryById.set(line.id,line);
  libraryByName.set(line.name,line);

  if(line.lineage==null){
    if(line.lineageStatus!=='awaiting-controlled-record') fail(`${line.id}: null lineage must stay awaiting-controlled-record`);
  } else {
    const stableLine=stableById.get(line.id);
    if(stableLine && stableLine.lineage!==line.lineage) fail(`${line.id}: public lineage '${line.lineage}' drifts from stable catalog '${stableLine.lineage}'`);
    if(line.lineageStatus==='controlled-catalog' && !stableLine) fail(`${line.id}: controlled-catalog lineage has no stable catalog record`);
  }

  if(!Array.isArray(line.releaseCards)||!line.releaseCards.length) fail(`${line.id}: public library needs at least one reviewed card`);
  for(const card of line.releaseCards||[]){
    if(!card.generation||!card.seedType||!card.wordpressSlug||!card.driveFileId||!card.sourceUrl) fail(`${line.id}: incomplete release-card identity`);
    if(cardSlugs.has(card.wordpressSlug)) fail(`public library: duplicate card slug ${card.wordpressSlug}`);
    cardSlugs.add(card.wordpressSlug);
    if(!/^[a-f0-9]{64}$/.test(String(card.sourceSha256||''))) fail(`${line.id}: invalid source SHA-256 for ${card.wordpressSlug}`);
    if(!Number.isInteger(card.expectedWidth)||!Number.isInteger(card.expectedHeight)) fail(`${line.id}: missing image dimensions for ${card.wordpressSlug}`);
  }
  for(const route of line.storeRoutes||[]){
    if(!route.path?.startsWith('/product/')) fail(`${line.id}: invalid store route ${route.path}`);
    if(storePaths.has(route.path)) fail(`public library: duplicate store route ${route.path}`);
    storePaths.add(route.path);
  }
  if(!seedsHtml.includes(`/seeds/${line.slug}/`)) fail(`${line.id}: canonical Seeds fallback does not link /seeds/${line.slug}/`);
  if(!seedsHtml.includes(line.name)) fail(`${line.id}: canonical Seeds fallback does not name the line`);
}

for(const line of stable.lines||[]){
  if(line.status==='parent-line') continue;
  const publicLine=libraryById.get(line.id);
  if(!publicLine) fail(`${line.id}: stable breeding line is missing from public image-backed genetics library`);
  else if(publicLine.lineage!==line.lineage) fail(`${line.id}: stable/public lineage mismatch`);
}

for(const product of products.products||[]){
  const line=libraryByName.get(product.canonicalName);
  if(!line){
    fail(`${product.id}: commerce product has no public genetics line ${product.canonicalName}`);
    continue;
  }
  if(line.lineage!==product.lineage) fail(`${product.id}: commerce lineage drifts from public genetics library`);
  const stableLine=stableByName.get(product.canonicalName);
  if(stableLine && stableLine.lineage!==product.lineage) fail(`${product.id}: commerce lineage drifts from stable catalog`);
  const card=(line.releaseCards||[]).find(row=>norm(row.generation)===norm(product.generation)&&norm(row.seedType)===norm(product.seedType));
  if(!card) fail(`${product.id}: no reviewed ${product.generation} ${product.seedType} strain card exists on ${line.id}`);
  const route=(line.storeRoutes||[]).find(row=>row.path===product.productPath);
  if(!route) fail(`${product.id}: public library does not expose verified store route ${product.productPath}`);
  if(!seedsHtml.includes(product.productPath)) fail(`${product.id}: canonical Seeds fallback is missing ${product.productPath}`);
}

for(const route of storePaths){
  if(!(products.products||[]).some(product=>product.productPath===route)) fail(`public library store route ${route} has no verified commerce record`);
}

for(const line of stable.lines||[]){
  const row=controlsById.get(line.id);
  if(!row) continue;
  if(row.generation && row.seedType && row.seedType!=='unknown'){
    const forms=line.knownGenerationForms||[];
    if(!forms.some(form=>norm(form.generation)===norm(row.generation)&&norm(form.seedType)===norm(row.seedType))){
      fail(`${line.id}: release-control ${row.generation} ${row.seedType} is absent from stable knownGenerationForms`);
    }
  }
}

if(errors.length){
  console.error('Genetics library coherence validation failed:');
  for(const error of errors) console.error(`- ${error}`);
}
if(warnings.length){
  console.warn('Genetics library coherence warnings:');
  for(const warning of warnings) console.warn(`- ${warning}`);
}

console.log(JSON.stringify({
  stableLines:stable.lines?.length||0,
  controlledReleaseRows:controls.lineControls?.length||0,
  publicLibraryLines:library.lines?.length||0,
  reviewedCards:cardSlugs.size,
  verifiedCommerceProducts:products.products?.length||0,
  verifiedStoreRoutes:storePaths.size,
  errors:errors.length,
  warnings:warnings.length
},null,2));

if(errors.length) process.exitCode=1;
