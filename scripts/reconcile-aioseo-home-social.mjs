import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_AIOSEO_HOME_SOCIAL||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/aioseo-home-social';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-AIOSEO-Home-Social/1.0'};
const stamp=new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
const backupDir=join(backupRoot,`home-social-${stamp}`);
await mkdir(backupDir,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,options={}){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{
        ...options,
        headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
        redirect:'follow',
        signal:AbortSignal.timeout(45_000)
      });
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
      if((response.status>=500||response.status===429)&&attempt<5){await sleep(attempt*2500);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){
      lastError=error;
      if(attempt<5){await sleep(attempt*2500);continue;}
    }
  }
  throw lastError||new Error(`Request failed: ${path}`);
}

async function getHomePage(){
  const rows=await request('/wp-json/wp/v2/pages?slug=home&context=edit&per_page=10');
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected one home page; saw ${Array.isArray(rows)?rows.length:'invalid response'}`);
  return rows[0];
}

async function getBrandMedia(){
  const rows=await request('/wp-json/wp/v2/media?slug=dtf-potleaf-site-icon&context=edit&per_page=10');
  if(!Array.isArray(rows)||!rows[0]?.id||!rows[0]?.source_url) throw new Error('DTF brand media dtf-potleaf-site-icon was not found');
  const media=rows[0];
  if(!/dtf-potleaf-512\.png(?:$|\?)/i.test(media.source_url)) throw new Error(`Unexpected DTF social media URL: ${media.source_url}`);
  return media;
}

async function getAioseo(postId){
  const body=await request(`/wp-json/aioseo/v1/post?postId=${postId}`);
  if(!body?.success||!body?.data?.currentPost) throw new Error('AIOSEO homepage response did not include currentPost');
  return body.data.currentPost;
}

const [home,brand]=await Promise.all([getHomePage(),getBrandMedia()]);
const homeId=Number(home.id);
const before=await getAioseo(homeId);
await writeFile(join(backupDir,'aioseo-home-before.json'),`${JSON.stringify(before,null,2)}\n`);
await writeFile(join(backupDir,'brand-media.json'),`${JSON.stringify({id:brand.id,slug:brand.slug,source_url:brand.source_url,width:brand?.media_details?.width||null,height:brand?.media_details?.height||null},null,2)}\n`);

const intended={
  og_image_type:'custom_image',
  og_image_custom_url:brand.source_url,
  twitter_use_og:true
};

let after=before;
let publicVerification={verified:false,ogTags:[]};
let rollbackAttempted=false;

if(apply){
  // AIOSEO 4.9.7.x uses full-save semantics. Round-trip the complete currentPost
  // payload so fields that are unrelated to social metadata retain their current values.
  const payload={...before,id:homeId,...intended};
  await request('/wp-json/aioseo/v1/post',{method:'POST',body:JSON.stringify(payload)});
  after=await getAioseo(homeId);

  const criticalKeys=[
    'canonicalUrl','default','noindex','nofollow','noarchive','notranslate','noimageindex','nosnippet','noodp',
    'maxSnippet','maxVideoPreview','maxImagePreview','pillar_content','frequency','priority','limit_modified_date'
  ];
  const changedCritical=criticalKeys.filter(key=>JSON.stringify(before?.[key]??null)!==JSON.stringify(after?.[key]??null));
  const socialOk=after.og_image_type==='custom_image'&&after.og_image_custom_url===brand.source_url&&after.twitter_use_og===true;

  if(!socialOk||changedCritical.length){
    rollbackAttempted=true;
    try{await request('/wp-json/aioseo/v1/post',{method:'POST',body:JSON.stringify({...before,id:homeId})});}catch{}
    throw new Error(`AIOSEO social reconciliation verification failed. socialOk=${socialOk}; changedCritical=${changedCritical.join(',')||'none'}; rollbackAttempted=true`);
  }

  for(let attempt=1;attempt<=10;attempt++){
    try{
      const response=await fetch(`${siteUrl}/?dtf_social_verify=${Date.now()}-${attempt}`,{
        headers:{Accept:'text/html','Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Social-Verify/1.0'},
        redirect:'follow',signal:AbortSignal.timeout(30_000)
      });
      const html=await response.text();
      const ogTags=[...html.matchAll(/<meta\b[^>]*property=["']og:image["'][^>]*>/gi)].map(match=>match[0]);
      publicVerification={status:response.status,verified:response.ok&&ogTags.some(tag=>/dtf-potleaf-512\.png/i.test(tag)),ogTags:ogTags.slice(0,5)};
      if(publicVerification.verified) break;
    }catch(error){publicVerification={verified:false,error:error instanceof Error?error.message:String(error),ogTags:[]};}
    await sleep(5000);
  }
  if(!publicVerification.verified) throw new Error(`AIOSEO state is correct but public homepage did not expose the DTF og:image after verification retries: ${JSON.stringify(publicVerification)}`);
}

await writeFile(join(backupDir,'aioseo-home-after.json'),`${JSON.stringify(after,null,2)}\n`);
const report={
  generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,homeId,
  brand:{id:brand.id,url:brand.source_url,width:brand?.media_details?.width||null,height:brand?.media_details?.height||null},
  before:{og_image_type:before.og_image_type??null,og_image_custom_url:before.og_image_custom_url??null,twitter_use_og:before.twitter_use_og??null},
  intended,
  after:{og_image_type:after.og_image_type??null,og_image_custom_url:after.og_image_custom_url??null,twitter_use_og:after.twitter_use_og??null},
  publicVerification,rollbackAttempted
};
await writeFile(join(backupDir,'aioseo-home-social-report.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
