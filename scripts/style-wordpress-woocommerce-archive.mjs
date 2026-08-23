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
body.woocommerce-shop,body.post-type-archive-product{background:var(--dtf-shop-cream);color:#173522}
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
@media(min-width:1050px){body.woocommerce-shop ul.products:has(>li.product:nth-child(3):last-child),body.post-type-archive-product ul.products:has(>li.product:nth-child(3):last-child){grid-template-columns:repeat(3,minmax(0,1fr))!important}}
@media(max-width:720px){body.woocommerce-shop main,body.post-type-archive-product main,.woocommerce-page main{width:min(100% - 28px,1240px);padding-top:48px}body.woocommerce-shop ul.products,body.post-type-archive-product ul.products{grid-template-columns:1fr!important}.woocommerce-result-count,.woocommerce-ordering{float:none!important}}
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