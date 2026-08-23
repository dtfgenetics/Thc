import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PRODUCT_VISUAL_V5||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-product-visual-v5';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`product-v5-${stamp}`);await mkdir(backupDir,{recursive:true});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=8;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Product-Visual/5.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
      if((response.status===429||response.status>=500)&&attempt<8){await sleep(attempt*1800);continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<8){await sleep(attempt*1800);continue}}
  }
  throw last;
}
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const style=`<style id="dtf-product-visual-v5">
:root{--pv5-deep:#06170e;--pv5-forest:#0b2919;--pv5-green:#257a48;--pv5-gold:#d7b961;--pv5-gold2:#ead58c;--pv5-paper:#fffdf7;--pv5-cream:#f6f2e8;--pv5-ink:#112b1c;--pv5-muted:#5b6e61;--pv5-line:#d8e2d9;--pv5-blue:#315e7a;--pv5-purple:#674a76}
body.single-product{background:linear-gradient(180deg,#f8f5ed,var(--pv5-cream))!important;color:var(--pv5-ink)}
body.single-product main{padding-top:clamp(34px,5vw,70px)!important;padding-bottom:clamp(70px,9vw,120px)!important}
body.single-product div.product{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(340px,.98fr);gap:clamp(34px,6vw,78px);align-items:start;max-width:1260px;margin-inline:auto!important;padding-inline:21px}
body.single-product div.product>.woocommerce-product-gallery,body.single-product .wp-block-woocommerce-product-image-gallery{position:sticky;top:92px;border-radius:28px;padding:15px;background:rgba(255,253,247,.96);border:1px solid rgba(17,43,28,.1);box-shadow:0 22px 56px rgba(13,55,29,.10);overflow:hidden}
body.single-product .woocommerce-product-gallery img,body.single-product .wp-block-woocommerce-product-image-gallery img{border-radius:19px!important;width:100%!important;height:auto!important;object-fit:contain!important;background:#fff}
body.single-product .summary{position:relative;padding:clamp(25px,4vw,42px);border-radius:28px;background:rgba(255,253,247,.98);border:1px solid rgba(17,43,28,.10);box-shadow:0 20px 52px rgba(13,55,29,.09)}
body.single-product .summary:before{content:"DTF GENETICS • CURRENT RELEASE";display:inline-flex;margin-bottom:17px;padding:7px 10px;border-radius:999px;background:#e7f0e8;border:1px solid #c7d8cb;color:var(--pv5-green);font-size:.67rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
body.single-product .product_title,body.single-product .wp-block-post-title{margin:0 0 12px!important;font-size:clamp(2.65rem,5.3vw,5.15rem)!important;line-height:.91!important;letter-spacing:-.057em!important;text-wrap:balance;color:var(--pv5-ink)!important}
body.single-product.postid-39 .product_title:before,body.single-product.postid-39 .wp-block-post-title:before{content:"F2 • REGULAR • 10 SEEDS"}
body.single-product.postid-41 .product_title:before,body.single-product.postid-41 .wp-block-post-title:before{content:"F2 • FEMINIZED • 10 SEEDS"}
body.single-product.postid-91 .product_title:before,body.single-product.postid-91 .wp-block-post-title:before{content:"F1 • REGULAR • 10 SEEDS"}
body.single-product .product_title:before,body.single-product .wp-block-post-title:before{display:block;width:max-content;max-width:100%;margin-bottom:13px;padding:7px 10px;border-radius:999px;background:#102f1e;color:#f0d98f;font-size:.68rem!important;line-height:1!important;letter-spacing:.11em!important;font-weight:950;text-transform:uppercase}
body.single-product.postid-41 .product_title:before,body.single-product.postid-41 .wp-block-post-title:before{background:var(--pv5-blue);color:#fff}
body.single-product.postid-91 .product_title:before,body.single-product.postid-91 .wp-block-post-title:before{background:var(--pv5-purple);color:#fff}
body.single-product.postid-39 .product_title:after,body.single-product.postid-39 .wp-block-post-title:after,body.single-product.postid-41 .product_title:after,body.single-product.postid-41 .wp-block-post-title:after{content:"Somango XXL × Blueberry Butcher"}
body.single-product.postid-91 .product_title:after,body.single-product.postid-91 .wp-block-post-title:after{content:"Bubblegum Kush × Blueberry Butcher"}
body.single-product .product_title:after,body.single-product .wp-block-post-title:after{display:block;margin-top:16px;color:#2f6742;font-size:clamp(.92rem,1.5vw,1.08rem)!important;line-height:1.45!important;letter-spacing:0!important;font-weight:900}
body.single-product.postid-91 .product_title:after,body.single-product.postid-91 .wp-block-post-title:after{color:#654873}
body.single-product .summary .price,body.single-product .wp-block-woocommerce-product-price{margin:22px 0 16px!important;font-size:clamp(1.5rem,2.6vw,2.15rem)!important;font-weight:950!important;color:var(--pv5-ink)!important}
body.single-product .woocommerce-product-details__short-description{margin:0 0 22px;color:var(--pv5-muted);font-size:1.02rem;line-height:1.75}
body.single-product form.cart{display:grid!important;grid-template-columns:auto 1fr;gap:11px;margin:26px 0 20px!important;padding:18px;border-radius:19px;background:#edf3ed;border:1px solid #cfddd2}
body.single-product form.cart .quantity input{min-height:52px!important;border-radius:12px!important;border:1px solid #bfd0c3!important;background:#fff!important}
body.single-product .single_add_to_cart_button,body.single-product .wp-block-add-to-cart-form button{min-height:52px!important;border-radius:13px!important;background:linear-gradient(180deg,#183e27,var(--pv5-deep))!important;border-color:var(--pv5-deep)!important;color:#fff!important;font-weight:950!important;font-size:1rem!important;box-shadow:0 12px 26px rgba(6,23,14,.14)!important}
body.single-product .single_add_to_cart_button:hover,body.single-product .wp-block-add-to-cart-form button:hover{background:linear-gradient(180deg,#319157,var(--pv5-green))!important}
body.single-product .product_meta{margin-top:20px!important;padding:18px 19px!important;border-radius:17px!important;background:#f6f0df!important;border:1px solid #e5d7aa!important;color:#6c613e!important;line-height:1.7!important}
body.single-product .product_meta:before{content:"PACK & LISTING DETAILS";display:block;margin-bottom:7px;color:#574718;font-size:.65rem;font-weight:950;letter-spacing:.12em}
body.single-product .woocommerce-tabs,body.single-product .related.products,body.single-product .up-sells{grid-column:1/-1;margin-top:clamp(38px,6vw,72px)!important}
body.single-product .woocommerce-tabs{padding:clamp(25px,4vw,42px)!important;border-radius:25px!important;background:rgba(255,253,247,.95)!important;border:1px solid rgba(17,43,28,.1)!important;box-shadow:0 16px 40px rgba(13,55,29,.06)}
body.single-product .woocommerce-tabs ul.tabs{display:flex;gap:8px;flex-wrap:wrap;padding:0!important;margin-bottom:24px!important}
body.single-product .woocommerce-tabs ul.tabs li{margin:0!important;border-radius:999px!important;border:1px solid #cbd8ce!important;background:#edf3ed!important}
body.single-product .woocommerce-tabs ul.tabs li.active{background:#123521!important;border-color:#123521!important}body.single-product .woocommerce-tabs ul.tabs li.active a{color:#fff!important}
body.single-product .woocommerce-tabs h2,body.single-product .related.products>h2,body.single-product .up-sells>h2{font-size:clamp(2rem,4vw,3.35rem)!important;letter-spacing:-.045em!important;line-height:1!important}
body.single-product .related.products ul.products{gap:22px!important}
body.single-product .related.products li.product{border-radius:22px!important;background:var(--pv5-paper)!important;padding:11px 11px 18px!important;box-shadow:0 12px 32px rgba(13,55,29,.07)!important}
body.single-product .related.products li.product img{border-radius:16px!important}
body.single-product .woocommerce-breadcrumb{max-width:1260px;margin:0 auto 22px!important;padding-inline:21px;color:#6a7a70!important;font-size:.85rem!important}
@media(max-width:900px){body.single-product div.product{grid-template-columns:1fr!important}.woocommerce-product-gallery,.wp-block-woocommerce-product-image-gallery{position:relative!important;top:auto!important}.summary{padding:25px!important}}
@media(max-width:560px){body.single-product div.product{padding-inline:14px}.woocommerce-breadcrumb{padding-inline:14px!important}body.single-product form.cart{grid-template-columns:1fr!important}.product_title,.wp-block-post-title{font-size:clamp(2.55rem,14vw,4rem)!important}.summary{border-radius:22px!important;padding:21px!important}}
@media(prefers-reduced-motion:reduce){body.single-product *{transition:none!important;animation:none!important}}
</style>`;
const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const headers=(parts||[]).filter(part=>part.theme==='hostinger-ai-theme'&&part.slug==='header');
if(!headers.length) throw new Error('Active Hostinger header template part was not found.');
const results=[];
for(const part of headers){
  const original=rendered(part.content);
  await writeFile(join(backupDir,`template-part-${String(part.id).replaceAll('/','_')}-before.json`),`${JSON.stringify(part,null,2)}\n`);
  const cleaned=original.replace(/<!-- wp:html -->\s*<style id="dtf-product-visual-v5">[\s\S]*?<\/style>\s*<!-- \/wp:html -->/gi,'').replace(/<style id="dtf-product-visual-v5">[\s\S]*?<\/style>/gi,'');
  const next=`${cleaned}\n<!-- wp:html -->${style}<!-- /wp:html -->`;
  if(apply) await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
  results.push({id:part.id,changed:original!==next});
}
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,marker:'dtf-product-visual-v5',templateParts:results};
await writeFile(join(backupDir,'product-visual-v5-report.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
