import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_HOME_GENETICS_ART||'').toLowerCase()==='true';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=10;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Home-Genetics-Art/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
      if((response.status===429||response.status>=500)&&attempt<10){await sleep(Math.min(12000,attempt*1600));continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return body;
    }catch(error){last=error;if(attempt<10){await sleep(Math.min(12000,attempt*1600));continue}}
  }
  throw last;
}
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

async function allMedia(){
  const out=[];
  for(let page=1;page<=4;page+=1){
    let batch;
    try{batch=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`)}catch(error){if(/400|invalid_page_number/i.test(error.message))break;throw error}
    if(!Array.isArray(batch)||!batch.length)break;
    out.push(...batch);
    if(batch.length<100)break;
  }
  return out;
}

const releases=[
  {
    title:'Blue Mango F2 · Regular',
    slugPrefix:'dtf-strain-card-blue-mango-f2-regular',
    alt:'Blue Mango F2 Regular DTF Genetics strain card',
    fallback:'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-blue-mango-f2-regular.jpg?v=1787510072'
  },
  {
    title:'Blue Mango F2 · Feminized',
    slugPrefix:'dtf-strain-card-blue-mango-f2-feminized',
    alt:'Blue Mango F2 Feminized DTF Genetics strain card',
    fallback:'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-blue-mango-f2-feminized.png?v=1787510082'
  },
  {
    title:'Blue Bubblegum F1 · Regular',
    slugPrefix:'dtf-strain-card-blue-bubblegum-f1-regular',
    alt:'Blue Bubblegum F1 Regular DTF Genetics strain card',
    fallback:'https://cdn.shopify.com/s/files/1/0664/2542/1885/files/dtf-blue-bubblegum-f1-regular.jpg?v=1787510057'
  }
];

function replaceCardImage(content,release,url){
  const title=release.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`(<article\\s+class=["'][^"']*dtf-image-card[^"']*["'][^>]*>)([\\s\\S]*?)(<h3>${title}<\\/h3>)`,'i');
  const match=content.match(re);
  if(!match) throw new Error(`Home release card not found: ${release.title}`);
  const img=`<img class="dtf-img" src="${esc(url)}" alt="${esc(release.alt)}" loading="lazy" decoding="async" style="aspect-ratio:2/3;object-fit:contain;background:#fff">`;
  const middle=match[2];
  const nextMiddle=/<img\b[^>]*>/i.test(middle)?middle.replace(/<img\b[^>]*>/i,img):`${img}${middle}`;
  return content.replace(re,`${match[1]}${nextMiddle}${match[3]}`);
}

const [homeRows,media]=await Promise.all([
  request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10'),
  allMedia()
]);
if(!Array.isArray(homeRows)||homeRows.length!==1) throw new Error(`Expected exactly one Home page; found ${Array.isArray(homeRows)?homeRows.length:'invalid'}.`);
const home=homeRows[0];
let content=rendered(home.content);
if(!content.includes('Current releases')||!content.includes('Blue Mango F2 · Regular')||!content.includes('Blue Bubblegum F1 · Regular')) throw new Error('Home does not expose the expected current-release card structure; refusing image replacement.');
const chosen=[];
for(const release of releases){
  const candidates=media.filter(m=>String(m?.slug||'').startsWith(release.slugPrefix)&&m?.source_url);
  candidates.sort((a,b)=>Number(b.id||0)-Number(a.id||0));
  const url=candidates[0]?.source_url||release.fallback;
  content=replaceCardImage(content,release,url);
  chosen.push({title:release.title,url,wordpressMediaId:candidates[0]?.id||null,source:candidates[0]?'wordpress':'cdn-fallback'});
}
if(apply) await request(`/wp-json/wp/v2/pages/${home.id}`,{method:'POST',body:JSON.stringify({content,status:'publish'})});
const check=await request(`/wp-json/wp/v2/pages/${home.id}?context=edit`);
const live=rendered(check.content);
for(const release of releases){
  if(!live.includes(release.alt)) throw new Error(`Home did not persist reviewed release image alt text: ${release.title}`);
}
console.log(JSON.stringify({ok:true,apply,pageId:home.id,releases:chosen},null,2));
