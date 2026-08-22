import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const plan = JSON.parse(await readFile(process.env.WC_RECONCILIATION_PLAN || 'site/wordpress/products/woocommerce-reconciliation.json', 'utf8'));
const siteUrl = (process.env.WP_SITE_URL || plan.siteUrl || 'https://dtfseeds.com').replace(/\/$/, '');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/woocommerce-product-backups';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `woocommerce-product-backup-${stamp}`);
const wpUsername = process.env.WP_API_USERNAME || '';
const wpPassword = process.env.WP_API_PASSWORD || '';
const consumerKey = process.env.WC_CONSUMER_KEY || '';
const consumerSecret = process.env.WC_CONSUMER_SECRET || '';
const authHeader = consumerKey && consumerSecret
  ? `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
  : wpUsername && wpPassword
    ? `Basic ${Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')}`
    : '';
if (!authHeader) throw new Error('WooCommerce authentication is not configured.');
if (plan?.schemaVersion !== 1 || !Array.isArray(plan.products) || plan.products.length !== 3) throw new Error('Expected the reviewed three-product reconciliation plan.');

const removeSlugs = new Set((plan.policy?.removeCategorySlugs || []).map((v) => String(v).toLowerCase()));
const desiredCategory = plan.policy?.category || 'Seeds';
const protectedFields = [
  'slug','status','sku','regular_price','sale_price','price','stock_quantity','stock_status','manage_stock',
  'images','tags','attributes','downloads','shipping_class','tax_status','tax_class'
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeEntities(value) {
  const named = new Map([
    ['amp','&'],['lt','<'],['gt','>'],['quot','"'],['apos',"'"],['nbsp',' '],['times','×'],['ndash','–'],['mdash','—']
  ]);
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named.has(n.toLowerCase()) ? named.get(n.toLowerCase()) : m);
}
function visibleText(html='') {
  return decodeEntities(String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|div|section|article)>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
  return value;
}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function protectedSnapshot(product){return Object.fromEntries(protectedFields.map((key)=>[key, product?.[key] ?? null]));}

async function fetchJson(url, options={}, attempts=5) {
  let last;
  for (let attempt=1; attempt<=attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect:'follow',
        signal:AbortSignal.timeout(25000),
        headers:{Accept:'application/json','User-Agent':'DTFSeeds-WooCommerce-Semantic-Reconciler/1.0',...(options.headers||{})}
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw:text.slice(0,1200) }; }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body?.message || body?.raw || 'request failed'}`);
      return body;
    } catch (error) {
      last=error;
      if(attempt<attempts) await sleep(attempt*1800);
    }
  }
  throw last;
}
async function wc(path, options={}) {
  return fetchJson(`${siteUrl}${path}`, {
    ...options,
    headers:{Authorization:authHeader,'Content-Type':'application/json',...(options.headers||{})}
  });
}
async function publicBySlug(slug){
  const u=new URL('/wp-json/wc/store/v1/products',siteUrl); u.searchParams.set('slug',slug);
  const body=await fetchJson(u.href); if(!Array.isArray(body)) throw new Error(`Unexpected Store API response for ${slug}`); return body;
}
async function privateBySlug(slug){
  const q=new URLSearchParams({slug,per_page:'100'}); const body=await wc(`/wp-json/wc/v3/products?${q}`);
  if(!Array.isArray(body)) throw new Error(`Unexpected wc/v3 response for ${slug}`); return body;
}
function assertPinned(spec, product, source){if(Number(product?.id)!==Number(spec.expectedProductId)) throw new Error(`${spec.registryId}: ${source} ID ${product?.id} does not match pinned ID ${spec.expectedProductId}`);}

await mkdir(backupDir,{recursive:true});
const prepared=[];
for(const spec of plan.products){
  const pub=await publicBySlug(spec.slug); if(pub.length!==1) throw new Error(`${spec.registryId}: expected one public product, found ${pub.length}`); assertPinned(spec,pub[0],'Store API');
  const priv=await privateBySlug(spec.slug); if(priv.length!==1) throw new Error(`${spec.registryId}: expected one authenticated product, found ${priv.length}`); assertPinned(spec,priv[0],'wc/v3');
  const current=priv[0];
  await writeFile(join(backupDir,`${spec.registryId}-before.json`),`${JSON.stringify(current,null,2)}\n`,'utf8');
  prepared.push({spec,current,protectedBefore:protectedSnapshot(current)});
}
await writeFile(join(backupDir,'backup-manifest.json'),`${JSON.stringify({generatedAt:new Date().toISOString(),siteUrl,products:prepared.map(({spec,current})=>({registryId:spec.registryId,slug:spec.slug,expectedProductId:spec.expectedProductId,productId:current.id}))},null,2)}\n`,'utf8');
await writeFile(join(backupRoot,'woocommerce-backup-path.txt'),`${backupDir}\n`,'utf8');

let categories=await wc(`/wp-json/wc/v3/products/categories?${new URLSearchParams({search:desiredCategory,per_page:'100'})}`);
let seedCategory=categories.find((c)=>String(c?.name||'').toLowerCase()===desiredCategory.toLowerCase()||String(c?.slug||'').toLowerCase()===desiredCategory.toLowerCase());
if(!seedCategory?.id) seedCategory=await wc('/wp-json/wc/v3/products/categories',{method:'POST',body:JSON.stringify({name:desiredCategory})});
if(!seedCategory?.id) throw new Error('Could not resolve Seeds category.');

const results=[];
for(const item of prepared){
  const {spec,current,protectedBefore}=item;
  const kept=(Array.isArray(current.categories)?current.categories:[])
    .filter((c)=>!removeSlugs.has(String(c?.slug||'').toLowerCase()))
    .map((c)=>({id:c.id}));
  if(!kept.some((c)=>Number(c.id)===Number(seedCategory.id))) kept.push({id:seedCategory.id});
  const payload={description:spec.description,short_description:spec.shortDescription,categories:kept};
  if(!spec.preserveCurrentName && spec.desiredName) payload.name=spec.desiredName;
  await writeFile(join(backupDir,`${spec.registryId}-planned-payload.json`),`${JSON.stringify(payload,null,2)}\n`,'utf8');
  const updated=await wc(`/wp-json/wc/v3/products/${current.id}`,{method:'PUT',body:JSON.stringify(payload)}); assertPinned(spec,updated,'update response');
  const after=await wc(`/wp-json/wc/v3/products/${current.id}`); assertPinned(spec,after,'post-update verification');
  const failures=[];
  if(!spec.preserveCurrentName && spec.desiredName && after.name!==spec.desiredName) failures.push('name');
  if(visibleText(after.description)!==visibleText(spec.description)) failures.push('description visible text');
  if(visibleText(after.short_description)!==visibleText(spec.shortDescription)) failures.push('short description visible text');
  const afterCats=Array.isArray(after.categories)?after.categories:[];
  if(!afterCats.some((c)=>Number(c?.id)===Number(seedCategory.id))) failures.push('Seeds category');
  if(afterCats.some((c)=>removeSlugs.has(String(c?.slug||'').toLowerCase()))) failures.push('legacy category');
  const protectedAfter=protectedSnapshot(after);
  if(!same(protectedBefore,protectedAfter)) failures.push('protected transaction fields');
  for(const href of ['/seeds/','/learn/']) if(!String(after.description||'').includes(href)) failures.push(`link ${href}`);
  if(failures.length) throw new Error(`${spec.registryId}: post-update verification failed: ${failures.join(', ')}`);
  await writeFile(join(backupDir,`${spec.registryId}-after.json`),`${JSON.stringify(after,null,2)}\n`,'utf8');
  results.push({registryId:spec.registryId,productId:after.id,name:after.name,verified:true,categoryIds:afterCats.map((c)=>c.id)});
}
const report={generatedAt:new Date().toISOString(),siteUrl,backupDir,productCount:results.length,productsChanged:results.length,productsNeedingChanges:0,results};
await writeFile('woocommerce-reconciliation-report.json',`${JSON.stringify(report,null,2)}\n`,'utf8');
await writeFile('woocommerce-reconciliation-report.md',`# WooCommerce Product Reconciliation\n\nMode: **apply-semantic**\nProducts verified: **${results.length}**\nProducts needing changes: **0**\nRollback snapshots: ${backupDir}\n\nVisible canonical copy, required product identity/category/link fields, and protected transaction fields were verified after each write.\n`,'utf8');
console.log(JSON.stringify(report,null,2));