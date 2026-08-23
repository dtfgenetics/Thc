import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_WOOCOMMERCE_ARCHIVE_STYLE||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-production-backups/woocommerce-archive';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`woocommerce-archive-${stamp}`);
await mkdir(backupDir,{recursive:true});

async function request(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{...options,headers:{Authorization:auth,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60_000)});
  const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
  return body;
}
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');

const style=`<style id="dtf-commerce-archive-style">
:root{--dtf-shop-ink:#102b1a;--dtf-shop-deep:#081b11;--dtf-shop-green:#1d7040;--dtf-shop-gold:#d6b75c;--dtf-shop-cream:#f7f4ea;--dtf-shop-muted:#526557;--dtf-shop-line:#d7e2d9}
body.woocommerce-shop,body.post-type-archive-product,body.single-product{background:var(--dtf-shop-cream);color:#173522}
body.woocommerce-shop main,body.post-type-archive-product main,.woocommerce-page main{width:min(1240px,calc(100% - 36px));margin-inline:auto;padding:64px 0 84px}
body.woocommerce-shop .wp-block-query-title,body.post-type-archive-product .wp-block-query-title,.woocommerce-products-header__title.page-title{font-size:clamp(2.75rem,7vw,5.35rem);line-height:.94;letter-spacing:-.055em;color:var(--dtf-shop-ink);margin:0 0 16px;max-width:820px}
body.woocommerce-shop .wp-block-query-title::before,body.post-type-archive-product .wp-block-query-title::before,.woocommerce-products-header__title.page-title::before{content:'DTF Genetics · Current releases';display:block;margin-bottom:12px;color:var(--dtf-shop-green);font-size:.78rem;line-height:1.2;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
body.woocommerce-shop .woocommerce-result-count,body.post-type-archive-product .woocommerce-result-count{display:inline-flex;align-items:center;min-height:38px;margin:6px 0 22px;padding:7px 12px;border:1px solid var(--dtf-shop-line);border-radius:999px;background:#fff;color:var(--dtf-shop-muted);font-weight:800}
body.woocommerce-shop .woocommerce-ordering,body.post-type-archive-product .woocommerce-ordering{margin:0 0 24px}
body.woocommerce-shop .woocommerce-ordering select,body.post-type-archive-product .woocommerce-ordering select{min-height:42px;border:1px solid #bfd0c3;border-radius:999px;background:#fff;padding:8px 38px 8px 14px;color:var(--dtf-shop-ink);font-weight:750;box-shadow:0 8px 22px rgba(18,49,29,.06)}
body.woocommerce-shop ul.products,body.post-type-archive-product ul.products{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))!important;gap:24px!important;margin:24px 0 0!important;padding:0!important}
body.woocommerce-shop ul.products::before,body.woocommerce-shop ul.products::after,body.post-type-archive-product ul.products::before,body.post-type-archive-product ul.products::after{display:none!important}
body.woocommerce-shop ul.products li.product,body.post-type-archive-product ul.products li.product{position:relative;float:none!important;width:auto!important;margin:0!important;padding:14px 14px 20px!important;background:#fff;border:1px solid var(--dtf-shop-line);border-radius:25px;box-shadow:0 14px 38px rgba(13,55,29,.08);overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
body.woocommerce-shop ul.products li.product:hover,body.post-type-archive-product ul.products li.product:hover{transform:translateY(-4px);border-color:#b9cfbe;box-shadow:0 22px 52px rgba(13,55,29,.14)}
body.woocommerce-shop ul.products li.product a.woocommerce-LoopProduct-link,body.post-type-archive-product ul.products li.product a.woocommerce-LoopProduct-link{display:block;text-decoration:none!important}
body.woocommerce-shop ul.products li.product img,body.post-type-archive-product ul.products li.product img{display:block;width:100%!important;aspect-ratio:1/1;object-fit:cover;margin:0 0 18px!important;border-radius:18px;background:#e9f0e9;box-shadow:none!important}
body.woocommerce-shop ul.products li.product .onsale,body.post-type-archive-product ul.products li.product .onsale{top:24px!important;left:24px!important;right:auto!important;min-width:0!important;min-height:0!important;line-height:1!important;margin:0!important;padding:8px 10px!important;border-radius:999px!important;background:var(--dtf-shop-gold)!important;color:var(--dtf-shop-deep)!important;font-size:.7rem!important;font-weight:950!important;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 8px 20px rgba(8,27,17,.18)}
body.woocommerce-shop .woocommerce-loop-product__title,body.post-type-archive-product .woocommerce-loop-product__title{min-height:2.7em;font-size:1.2rem!important;line-height:1.28!important;color:var(--dtf-shop-ink)!important;font-weight:900!important;padding:0!important;margin:2px 4px 10px!important;letter-spacing:-.015em}
body.woocommerce-shop ul.products li.product .price,body.post-type-archive-product ul.products li.product .price{display:flex!important;align-items:center;gap:8px;min-height:27px;margin:0 4px 8px!important;color:var(--dtf-shop-green)!important;font-weight:900!important;font-size:1.08rem!important}
body.woocommerce-shop ul.products li.product .price del,body.post-type-archive-product ul.products li.product .price del{color:#78867c!important;font-weight:650!important;opacity:.78}
body.woocommerce-shop ul.products li.product .price ins,body.post-type-archive-product ul.products li.product .price ins{text-decoration:none!important}
body.woocommerce-shop ul.products li.product .button,body.post-type-archive-product ul.products li.product .button{display:flex!important;align-items:center;justify-content:center;width:calc(100% - 8px);min-height:44px;margin:13px 4px 0!important;padding:10px 15px!important;border:1px solid var(--dtf-shop-deep)!important;border-radius:999px!important;background:var(--dtf-shop-deep)!important;color:#fff!important;font-weight:900!important;text-decoration:none!important;transition:background .16s ease,transform .16s ease}
body.woocommerce-shop ul.products li.product .button:hover,body.post-type-archive-product ul.products li.product .button:hover{background:var(--dtf-shop-green)!important;transform:translateY(-1px)}
body.woocommerce-shop .woocommerce-pagination ul.page-numbers,body.post-type-archive-product .woocommerce-pagination ul.page-numbers{border:0!important;display:flex;gap:8px;justify-content:center;margin-top:38px}
body.woocommerce-shop .woocommerce-pagination ul.page-numbers li,body.post-type-archive-product .woocommerce-pagination ul.page-numbers li{border:0!important}
body.woocommerce-shop .woocommerce-pagination a,body.woocommerce-shop .woocommerce-pagination span,body.post-type-archive-product .woocommerce-pagination a,body.post-type-archive-product .woocommerce-pagination span{border:1px solid #c9d8cd!important;border-radius:999px!important;padding:9px 13px!important;background:#fff!important;color:var(--dtf-shop-ink)!important}
body.woocommerce-shop .woocommerce-pagination .current,body.post-type-archive-product .woocommerce-pagination .current{background:var(--dtf-shop-deep)!important;color:#fff!important}
body.woocommerce-shop .woocommerce-info,body.post-type-archive-product .woocommerce-info{border-top-color:var(--dtf-shop-green)!important;border-radius:16px;background:#fff;color:var(--dtf-shop-ink)}

body.single-product main{width:min(1240px,calc(100% - 36px));margin-inline:auto;padding:54px 0 86px}
body.single-product .woocommerce-breadcrumb{margin:0 0 28px;color:#6a7c70;font-size:.88rem;font-weight:700}body.single-product .woocommerce-breadcrumb a{color:var(--dtf-shop-green);text-decoration:none}
body.single-product div.product{position:relative}body.single-product div.product::after{content:'';display:block;clear:both}
body.single-product div.product .woocommerce-product-gallery{float:left!important;width:48%!important;margin:0 0 48px!important;padding:14px;background:#fff;border:1px solid var(--dtf-shop-line);border-radius:28px;box-shadow:0 18px 48px rgba(13,55,29,.09);overflow:hidden}
body.single-product div.product .woocommerce-product-gallery img{border-radius:18px;background:#e9f0e9}
body.single-product div.product .woocommerce-product-gallery .flex-control-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:10px 0 0!important;padding:0!important}body.single-product div.product .woocommerce-product-gallery .flex-control-thumbs li{float:none!important;width:auto!important;margin:0!important}body.single-product div.product .woocommerce-product-gallery .flex-control-thumbs img{border-radius:11px;border:2px solid transparent}body.single-product div.product .woocommerce-product-gallery .flex-control-thumbs img.flex-active{border-color:var(--dtf-shop-green)}
body.single-product div.product .summary{float:right!important;width:47%!important;margin:0 0 48px!important;padding:30px 30px 28px;background:#fff;border:1px solid var(--dtf-shop-line);border-radius:28px;box-shadow:0 18px 48px rgba(13,55,29,.09)}
body.single-product div.product .summary::before{content:'DTF Genetics · Documented release';display:block;margin:0 0 10px;color:var(--dtf-shop-green);font-size:.75rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
body.single-product .product_title{margin:0 0 15px!important;color:var(--dtf-shop-ink);font-size:clamp(2.25rem,5vw,4.35rem)!important;line-height:.98!important;letter-spacing:-.05em!important;font-weight:950!important}
body.single-product div.product .summary .price{display:flex;align-items:center;gap:10px;margin:0 0 20px!important;color:var(--dtf-shop-green)!important;font-size:1.55rem!important;font-weight:950!important}body.single-product div.product .summary .price del{color:#7a897f!important;font-size:1rem;opacity:.72}body.single-product div.product .summary .price ins{text-decoration:none!important}
body.single-product div.product .woocommerce-product-details__short-description{margin:0 0 22px;padding:16px 18px;border-left:4px solid var(--dtf-shop-gold);border-radius:14px;background:#f4f7f1;color:var(--dtf-shop-muted);line-height:1.7}body.single-product div.product .woocommerce-product-details__short-description p{margin:0}
body.single-product div.product form.cart{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:22px 0!important;padding:18px 0;border-top:1px solid var(--dtf-shop-line);border-bottom:1px solid var(--dtf-shop-line)}
body.single-product div.product form.cart .quantity .qty{width:76px;min-height:48px;border:1px solid #bfd0c3;border-radius:14px;background:#fff;color:var(--dtf-shop-ink);font-weight:900}
body.single-product div.product form.cart .single_add_to_cart_button{min-height:48px;padding:12px 22px!important;border-radius:999px!important;background:var(--dtf-shop-deep)!important;color:#fff!important;font-weight:950!important}body.single-product div.product form.cart .single_add_to_cart_button:hover{background:var(--dtf-shop-green)!important}
body.single-product .product_meta{display:grid;gap:6px;color:#728078;font-size:.85rem}body.single-product .product_meta a{color:var(--dtf-shop-green);font-weight:800;text-decoration:none}
body.single-product span.onsale{top:18px!important;left:18px!important;right:auto!important;min-width:0!important;min-height:0!important;padding:9px 11px!important;border-radius:999px!important;background:var(--dtf-shop-gold)!important;color:var(--dtf-shop-deep)!important;font-size:.7rem!important;line-height:1!important;font-weight:950!important;letter-spacing:.08em;text-transform:uppercase;z-index:4}
body.single-product .woocommerce-tabs{clear:both!important;width:100%!important;margin:18px 0 0!important;padding:0!important}body.single-product .woocommerce-tabs ul.tabs{display:flex!important;gap:8px;flex-wrap:wrap;margin:0 0 18px!important;padding:0!important;border:0!important}body.single-product .woocommerce-tabs ul.tabs::before{display:none!important}body.single-product .woocommerce-tabs ul.tabs li{margin:0!important;padding:0!important;border:0!important;background:transparent!important}body.single-product .woocommerce-tabs ul.tabs li::before,body.single-product .woocommerce-tabs ul.tabs li::after{display:none!important}body.single-product .woocommerce-tabs ul.tabs li a{display:block;padding:10px 15px!important;border:1px solid var(--dtf-shop-line);border-radius:999px;background:#fff;color:var(--dtf-shop-ink)!important;font-weight:900!important;text-decoration:none}body.single-product .woocommerce-tabs ul.tabs li.active a{background:var(--dtf-shop-deep);border-color:var(--dtf-shop-deep);color:#fff!important}
body.single-product .woocommerce-Tabs-panel{padding:30px!important;border:1px solid var(--dtf-shop-line);border-radius:26px;background:#fff;box-shadow:0 14px 38px rgba(13,55,29,.07);color:var(--dtf-shop-muted);line-height:1.75}body.single-product .woocommerce-Tabs-panel>h2:first-child{display:none}
body.single-product .dtf-product-story{display:grid;gap:24px}.dtf-product-story .dtf-product-intro{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;align-items:start}.dtf-product-story h2{margin:0;color:var(--dtf-shop-ink);font-size:clamp(2rem,4vw,3.3rem);line-height:1;letter-spacing:-.04em}.dtf-product-story h3{margin:0 0 7px;color:var(--dtf-shop-ink);font-size:1.15rem}.dtf-product-story p{margin:0}.dtf-product-story .dtf-specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dtf-product-story .dtf-spec{padding:14px;border:1px solid var(--dtf-shop-line);border-radius:15px;background:#f7f9f5}.dtf-product-story .dtf-spec small{display:block;margin-bottom:4px;color:#728078;font-size:.7rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.dtf-product-story .dtf-spec strong{color:var(--dtf-shop-ink)}.dtf-product-story .dtf-note{padding:18px;border-left:4px solid var(--dtf-shop-gold);border-radius:14px;background:#f5f1df}.dtf-product-story .dtf-links{display:flex;gap:9px;flex-wrap:wrap}.dtf-product-story .dtf-links a{display:inline-flex;padding:9px 13px;border:1px solid var(--dtf-shop-line);border-radius:999px;background:#fff;color:var(--dtf-shop-green);font-weight:900;text-decoration:none}
body.single-product .related.products,body.single-product .upsells.products{clear:both;margin-top:56px}body.single-product .related.products>h2,body.single-product .upsells.products>h2{font-size:clamp(1.8rem,4vw,3rem);letter-spacing:-.035em;color:var(--dtf-shop-ink)}body.single-product .related.products ul.products,body.single-product .upsells.products ul.products{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:20px!important}
@media(min-width:1050px){body.woocommerce-shop ul.products:has(>li.product:nth-child(3):last-child),body.post-type-archive-product ul.products:has(>li.product:nth-child(3):last-child){grid-template-columns:repeat(3,minmax(0,1fr))!important}}
@media(max-width:820px){body.single-product div.product .woocommerce-product-gallery,body.single-product div.product .summary{float:none!important;width:100%!important}body.single-product .dtf-product-story .dtf-product-intro{grid-template-columns:1fr}body.single-product .related.products ul.products,body.single-product .upsells.products ul.products{grid-template-columns:1fr!important}}
@media(max-width:720px){body.woocommerce-shop main,body.post-type-archive-product main,.woocommerce-page main,body.single-product main{width:min(100% - 28px,1240px);padding-top:44px}body.woocommerce-shop ul.products,body.post-type-archive-product ul.products{grid-template-columns:1fr!important}.woocommerce-result-count,.woocommerce-ordering{float:none!important}body.single-product div.product .summary{padding:23px 19px}body.single-product .woocommerce-Tabs-panel{padding:22px!important}.dtf-product-story .dtf-specs{grid-template-columns:1fr}}
</style>`;
const marker='dtf-commerce-archive-style';
const parts=await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const headers=(parts||[]).filter(p=>p.theme==='hostinger-ai-theme'&&p.slug==='header');
if(!headers.length) throw new Error('Active Hostinger header template part was not found');
const results=[];
for(const part of headers){
  const original=rendered(part.content);
  await writeFile(join(backupDir,`template-part-${String(part.id).replaceAll('/','_')}-before.json`),`${JSON.stringify(part,null,2)}\n`);
  const cleaned=original.replace(/<!-- wp:html -->\s*<style id="dtf-commerce-archive-style">[\s\S]*?<\/style>\s*<!-- \/wp:html -->/gi,'').replace(/<style id="dtf-commerce-archive-style">[\s\S]*?<\/style>/gi,'');
  const next=`${cleaned}\n<!-- wp:html -->${style}<!-- /wp:html -->`;
  if(apply) await request(`/wp-json/wp/v2/template-parts/${encodeURIComponent(part.id)}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
  results.push({id:part.id,changed:original!==next,marker});
}
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,templateParts:results,marker};
await writeFile(join(backupDir,'woocommerce-archive-style-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'woocommerce-archive-style-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));