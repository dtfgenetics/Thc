import crypto from 'node:crypto';
import dns from 'node:dns';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
dns.setDefaultResultOrder('ipv4first');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Owner-Storage-Audit/1.0'};

async function requestJson(path){
  const r=await fetch(`${siteUrl}${path}`,{headers,redirect:'follow',signal:AbortSignal.timeout(45000)});
  const text=await r.text();
  if(!r.ok) throw new Error(`GET ${path} failed (${r.status}): ${text.slice(0,500)}`);
  return JSON.parse(text);
}
function raw(page){
  if(typeof page?.content?.raw==='string') return page.content.raw;
  if(typeof page?.content?.rendered==='string') return page.content.rendered;
  return '';
}
function digest(s){return crypto.createHash('sha256').update(String(s).trim(),'utf8').digest('hex')}
function markers(content){
  const s=String(content||'');
  const l=s.toLowerCase();
  return {
    homeV3:s.includes('data-dtf-layout="home-v3"'),
    learnV3:s.includes('data-dtf-layout="learn-v3"'),
    learningV4:s.includes('data-dtf-learning-map="v4"')||l.includes('start with the question you are trying to answer.'),
    canonicalHome:l.includes('genetics, cultivation education, practical tools, and original cannabis games.'),
    canonicalLearn:l.includes('understand the plant. build the environment. make better decisions.'),
    oldHome:l.includes('thc grow doc, genetics, cultivation education, and games in one home.'),
    oldLearn:l.includes('grow education belongs in a clean, readable library.'),
    oldHomeCss:l.includes('/assets/dtf-home/dtf-home.css'),
    sharedHeaderV3:s.includes('data-dtf-shell="header-v3"'),
    sharedFooterV3:s.includes('data-dtf-shell="footer-v3"')
  };
}
function pageReport(page){
  const content=raw(page);
  return {
    id:Number(page.id||0),slug:page.slug||'',status:page.status||'',parent:Number(page.parent||0),
    link:page.link||'',title:page.title?.raw||page.title?.rendered||'',featuredMedia:Number(page.featured_media||0),
    contentLength:Buffer.byteLength(content,'utf8'),contentSha256:digest(content),markers:markers(content)
  };
}
async function publicProbe(path){
  const u=new URL(path,siteUrl);u.searchParams.set('dtf_storage_audit',`${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const r=await fetch(u,{redirect:'follow',headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Owner-Storage-Audit/1.0'},signal:AbortSignal.timeout(45000)});
  const html=await r.text();
  return {path,status:r.status,bytes:Buffer.byteLength(html,'utf8'),markers:markers(html),title:(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,200)};
}

const settings=await requestJson('/wp-json/wp/v2/settings?context=edit');
const homePages=await requestJson('/wp-json/wp/v2/pages?slug=home&context=edit&status=publish&per_page=100');
const learnPages=await requestJson('/wp-json/wp/v2/pages?slug=learn&context=edit&status=publish&per_page=100');
const frontId=Number(settings.page_on_front||0);
let frontPage=null;
if(frontId) frontPage=await requestJson(`/wp-json/wp/v2/pages/${frontId}?context=edit`);
const publicRoutes=[];
for(const p of ['/index.php','/','/index.php?pagename=learn','/learn/']) publicRoutes.push(await publicProbe(p));
console.log(JSON.stringify({
  generatedAt:new Date().toISOString(),siteUrl,
  settings:{showOnFront:settings.show_on_front||'',pageOnFront:frontId,pageForPosts:Number(settings.page_for_posts||0),title:settings.title||''},
  frontPage:frontPage?pageReport(frontPage):null,
  homePages:Array.isArray(homePages)?homePages.map(pageReport):[],
  learnPages:Array.isArray(learnPages)?learnPages.map(pageReport):[],
  publicRoutes
},null,2));
