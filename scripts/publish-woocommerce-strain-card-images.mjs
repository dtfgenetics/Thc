import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { join, basename } from 'node:path';

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
if(registry?.schemaVersion!==1||!Array.isArray(registry?.cards)||registry.cards.length!==3) throw new Error('Expected exactly three reviewed WooCommerce strain cards.');

const wpAuth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const wcAuth=consumerKey&&consumerSecret?`Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`:wpAuth;
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
      const response=await fetch(url,{...options,redirect:'follow',signal:AbortSignal.timeout(60_000),headers:{'User-Agent':'DTFSeeds-Strain-Card-Publisher/3.0',...(options.headers||{})}});
      if(!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    }catch(error){last=error;if(attempt<attempts) await sleep(attempt*1500);}
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

function imageInfo(bytes){
  if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
    return {mimeType:'image/png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  }
  if(bytes.subarray(0,3).toString('hex')==='ffd8ff'){
    let offset=2;
    while(offset+9<bytes.length){
      if(bytes[offset]!==0xff){offset+=1;continue;}
      const marker=bytes[offset+1];
      if(marker===0xd8||marker===0xd9){offset+=2;continue;}
      const length=bytes.readUInt16BE(offset+2);
      if(length<2||offset+2+length>bytes.length) break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        return {mimeType:'image/jpeg',height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
      }
      offset+=2+length;
    }
    return {mimeType:'image/jpeg',width:null,height:null};
  }
  throw new Error('Downloaded file is not a PNG or JPEG image.');
}

async function downloadReviewedCard(card){
  const urls=[
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(card.driveFileId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(card.driveFileId)}&confirm=t`
  ];
  const failures=[];
  for(const url of urls){
    try{
      const response=await fetchRetry(url,{},3);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length<100_000) throw new Error(`rendition too small (${bytes.length} bytes)`);
      const info=imageInfo(bytes);
      if(info.width!==Number(card.expectedWidth)||info.height!==Number(card.expectedHeight)){
        throw new Error(`dimensions ${info.width}x${info.height} != ${card.expectedWidth}x${card.expectedHeight}`);
      }
      return {bytes,hash:sha256(bytes),sourceUrl:url,mimeType:info.mimeType,width:info.width,height:info.height};
    }catch(error){failures.push(`${url}: ${error.message}`);}
  }
  throw new Error(`${card.registryId}: reviewed Drive image could not be downloaded and validated. ${failures.join(' | ')}`);
}

async function mediaBySlug(slug){
  const rows=await wp(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  return Array.isArray(rows)?rows:[];
}
async function verifyExistingMediaBytes(item,bytes,hash){
  if(!item?.source_url) return false;
  try{
    const response=await fetchRetry(item.source_url,{headers:{'Cache-Control':'no-cache, no-store, max-age=0'}},3);
    const current=Buffer.from(await response.arrayBuffer());
    return current.length===bytes.length&&sha256(current)===hash;
  }catch{return false;}
}
async function ensureMedia(card,downloaded){
  const {bytes,hash,mimeType}=downloaded;
  const exactSlug=`${card.wordpressSlug}-${hash.slice(0,10)}`;
  const candidates=[...(await mediaBySlug(card.wordpressSlug)),...(await mediaBySlug(exactSlug))];
  for(const item of candidates){
    if(!(await verifyExistingMediaBytes(item,bytes,hash))) continue;
    const updated=apply?await wp(`/wp-json/wp/v2/media/${item.id}`,{
      method:'POST',
      body:JSON.stringify({title:card.fileName.replace(/\.[^.]+$/,''),alt_text:card.altText,caption:'DTF Genetics strain card'})
    }):item;
    return {...updated,reused:true};
  }

  if(!apply) return {id:null,source_url:null,reused:false,dryRun:true};
  const ext=mimeType==='image/png'?'.png':'.jpg';
  const stem=basename(card.fileName).replace(/\.[^.]+$/,'');
  const upload=await fetch(`${siteUrl}/wp-json/wp/v2/media`,{
    method:'POST',redirect:'follow',signal:AbortSignal.timeout(120_000),
    headers:{Authorization:wpAuth,'User-Agent':'DTFSeeds-Strain-Card-Publisher/3.0','Content-Type':mimeType,'Content-Disposition':`attachment; filename="${stem}${ext}"`},
    body:bytes
  });
  const text=await upload.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1200)};}
  if(!upload.ok||!body?.id) throw new Error(`${card.registryId}: WordPress media upload failed (${upload.status}): ${body?.message||body?.raw||'unknown error'}`);
  const updated=await wp(`/wp-json/wp/v2/media/${body.id}`,{
    method:'POST',
    body:JSON.stringify({title:stem,slug:exactSlug,alt_text:card.altText,caption:'DTF Genetics strain card'})
  });
  if(!(await verifyExistingMediaBytes(updated,bytes,hash))) throw new Error(`${card.registryId}: uploaded WordPress media failed runtime byte verification.`);
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
  const url=new URL('/wp-json/wc/store/v1/products',siteUrl);
  url.searchParams.set('slug',slug);
  url.searchParams.set('dtf_card_verify',String(Date.now()));
  const response=await fetchRetry(url.href,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}},6);
  const body=await response.json();
  if(!Array.isArray(body)||body.length!==1) throw new Error(`${slug}: expected one public Store API product, got ${Array.isArray(body)?body.length:'invalid'}.`);
  return body[0];
}
async function verifyPublicPage(card,sourceUrl){
  const sourceBase=String(sourceUrl||'').split('/').pop()?.split('?')[0]||'';
  for(let attempt=1;attempt<=7;attempt+=1){
    try{
      const response=await fetchRetry(`${siteUrl}/product/${card.productSlug}/?dtf_card_verify=${Date.now()}-${attempt}`,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}},2);
      const html=await response.text();
      if(sourceBase&&html.includes(sourceBase)) return true;
    }catch{}
    await sleep(attempt*1800);
  }
  return false;
}

const downloads=[];
for(const card of registry.cards){
  const downloaded=await downloadReviewedCard(card);
  downloads.push({card,...downloaded});
  await writeFile(join(backupDir,`${card.registryId}-source-proof.json`),`${JSON.stringify({
    registryId:card.registryId,driveFileId:card.driveFileId,renditionBytes:downloaded.bytes.length,renditionSha256:downloaded.hash,
    sourceSha256:card.sourceSha256||null,width:downloaded.width,height:downloaded.height,sourceUrl:downloaded.sourceUrl
  },null,2)}\n`);
}

const prepared=[];
for(const item of downloads){
  const {card}=item;
  const product=await wc(`/wp-json/wc/v3/products/${card.productId}`);
  if(Number(product?.id)!==Number(card.productId)||product?.slug!==card.productSlug) throw new Error(`${card.registryId}: pinned WooCommerce identity mismatch.`);
  await writeFile(join(backupDir,`${card.registryId}-product-before.json`),`${JSON.stringify(product,null,2)}\n`);
  prepared.push({...item,product,protectedBefore:protectedSnapshot(product),imagesBefore:product.images||[]});
}

const changed=[];
const results=[];
try{
  for(const item of prepared){
    const {card,product,protectedBefore}=item;
    const media=await ensureMedia(card,item);
    let after=product;
    if(apply){
      after=await wc(`/wp-json/wc/v3/products/${card.productId}`,{method:'PUT',body:JSON.stringify({images:imagePayload(media,product.images)})});
      changed.push(item);
      after=await wc(`/wp-json/wc/v3/products/${card.productId}`);
      if(!same(protectedBefore,protectedSnapshot(after))) throw new Error(`${card.registryId}: protected non-image commerce fields changed.`);
      if(Number(after?.images?.[0]?.id)!==Number(media.id)) throw new Error(`${card.registryId}: reviewed strain card is not the primary product image.`);
      const store=await publicStoreProduct(card.productSlug);
      if(Number(store?.images?.[0]?.id)!==Number(media.id)&&store?.images?.[0]?.src!==media.source_url) throw new Error(`${card.registryId}: public Store API does not expose the reviewed card as primary image.`);
      if(!(await verifyPublicPage(card,media.source_url))) throw new Error(`${card.registryId}: visitor product page did not expose the reviewed strain card.`);
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
      rollback.push({registryId:item.card.registryId,restored:true,protectedOk:same(item.protectedBefore,protectedSnapshot(restored))});
    }catch(restoreError){
      rollback.push({registryId:item.card.registryId,restored:false,error:restoreError.message});
    }
  }
  await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify(rollback,null,2)}\n`);
  throw error;
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,cardCount:results.length,results};
await writeFile('woocommerce-strain-card-image-report.json',`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
