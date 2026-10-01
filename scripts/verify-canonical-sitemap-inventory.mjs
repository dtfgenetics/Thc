import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const required=['/courses/','/tools/'];
const seeds=['/sitemap.xml','/sitemap_index.xml','/wp-sitemap.xml'];
const seen=new Set(), working=new Set(), urls=new Set();
const siteOrigin=new URL(site).origin;
const norm=(value)=>{try{const u=new URL(value,site);if(u.origin!==siteOrigin)return null;let p=u.pathname.replace(/\/{2,}/g,'/');if(!p.endsWith('/'))p+='/';return p;}catch{return null;}};
async function get(url,headers={}){const r=await fetch(url,{headers:{'User-Agent':'DTFSeeds-Sitemap-Reconcile/1.0','Cache-Control':'no-cache',...headers},redirect:'follow',signal:AbortSignal.timeout(30000)});return {r,text:await r.text()};}
async function walk(url){if(seen.has(url)||seen.size>=40)return;seen.add(url);const {r,text}=await get(url);if(!r.ok||!/<(?:urlset|sitemapindex)\b/i.test(text))return;working.add(url);for(const raw of [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m=>m[1].replaceAll('&amp;','&'))){const p=norm(raw);if(p)urls.add(p);if(/\.xml(?:$|\?)/i.test(raw))await walk(new URL(raw,site).href);}}
for(const p of seeds)await walk(new URL(p,site).href);
const report={generatedAt:new Date().toISOString(),site,workingSitemaps:[...working],attemptedSitemaps:[...seen],inventoryCount:urls.size,required:Object.fromEntries(required.map(p=>[p,urls.has(p)]))};
if(auth){const {r,text}=await get(`${site}/wp-json/wp/v2/pages?slug=courses&context=edit&per_page=10`,{Authorization:auth,Accept:'application/json'});let rows=[];try{rows=JSON.parse(text)}catch{};report.coursesWordPress={status:r.status,count:Array.isArray(rows)?rows.length:null,pages:Array.isArray(rows)?rows.map(x=>({id:x.id,status:x.status,link:x.link,slug:x.slug})) : []};if(Array.isArray(rows)&&rows.length===1){try{const a=await get(`${site}/wp-json/aioseo/v1/post?postId=${rows[0].id}`,{Authorization:auth,Accept:'application/json'});const j=JSON.parse(a.text);const p=j?.data?.currentPost||{};report.coursesAioseo={status:a.r.status,noindex:p.noindex??null,nofollow:p.nofollow??null,canonicalUrl:p.canonicalUrl??null,title:p.title??null};}catch(e){report.coursesAioseo={error:String(e)}}}}
console.log(JSON.stringify(report,null,2));
if(required.some(p=>!urls.has(p)))process.exitCode=1;
