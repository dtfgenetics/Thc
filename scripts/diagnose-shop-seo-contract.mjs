import {writeFile} from 'node:fs/promises';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass)throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Shop-SEO-Contract-Diagnostic/1.0'};
async function get(path){const r=await fetch(`${site}${path}`,{headers,redirect:'follow',signal:AbortSignal.timeout(45000)});const t=await r.text();let b=t;try{b=t?JSON.parse(t):null}catch{}if(!r.ok)throw new Error(`GET ${path} failed (${r.status}): ${typeof b==='string'?b.slice(0,500):JSON.stringify(b).slice(0,500)}`);return b;}
const secret=/password|secret|token|license|api.?key|auth/i;
const terms=/shop|product|woocommerce|woo_/i;
function scalar(v){return v===null||['string','number','boolean'].includes(typeof v)}
function scan(value,path='',out=[]){if(out.length>=300)return out;if(scalar(value)){if(terms.test(path)||typeof value==='string'&&terms.test(value))out.push({path,value:secret.test(path)?'[redacted]':value});return out}if(Array.isArray(value)){for(let i=0;i<Math.min(value.length,50);i++)scan(value[i],`${path}[${i}]`,out);return out}if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value)){if(secret.test(k)){if(terms.test(path+'.'+k))out.push({path:path?`${path}.${k}`:k,value:'[redacted]'});continue}scan(v,path?`${path}.${k}`:k,out)}return out}return out}
const [index,options,pages]=await Promise.all([get('/wp-json/'),get('/wp-json/aioseo/v1/options'),get('/wp-json/wp/v2/pages?slug=shop&context=edit&per_page=10')]);
if(!Array.isArray(pages)||pages.length!==1)throw new Error(`Expected one Shop page; found ${Array.isArray(pages)?pages.length:'invalid'}`);
const shop=pages[0];const aio=await get(`/wp-json/aioseo/v1/post?postId=${shop.id}`);
const routeInfo=Object.entries(index?.routes||{}).filter(([route])=>/aioseo|woocommerce|wc\/|code-snippets/i.test(route)).map(([route,meta])=>({route,methods:meta?.methods||[]}));
const optionMatches=scan(options?.options??options);
const current=aio?.data?.currentPost||{};
const report={generatedAt:new Date().toISOString(),shop:{id:shop.id,slug:shop.slug,link:shop.link,title:shop?.title?.raw||shop?.title?.rendered||null},aioseoPost:{title:current.title??null,description:current.description??null,canonicalUrl:current.canonicalUrl??null,default:current.default??null,noindex:current.noindex??null},routeInfo,optionMatches};
await writeFile('shop-seo-contract-diagnostic.json',`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
