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
body.woocommerce-shop,body.post-type-archive-product{background:#f5f8f4;color:#173522}
body.woocommerce-shop main,body.post-type-archive-product main,.woocommerce-page main{max-width:1240px;margin-inline:auto;padding:42px 22px 70px}
body.woocommerce-shop .wp-block-query-title,body.post-type-archive-product .wp-block-query-title,.woocommerce-products-header__title.page-title{font-size:clamp(2.5rem,6vw,4.8rem);line-height:1;letter-spacing:-.045em;color:#173522;margin-bottom:12px}
body.woocommerce-shop .woocommerce-result-count,body.post-type-archive-product .woocommerce-result-count{color:#587060;font-weight:700}
body.woocommerce-shop .woocommerce-ordering select,body.post-type-archive-product .woocommerce-ordering select{border:1px solid #c9d8cd;border-radius:999px;background:#fff;padding:10px 14px;color:#173522}
body.woocommerce-shop ul.products,body.post-type-archive-product ul.products{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))!important;gap:22px!important;margin-top:30px!important}
body.woocommerce-shop ul.products::before,body.woocommerce-shop ul.products::after,body.post-type-archive-product ul.products::before,body.post-type-archive-product ul.products::after{display:none!important}
body.woocommerce-shop ul.products li.product,body.post-type-archive-product ul.products li.product{float:none!important;width:auto!important;margin:0!important;background:#fff;border:1px solid #dbe7de;border-radius:24px;padding:16px 16px 20px;box-shadow:0 14px 34px rgba(13,55,29,.08);transition:transform .2s ease,box-shadow .2s ease;overflow:hidden}
body.woocommerce-shop ul.products li.product:hover,body.post-type-archive-product ul.products li.product:hover{transform:translateY(-4px);box-shadow:0 20px 44px rgba(13,55,29,.13)}
body.woocommerce-shop ul.products li.product img,body.post-type-archive-product ul.products li.product img{border-radius:16px;aspect-ratio:1/1;object-fit:cover;margin-bottom:16px!important}
body.woocommerce-shop .woocommerce-loop-product__title,body.post-type-archive-product .woocommerce-loop-product__title{font-size:1.12rem!important;line-height:1.35!important;color:#173522!important;font-weight:850!important;padding:0!important;margin:4px 0 10px!important}
body.woocommerce-shop ul.products li.product .price,body.post-type-archive-product ul.products li.product .price{color:#2b6e42!important;font-weight:850!important;font-size:1rem!important}
body.woocommerce-shop ul.products li.product .button,body.post-type-archive-product ul.products li.product .button{display:inline-block;background:#173c25!important;color:#fff!important;border-radius:999px!important;padding:11px 16px!important;font-weight:850!important;text-decoration:none!important;margin-top:10px!important}
body.woocommerce-shop .woocommerce-pagination ul.page-numbers,body.post-type-archive-product .woocommerce-pagination ul.page-numbers{border:0!important;display:flex;gap:8px;justify-content:center;margin-top:34px}
body.woocommerce-shop .woocommerce-pagination ul.page-numbers li,body.post-type-archive-product .woocommerce-pagination ul.page-numbers li{border:0!important}
body.woocommerce-shop .woocommerce-pagination a,body.woocommerce-shop .woocommerce-pagination span,body.post-type-archive-product .woocommerce-pagination a,body.post-type-archive-product .woocommerce-pagination span{border:1px solid #c9d8cd!important;border-radius:999px!important;padding:9px 13px!important;background:#fff!important;color:#173522!important}
body.woocommerce-shop .woocommerce-pagination .current,body.post-type-archive-product .woocommerce-pagination .current{background:#173c25!important;color:#fff!important}
@media(max-width:640px){body.woocommerce-shop main,body.post-type-archive-product main,.woocommerce-page main{padding-inline:16px}body.woocommerce-shop ul.products,body.post-type-archive-product ul.products{grid-template-columns:1fr!important}}
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
  results.push({id:part.id,changed:cleaned!==next,marker});
}
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,templateParts:results,marker};
await writeFile(join(backupDir,'woocommerce-archive-style-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'woocommerce-archive-style-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));
