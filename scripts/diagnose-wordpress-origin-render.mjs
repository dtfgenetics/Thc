const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass) throw new Error('WordPress credentials required');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchText(url,headers={}){
  let last;
  for(let i=1;i<=6;i++){
    try{
      const r=await fetch(url,{headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache',...headers},redirect:'follow'});
      const text=await r.text();
      if(r.status<500||i===6) return {status:r.status,url:r.url,text};
      last=new Error(`HTTP ${r.status}`);
    }catch(e){last=e;if(i===6)throw e}
    await sleep(i*i*800);
  }
  throw last;
}

async function getJson(path){
  const r=await fetchText(`${site}${path}`,{Authorization:auth,Accept:'application/json'});
  let body; try{body=JSON.parse(r.text)}catch{throw new Error(`Invalid JSON from ${path}: ${r.text.slice(0,300)}`)}
  if(r.status<200||r.status>=300) throw new Error(`${path} failed ${r.status}: ${r.text.slice(0,400)}`);
  return body;
}

const markers={
  currentHome:'Genetics. Plant science. Tools. Games. Community.',
  oldHome:'THC Grow Doc, genetics, cultivation education, and games in one home.',
  currentLearn:'Explore by subject',
  oldLearn:'Grow education belongs in a clean, readable library.',
};
const markerFlags=text=>Object.fromEntries(Object.entries(markers).map(([k,v])=>[k,String(text).toLowerCase().includes(v.toLowerCase())]));

const cache=`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const publicPaths=['/index.php','/index.php?page_id=743','/home/?dtf_origin='+cache];
const renders=[];
for(const path of publicPaths){
  const sep=path.includes('?')?'&':'?';
  const r=await fetchText(`${site}${path}${sep}dtf_origin=${cache}`);
  renders.push({path,status:r.status,finalUrl:r.url.replace(site,''),length:r.text.length,markers:markerFlags(r.text),wpMediaRefs:(r.text.match(/\/wp-content\/uploads\//g)||[]).length,title:(r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||null});
}

const templates=await getJson('/wp-json/wp/v2/templates?context=edit&per_page=100');
const candidateTemplates=(Array.isArray(templates)?templates:[]).filter(t=>['front-page','home','index','page'].includes(String(t.slug||'')) || /front|home|index/i.test(String(t.title?.rendered||t.title?.raw||''))).map(t=>{
  const content=String(t.content?.raw||t.content?.rendered||'');
  return {
    id:t.id,
    theme:t.theme,
    slug:t.slug,
    status:t.status,
    source:t.source,
    origin:t.origin,
    contentLength:content.length,
    hasPostContent:/wp:post-content/i.test(content),
    hasQuery:/wp:query/i.test(content),
    hasTemplatePart:/wp:template-part/i.test(content),
    markers:markerFlags(content),
    preview:content.slice(0,700).replace(/\s+/g,' '),
  };
});

const pages=await getJson('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10');
const home=Array.isArray(pages)?pages[0]:null;
const rawHome=String(home?.content?.raw||home?.content?.rendered||'');

console.log(JSON.stringify({generatedAt:new Date().toISOString(),renders,home:{id:home?.id||null,status:home?.status||null,contentLength:rawHome.length,markers:markerFlags(rawHome)},templates:candidateTemplates}));
