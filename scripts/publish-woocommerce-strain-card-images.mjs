import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const consumerKey=process.env.WC_CONSUMER_KEY||'';
const consumerSecret=process.env.WC_CONSUMER_SECRET||'';
const apply=String(process.env.APPLY_STRAIN_CARD_IMAGES||'').toLowerCase()==='true';
const registryPath=process.env.STRAIN_CARD_REGISTRY||'site/wordpress/products/strain-card-images.json';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/woocommerce-strain-card-backups';
const registry=JSON.parse(await readFile(registryPath,'utf8'));

if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
if(registry?.schemaVersion!==1||!Array.isArray(registry?.cards)||registry.cards.length!==3) throw new Error('Expected exactly three reviewed strain cards.');

const wpAuth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const wcAuth=consumerKey&&consumerSecret
  ? `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
  : wpAuth;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`strain-cards-${stamp}`);
await mkdir(backupDir,{recursive:true});

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const stable=(value)=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const protectedFields=[
  'name','slug','status','sku','regular_price','sale_price','price','stock_quantity','stock_status','manage_stock',
  'tags','attributes','downloads','shipping_class','tax_status','tax_class','categories','short_description','description'
];
const protectedSnapshot=(product)=>Object.fromEntries(protectedFields.map(key=>[key,product?.[key]??null]));

async function fetchRetry(url,options={},attempts=5){
  let last;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(url,{...options,redirect:'follow',signal:AbortSignal.timeout(45000),headers:{'User-Agent':'DTFSeeds-Strain-Card-Publisher/1.0',...(options.headers||{})}});
      if(!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    }catch(error){last=error;if(attempt<attempts) await sleep(attempt*1800);}
  }
  throw last;
}
async function jsonRequest(url,options={},auth=wpAuth){
  const response=await fetchRetry(url,{...options,headers:{Authorization:auth,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1200)};}
  return body;
}
async function wp(path,options={}){return jsonRequest(`${siteUrl}${path}`,options,wpAuth);}
async function wc(path,options={}){return jsonRequest(`${siteUrl}${path}`,options,wcAuth);}

async function downloadExactCard(card){
  const urls=[
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(card.driveFileId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(card.driveFileId)}&confirm=t`
  ];
  const failures=[];
  for(const url of urls){
    try{
      const response=await fetchRetry(url,{},3);
      const bytes=Buffer.from(await response.arrayBuffer());
      const hash=sha256(bytes);
      const magic=bytes.subarray(0,8).toString('hex');
      if(bytes.length!==Number(card.byteLength)) throw new Error(`byte length ${bytes.length} != ${card.byteLength}`);
      if(hash!==card.sha256) throw new Error(`SHA-256 ${hash} != ${card.sha256}`);
      if(magic!=='89504e470d0a1a0a') throw new Error(`not PNG magic (${magic})`);
      return {bytes,url,hash};
    }catch(error){failures.push(`${url}: ${error.message}`);}
  }
  throw new Error(`${card.registryId}: exact Drive asset could not be downloaded. ${failures.join(' | ')}`);
}

async function mediaBySlug(slug){
  const rows=await wp(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
  return Array.isArray(rows)?rows:[];
}
async function verifyExistingMediaBytes(item,card){
  if(!item?.source_url) return false;
  try{
    const response=await fetchRetry(item.source_url,{},3);
    const bytes=Buffer.from(await response.arrayBuffer());
    return bytes.length===Number(card.byteLength)&&sha256(bytes)===card.sha256;
  }catch{return false;}
}
async function ensureMedia(card,bytes){
  const existing=await mediaBySlug(card.wordpressSlug);
  if(existing.length>1) throw new Error(`${card.registryId}: multiple WordPress media items use slug ${card.wordpressSlug}.`);
  if(existing.length===1){
    if(!(await verifyExistingMediaBytes(existing[0],card))) throw new Error(`${card.registryId}: existing WordPress media slug does not match exact reviewed bytes.`);
    const updated=apply?await wp(`/wp-json/wp/v2/media/${existing[0].id}`,{method:'POST',body:JSON.stringify({title:card.fileName.replace(/\.[^.]+$/,''),slug:card.wordpressSlug,alt_text:card.altText,caption:'DTF Genetics strain card'})}):existing[0];
    return {...updated,reused:true};
  }
  if(!apply) return {id:null,source_url:null,reused:false,dryRun:true};
  const upload=await fetch(`${siteUrl}/wp-json/wp/v2/media`,{
    method:'POST',redirect:'follow',signal:AbortSignal.timeout(120000),
    headers:{Authorization:wpAuth,'User-Agent':'DTFSeeds-Strain-Card-Publisher/1.0','Content-Type':card.mimeType,'Content-Disposition':`attachment; filename="${card.fileName}"`},
    body:bytes
  });
  const text=await upload.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1200)};}
  if(!upload.ok||!body?.id) throw new Error(`${card.registryId}: WordPress media upload failed (${upload.status}): ${body?.message||body?.raw||'unknown error'}`);
  const updated=await wp(`/wp-json/wp/v2/media/${body.id}`,{method:'POST',body:JSON.stringify({title:card.fileName.replace(/\.[^.]+$/,''),slug:card.wordpressSlug,alt_text:card.altText,caption:'DTF Genetics strain card'})});
  if(!(await verifyExistingMediaBytes(updated,card))) throw new Error(`${card.registryId}: uploaded WordPress media bytes failed exact hash verification.`);
  return {...updated,reused:false};
}

