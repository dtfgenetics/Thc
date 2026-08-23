import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const consumerKey=process.env.WC_CONSUMER_KEY||'';
const consumerSecret=process.env.WC_CONSUMER_SECRET||'';
const apply=String(process.env.APPLY_GENETICS_LINEAGE_VISUALS||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/woocommerce-genetics-lineage-backups';
const genetics=JSON.parse(await readFile(process.env.GENETICS_REGISTRY||'site/wordpress/products/genetics.json','utf8'));
const plan=JSON.parse(await readFile(process.env.WC_RECONCILIATION_PLAN||'site/wordpress/products/woocommerce-reconciliation.json','utf8'));

const authHeader=consumerKey&&consumerSecret
  ? `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
  : username&&password
    ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    : '';
if(!authHeader) throw new Error('WooCommerce authentication is not configured.');
if(!Array.isArray(genetics?.products)||genetics.products.length!==3) throw new Error('Expected exactly three canonical genetics products.');
if(!Array.isArray(plan?.products)||plan.products.length!==3) throw new Error('Expected exactly three WooCommerce reconciliation products.');

const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`lineage-${stamp}`);
await mkdir(backupDir,{recursive:true});

const protectedFields=['name','slug','status','sku','regular_price','sale_price','price','stock_quantity','stock_status','manage_stock','images','tags','attributes','downloads','shipping_class','tax_status','tax_class','categories','short_description'];
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=(value='')=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stable=(value)=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const protectedSnapshot=(product)=>Object.fromEntries(protectedFields.map(key=>[key,product?.[key]??null]));

async function fetchJson(url,options={},attempts=5){
  let last;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(url,{...options,redirect:'follow',signal:AbortSignal.timeout(30000),headers:{Accept:'application/json','User-Agent':'DTFSeeds-Genetics-Lineage-Visuals/1.0',...(options.headers||{})}});
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1200)};}
      if(!response.ok) throw new Error(`HTTP ${response.status}: ${body?.message||body?.raw||'request failed'}`);
      return body;
    }catch(error){last=error;if(attempt<attempts) await sleep(attempt*1800);}
  }
  throw last;
}
async function wc(path,options={}){
  return fetchJson(`${siteUrl}${path}`,{...options,headers:{Authorization:authHeader,'Content-Type':'application/json',...(options.headers||{})}});
}
async function fetchPublic(route,marker){
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${route}?dtf_lineage_visual=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache','User-Agent':'DTFSeeds-Genetics-Lineage-Public-Verify/1.0'}});
      const html=await response.text();
      if(response.ok&&html.includes(marker)) return true;
    }catch{}
    await sleep(attempt*2500);
  }
  return false;
}
function palette(name){
  if(name==='Blue Mango') return {a:'#fff1dc',b:'#edf0ff',accent:'#d67d20',accent2:'#465ea8'};
  if(name==='Blue Bubblegum') return {a:'#fff0f7',b:'#edf0ff',accent:'#bd5f90',accent2:'#465ea8'};
  return {a:'#eef6ef',b:'#f4f6f2',accent:'#1d7040',accent2:'#526557'};
}
function buildBoard(canonical){
  const parents=String(canonical.lineage||'').split('×').map(part=>part.trim()).filter(Boolean);
  if(parents.length!==2) throw new Error(`${canonical.id}: lineage must contain exactly two parents separated by ×.`);
  const colors=palette(canonical.canonicalName);
  const type=String(canonical.seedType||'').replace(/^./,c=>c.toUpperCase());
  const release=`${canonical.canonicalName} ${canonical.generation}`;
  const marker=`${canonical.id}-lineage-v1`;
  return `<section data-dtf-lineage-board="${esc(marker)}" aria-label="${esc(canonical.canonicalName)} lineage" style="margin:0 0 26px;padding:22px;border:1px solid #d7e2d9;border-radius:24px;background:linear-gradient(145deg,#ffffff,#f4f8f4);box-shadow:0 14px 36px rgba(13,55,29,.08);overflow:hidden"><p style="margin:0 0 14px;color:#1d7040;font-size:.74rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase">DTF Genetics · documented lineage</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:stretch"><div style="padding:16px;border:1px solid #dbe4dc;border-radius:17px;background:${colors.a}"><small style="display:block;margin-bottom:6px;color:#66776b;font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase">Parent A</small><strong style="display:block;color:#102b1a;font-size:1.05rem;line-height:1.25">${esc(parents[0])}</strong></div><div style="display:grid;place-items:center;min-height:74px;padding:12px;border:1px dashed #c6d3c8;border-radius:17px;background:#f8faf7;color:#526557;font-size:1.6rem;font-weight:950" aria-label="crossed with">×</div><div style="padding:16px;border:1px solid #dbe4dc;border-radius:17px;background:${colors.b}"><small style="display:block;margin-bottom:6px;color:#66776b;font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase">Parent B</small><strong style="display:block;color:#102b1a;font-size:1.05rem;line-height:1.25">${esc(parents[1])}</strong></div><div style="padding:16px;border:1px solid #173c25;border-radius:17px;background:#102b1a;color:#fff"><small style="display:block;margin-bottom:6px;color:#d6b75c;font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase">Current release</small><strong style="display:block;font-size:1.1rem;line-height:1.25">${esc(release)}</strong><span style="display:block;margin-top:7px;color:#d8e6dc;font-size:.84rem;font-weight:750">${esc(type)} · ${esc(canonical.packQuantity)} seeds</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><span style="display:inline-flex;padding:7px 10px;border-radius:999px;background:${colors.a};color:#102b1a;font-size:.78rem;font-weight:850;border:1px solid #dbe4dc">${esc(canonical.generation)} generation</span><span style="display:inline-flex;padding:7px 10px;border-radius:999px;background:${colors.b};color:#102b1a;font-size:.78rem;font-weight:850;border:1px solid #dbe4dc">${esc(type)} seeds</span><span style="display:inline-flex;padding:7px 10px;border-radius:999px;background:#eef4ef;color:#102b1a;font-size:.78rem;font-weight:850;border:1px solid #dbe4dc">${esc(canonical.packQuantity)} seed pack</span></div><p style="margin:14px 0 0;color:#526557;font-size:.86rem;line-height:1.6">Lineage and generation identify the documented breeding project. Individual plant expression can vary.</p></section>`;
}

