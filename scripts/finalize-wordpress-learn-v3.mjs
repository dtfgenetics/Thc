import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_V3_LEARN_FINALIZE||'').toLowerCase()==='true';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-V3-Learn-Finalizer/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
      if((response.status===429||response.status>=500)&&attempt<6){await sleep(attempt*1500);continue}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<6){await sleep(attempt*1500);continue}}
  }
  throw last;
}
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const rows=await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected exactly one Learn page; found ${Array.isArray(rows)?rows.length:'invalid'}.`);
const page=rows[0];
let content=rendered(page.content);
if(!content.includes('dtf-visual-polish-v3')) throw new Error('Learn is not currently owned by the V3 visual layer; refusing to write.');
if(!/<h1\b/i.test(content)) throw new Error('Learn has no designed H1; refusing to hide the theme title.');
const styleId='dtf-v3-learn-theme-title-suppression';
const style=`<style id="${styleId}">\nbody.page h1.entry-title,body.page .entry-header>h1.entry-title,body.page .page-header>h1.page-title,body.page h1.wp-block-post-title,body.page .wp-site-blocks>main>h1.wp-block-post-title,body.page main>.wp-block-group:first-child>h1.wp-block-post-title{display:none!important}\nbody.page .entry-header:has(>h1.entry-title:only-child){margin:0!important;padding:0!important;min-height:0!important}\n</style>`;
const re=new RegExp(`<style\\s+id=["']${styleId}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'i');
content=content.replace(re,'').trim();
const next=`${content}\n${style}`;
if(apply) await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:next,status:'publish'})});
const check=await request(`/wp-json/wp/v2/pages/${page.id}?context=edit`);
const live=rendered(check.content);
if(apply&&!live.includes(styleId)) throw new Error('Learn title suppression did not persist.');
if(!live.includes('dtf-visual-polish-v3')) throw new Error('V3 Learn marker was lost.');
console.log(JSON.stringify({ok:true,pageId:page.id,apply,styleId},null,2));
