import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const ck=process.env.WC_CONSUMER_KEY||'';
const cs=process.env.WC_CONSUMER_SECRET||'';
const apply=String(process.env.APPLY_STRAIN_CARD_IMAGES||'').toLowerCase()==='true';
const registry=JSON.parse(await readFile(process.env.STRAIN_CARD_REGISTRY||'site/wordpress/products/strain-card-images.json','utf8'));
const root=process.env.BACKUP_ROOT||'/tmp/woocommerce-strain-card-backups';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if(registry?.schemaVersion!==1||!Array.isArray(registry.cards)||registry.cards.length!==3) throw new Error('Expected three pinned strain cards');
const wpAuth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const wcAuth=ck&&cs?`Basic ${Buffer.from(`${ck}:${cs}`).toString('base64')}`:wpAuth;
const dir=join(root,`cdn-cards-${new Date().toISOString().replace(/[-:.]/g,'')}`);await mkdir(dir,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const protectedFields=['name','slug','status','sku','regular_price','sale_price','price','stock_quantity','stock_status','manage_stock','tags','attributes','downloads','shipping_class','tax_status','tax_class','categories','short_description','description'];
const snap=p=>Object.fromEntries(protectedFields.map(k=>[k,p?.[k]??null]));
async function fetchOk(url,opt={}){const r=await fetch(url,{...opt,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'DTFSeeds-Strain-CDN/1.0',...(opt.headers||{})}});if(!r.ok)throw new Error(`${opt.method||'GET'} ${url}: HTTP ${r.status}`);return r;}
async function json(url,opt={},auth=wpAuth){const r=await fetchOk(url,{...opt,headers:{Authorization:auth,Accept:'application/json',...(opt.body?{'Content-Type':'application/json'}:{}),...(opt.headers||{})}});const t=await r.text();return t?JSON.parse(t):null;}
const wp=(p,o={})=>json(`${site}${p}`,o,wpAuth);const wc=(p,o={})=>json(`${site}${p}`,o,wcAuth);
function info(b){if(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return{mime:'image/png',w:b.readUInt32BE(16),h:b.readUInt32BE(20)};if(b.subarray(0,3).toString('hex')==='ffd8ff'){let o=2;while(o+9<b.length){if(b[o]!==255){o++;continue}const m=b[o+1];if(m===216||m===217){o+=2;continue}const n=b.readUInt16BE(o+2);if(n<2||o+2+n>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m))return{mime:'image/jpeg',h:b.readUInt16BE(o+5),w:b.readUInt16BE(o+7)};o+=2+n}}throw new Error('Source is not a valid PNG/JPEG');}
async function source(card){if(!card.sourceUrl)throw new Error(`${card.registryId}: sourceUrl missing`);const r=await fetchOk(card.sourceUrl);const b=Buffer.from(await r.arrayBuffer());const i=info(b);if(i.w!==Number(card.expectedWidth)||i.h!==Number(card.expectedHeight))throw new Error(`${card.registryId}: source dimensions ${i.w}x${i.h} != ${card.expectedWidth}x${card.expectedHeight}`);return{b,i,h:hash(b)};}
async function findMedia(slug){const rows=await wp(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);return Array.isArray(rows)?rows:[];}
async function ensureMedia(card,s){const slug=`${card.wordpressSlug}-${s.h.slice(0,10)}`;for(const m of [...await findMedia(card.wordpressSlug),...await findMedia(slug)]){if(!m?.source_url)continue;try{const rb=Buffer.from(await(await fetchOk(m.source_url,{headers:{'Cache-Control':'no-cache'}})).arrayBuffer());if(hash(rb)===s.h&&rb.length===s.b.length)return m;}catch{}}
if(!apply)return{id:null,source_url:null,dryRun:true};const ext=s.i.mime==='image/png'?'.png':'.jpg';const stem=basename(card.fileName).replace(/\.[^.]+$/,'');const r=await fetch(`${site}/wp-json/wp/v2/media`,{method:'POST',headers:{Authorization:wpAuth,'Content-Type':s.i.mime,'Content-Disposition':`attachment; filename="${stem}${ext}"`,'User-Agent':'DTFSeeds-Strain-CDN/1.0'},body:s.b,signal:AbortSignal.timeout(120000)});const t=await r.text();let body;try{body=JSON.parse(t)}catch{body={raw:t.slice(0,800)}}if(!r.ok||!body?.id)throw new Error(`${card.registryId}: media upload failed ${r.status}: ${body?.message||body?.raw}`);return wp(`/wp-json/wp/v2/media/${body.id}`,{method:'POST',body:JSON.stringify({slug,title:stem,alt_text:card.altText,caption:'DTF Genetics strain card'})});}
function images(primary,current=[]){return[{id:Number(primary.id)},...current.filter(x=>Number(x?.id)!==Number(primary.id)).map(x=>Number(x?.id)>0?{id:Number(x.id)}:{src:x.src})];}
const prepared=[];for(const card of registry.cards){const s=await source(card);const p=await wc(`/wp-json/wc/v3/products/${card.productId}`);if(Number(p?.id)!==Number(card.productId)||p?.slug!==card.productSlug)throw new Error(`${card.registryId}: WooCommerce identity mismatch`);await writeFile(join(dir,`${card.registryId}-before.json`),JSON.stringify(p,null,2));prepared.push({card,s,p,before:snap(p),old:p.images||[]});}
const changed=[];const results=[];try{for(const x of prepared){const m=await ensureMedia(x.card,x.s);let p=x.p;if(apply){p=await wc(`/wp-json/wc/v3/products/${x.card.productId}`,{method:'PUT',body:JSON.stringify({images:images(m,x.old)})});changed.push(x);p=await wc(`/wp-json/wc/v3/products/${x.card.productId}`);if(!same(x.before,snap(p)))throw new Error(`${x.card.registryId}: protected commerce fields changed`);if(Number(p?.images?.[0]?.id)!==Number(m.id))throw new Error(`${x.card.registryId}: card is not primary image`);const store=await json(`${site}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(x.card.productSlug)}&dtf=${Date.now()}`,{},'');if(!Array.isArray(store)||store.length!==1)throw new Error(`${x.card.registryId}: public Store API verification failed`);if(Number(store[0]?.images?.[0]?.id)!==Number(m.id)&&store[0]?.images?.[0]?.src!==m.source_url)throw new Error(`${x.card.registryId}: public primary image mismatch`);}results.push({registryId:x.card.registryId,productId:x.card.productId,mediaId:m.id,mediaUrl:m.source_url,sourceSha256:x.s.h});}}
catch(e){for(const x of changed.reverse()){try{await wc(`/wp-json/wc/v3/products/${x.card.productId}`,{method:'PUT',body:JSON.stringify({images:x.old})})}catch{}}throw e;}
const report={generatedAt:new Date().toISOString(),apply,cardCount:results.length,results};await writeFile('woocommerce-strain-card-image-report.json',JSON.stringify(report,null,2));await writeFile(join(root,'strain-card-backup-path.txt'),`${dir}\n`);console.log(JSON.stringify(report,null,2));