const byId=new Map(genetics.products.map(product=>[product.id,product]));
const prepared=[];
for(const spec of plan.products){
  const canonical=byId.get(spec.registryId);
  if(!canonical) throw new Error(`${spec.registryId}: no matching canonical genetics record.`);
  if(canonical.productPath!==`/product/${spec.slug}/`) throw new Error(`${spec.registryId}: product route mismatch between registries.`);
  const current=await wc(`/wp-json/wc/v3/products/${spec.expectedProductId}`);
  if(Number(current?.id)!==Number(spec.expectedProductId)||current.slug!==spec.slug) throw new Error(`${spec.registryId}: pinned product identity mismatch.`);
  const before={product:current,protected:protectedSnapshot(current)};
  await writeFile(join(backupDir,`${spec.registryId}-before.json`),`${JSON.stringify(current,null,2)}\n`,'utf8');
  prepared.push({spec,canonical,before});
}
await writeFile(join(backupDir,'manifest.json'),`${JSON.stringify({generatedAt:new Date().toISOString(),siteUrl,productIds:prepared.map(item=>item.spec.expectedProductId)},null,2)}\n`,'utf8');

const changed=[];
try{
  for(const item of prepared){
    const {spec,canonical,before}=item;
    const board=buildBoard(canonical);
    const description=`${board}${spec.description}`;
    await writeFile(join(backupDir,`${spec.registryId}-planned-description.html`),description,'utf8');
    if(apply){
      const updated=await wc(`/wp-json/wc/v3/products/${spec.expectedProductId}`,{method:'PUT',body:JSON.stringify({description})});
      if(Number(updated?.id)!==Number(spec.expectedProductId)) throw new Error(`${spec.registryId}: update response ID mismatch.`);
      changed.push(item);
    }
    const after=apply?await wc(`/wp-json/wc/v3/products/${spec.expectedProductId}`):before.product;
    if(apply&&!String(after.description||'').includes(`data-dtf-lineage-board="${spec.registryId}-lineage-v1"`)) throw new Error(`${spec.registryId}: lineage visual marker missing after write.`);
    if(apply&&!same(before.protected,protectedSnapshot(after))) throw new Error(`${spec.registryId}: protected commerce fields changed.`);
    if(apply){
      const publicOk=await fetchPublic(canonical.productPath,`data-dtf-lineage-board=\"${spec.registryId}-lineage-v1\"`);
      if(!publicOk) throw new Error(`${spec.registryId}: public product route did not expose the lineage visual.`);
    }
    await writeFile(join(backupDir,`${spec.registryId}-after.json`),`${JSON.stringify(after,null,2)}\n`,'utf8');
  }
}catch(error){
  const rollback=[];
  for(const item of changed.reverse()){
    try{
      await wc(`/wp-json/wc/v3/products/${item.spec.expectedProductId}`,{method:'PUT',body:JSON.stringify({description:item.before.product.description})});
      rollback.push({registryId:item.spec.registryId,restored:true});
    }catch(restoreError){rollback.push({registryId:item.spec.registryId,restored:false,error:restoreError.message});}
  }
  await writeFile(join(backupDir,'rollback.json'),`${JSON.stringify(rollback,null,2)}\n`,'utf8');
  throw error;
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,products:prepared.map(({spec,canonical})=>({registryId:spec.registryId,productId:spec.expectedProductId,name:canonical.canonicalName,lineage:canonical.lineage,generation:canonical.generation,seedType:canonical.seedType,verified:apply}))};
await writeFile('woocommerce-lineage-visual-report.json',`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(JSON.stringify(report,null,2));
