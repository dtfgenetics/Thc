import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_V4_GENETICS_FINALIZE||'').toLowerCase()==='true';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=10;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Genetics-Library-Finalizer/2.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
      if((response.status===429||response.status>=500)&&attempt<10){await sleep(Math.min(12000,attempt*1800));continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<10){await sleep(Math.min(12000,attempt*1800));continue}}
  }
  throw last;
}
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const rows=await request('/wp-json/wp/v2/pages?slug=seeds&context=edit&per_page=10');
if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected exactly one Genetics page; found ${Array.isArray(rows)?rows.length:'invalid'}.`);
const page=rows[0];
let content=rendered(page.content);
const currentLibrary=content.includes('DTF Genetics library')&&content.includes('From breeding notes to current releases.');
const legacyV4=content.includes('dtf-genetics-visual-v4');
if(!currentLibrary&&!legacyV4) throw new Error('Genetics page is neither the current library nor the known V4 presentation; refusing to write.');
if(!/<h1\b/i.test(content)) throw new Error('Genetics has no designed H1; refusing to hide the theme title.');
const styleId='dtf-genetics-library-title-suppression';
const style=`<style id="${styleId}">\nbody.page h1.entry-title,body.page .entry-header>h1.entry-title,body.page .page-header>h1.page-title,body.page h1.wp-block-post-title,body.page .wp-site-blocks>main>h1.wp-block-post-title,body.page main>.wp-block-group:first-child>h1.wp-block-post-title{display:none!important}\nbody.page .entry-header:has(>h1.entry-title:only-child){margin:0!important;padding:0!important;min-height:0!important}\n</style>`;
for(const oldId of [styleId,'dtf-v4-genetics-theme-title-suppression','dtf-premium-theme-title-suppression']){
  const re=new RegExp(`<style\\s+id=["']${oldId}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'ig');
  content=content.replace(re,'').trim();
}
const growDocMatches=[...content.matchAll(/href="\/tools\/"([^>]*)>Document your grow<\/a>/gi)];
if(growDocMatches.length>1) throw new Error(`Expected at most one Document your grow CTA; found ${growDocMatches.length}.`);
if(growDocMatches.length===1) content=content.replace(/href="\/tools\/"([^>]*)>Document your grow<\/a>/i,'href="/growlens/"$1>Document your grow</a>');
const next=`${content}\n${style}`;
if(apply) await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
const check=await request(`/wp-json/wp/v2/pages/${page.id}?context=edit`);
const live=rendered(check.content);
if(apply&&!live.includes(styleId)) throw new Error('Genetics title suppression did not persist.');
if(currentLibrary&&(!live.includes('DTF Genetics library')||!live.includes('From breeding notes to current releases.'))) throw new Error('Current genetics library content changed unexpectedly.');
if(legacyV4&&!live.includes('dtf-genetics-visual-v4')) throw new Error('Legacy V4 marker changed unexpectedly.');
if(/Document your grow<\/a>/i.test(live)&&!/href="\/growlens\/"[^>]*>Document your grow<\/a>/i.test(live)) throw new Error('Document your grow does not point directly to GrowLens.');
console.log(JSON.stringify({ok:true,pageId:page.id,apply,styleId,presentation:currentLibrary?'current-library':'legacy-v4',growLensRedirected:growDocMatches.length===1},null,2));