function imagePayload(media,currentImages=[]){
  const secondary=[];
  for(const image of Array.isArray(currentImages)?currentImages:[]){
    if(Number(image?.id)===Number(media.id)) continue;
    if(Number(image?.id)>0) secondary.push({id:Number(image.id)});
    else if(image?.src) secondary.push({src:image.src});
  }
  return [{id:Number(media.id)},...secondary];
}
async function publicStoreProduct(slug){
  const url=new URL('/wp-json/wc/store/v1/products',siteUrl);url.searchParams.set('slug',slug);url.searchParams.set('dtf_card_verify',String(Date.now()));
  const response=await fetchRetry(url.href,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}},6);
  const body=await response.json();
  if(!Array.isArray(body)||body.length!==1) throw new Error(`${slug}: expected one public Store API product, got ${Array.isArray(body)?body.length:'invalid'}.`);
  return body[0];
}
async function verifyPublicPage(card,sourceUrl){
  const basename=String(sourceUrl||'').split('/').pop()?.split('?')[0]||'';
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetchRetry(`${siteUrl}/product/${card.productSlug}/?dtf_card_verify=${Date.now()}-${attempt}`,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}},2);
      const html=await response.text();
      if(response.ok&&basename&&html.includes(basename)) return true;
    }catch{}
    await sleep(attempt*2200);
  }
  return false;
}

// Phase 1: retrieve and cryptographically validate every exact source asset before WordPress writes.
const downloads=[];
for(const card of registry.cards){
  const downloaded=await downloadExactCard(card);
  downloads.push({card,...downloaded});
  await writeFile(join(backupDir,`${card.registryId}-source-proof.json`),`${JSON.stringify({registryId:card.registryId,driveFileId:card.driveFileId,bytes:downloaded.bytes.length,sha256:downloaded.hash,downloadUrl:downloaded.url},null,2)}\n`);
}

// Phase 2: snapshot all pinned WooCommerce records before any media or product mutation.
const prepared=[];
for(const item of downloads){
  const {card}=item;
  const product=await wc(`/wp-json/wc/v3/products/${card.productId}`);
  if(Number(product?.id)!==Number(card.productId)||product?.slug!==card.productSlug) throw new Error(`${card.registryId}: pinned WooCommerce identity mismatch.`);
  await writeFile(join(backupDir,`${card.registryId}-product-before.json`),`${JSON.stringify(product,null,2)}\n`);
  prepared.push({...item,product,protectedBefore:protectedSnapshot(product),imagesBefore:product.images||[]});
}
await writeFile(join(backupDir,'manifest.json'),`${JSON.stringify({generatedAt:new Date().toISOString(),siteUrl,apply,products:prepared.map(item=>({registryId:item.card.registryId,productId:item.card.productId,slug:item.card.productSlug,driveFileId:item.card.driveFileId,sha256:item.card.sha256}))},null,2)}\n`);

const changed=[];
const results=[];
try{
  for(const item of prepared){
    const {card,bytes,product,protectedBefore}=item;
    const media=await ensureMedia(card,bytes);
    let after=product;
    if(apply){
      const images=imagePayload(media,product.images);
      after=await wc(`/wp-json/wc/v3/products/${card.productId}`,{method:'PUT',body:JSON.stringify({images})});
      changed.push(item);
      after=await wc(`/wp-json/wc/v3/products/${card.productId}`);
      if(!same(protectedBefore,protectedSnapshot(after))) throw new Error(`${card.registryId}: protected non-image commerce fields changed.`);
      if(Number(after?.images?.[0]?.id)!==Number(media.id)) throw new Error(`${card.registryId}: exact strain card is not primary image after write.`);
      const store=await publicStoreProduct(card.productSlug);
      if(Number(store?.images?.[0]?.id)!==Number(media.id)&&store?.images?.[0]?.src!==media.source_url) throw new Error(`${card.registryId}: public Store API does not expose strain card as primary image.`);
      if(!(await verifyPublicPage(card,media.source_url))) throw new Error(`${card.registryId}: visitor product page did not expose the strain card image.`);
    }
    await writeFile(join(backupDir,`${card.registryId}-product-after.json`),`${JSON.stringify(after,null,2)}\n`);
    results.push({registryId:card.registryId,productId:card.productId,mediaId:media.id,mediaUrl:media.source_url,reusedMedia:Boolean(media.reused),primaryVerified:apply});
  }
}catch(error){
  const rollback=[];
  for(const item of changed.reverse()){
    try{
      await wc(`/wp-json/wc/v3/products/${item.card.productId}`,{method:'PUT',body:JSON.stringify({images:item.imagesBefore})});
      const restored=await wc(`/wp-json/wc/v3/products/${item.card.productId}`);
      const protectedOk=same(item.protectedBefore,protectedSnapshot(restored));
      rollback.push({registryId:item.card.registryId,restored:true,protectedOk});
    }catch(restoreError){rollback.push({registryId:item.card.registryId,restored:false,error:restoreError.message});}
  }
  await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify(rollback,null,2)}\n`);
  throw error;
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,cardCount:results.length,results};
await writeFile('woocommerce-strain-card-image-report.json',`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
