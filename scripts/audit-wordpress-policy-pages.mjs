import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const wpUsername=process.env.WP_API_USERNAME||'';
const wpPassword=process.env.WP_API_PASSWORD||'';
const consumerKey=process.env.WC_CONSUMER_KEY||'';
const consumerSecret=process.env.WC_CONSUMER_SECRET||'';
const outputRoot=process.env.POLICY_AUDIT_ROOT||'/tmp/dtf-policy-audit';
if(!wpUsername||!wpPassword) throw new Error('WordPress production credentials are required');
await mkdir(outputRoot,{recursive:true});
const wpAuth=`Basic ${Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')}`;
const wcAuth=consumerKey&&consumerSecret?`Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`:wpAuth;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(path,auth=wpAuth){
  let lastError;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const response=await fetch(`${siteUrl}${path}`,{headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Policy-Audit/1.0'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,500)};}
      if((response.status>=500||response.status===429)&&attempt<5){await sleep(attempt*2000);continue;}
      return {status:response.status,ok:response.ok,body};
    }catch(error){lastError=error;if(attempt<5){await sleep(attempt*2000);continue;}}
  }
  throw lastError;
}

const pagesResult=await request('/wp-json/wp/v2/pages?context=edit&per_page=100&orderby=id&order=asc');
if(!pagesResult.ok||!Array.isArray(pagesResult.body)) throw new Error(`Unable to list WordPress pages (${pagesResult.status})`);
const pages=pagesResult.body.map(page=>({id:page.id,slug:page.slug,status:page.status,title:page.title?.raw||page.title?.rendered||'',link:page.link,parent:page.parent||0}));
const policyPattern=/(privacy|terms|condition|refund|return|shipping|delivery|replacement|policy|legal|support)/i;
const matchingPages=pages.filter(page=>policyPattern.test(`${page.slug} ${page.title}`));

const advanced=await request('/wp-json/wc/v3/settings/advanced',wcAuth);
const advancedSettings=advanced.ok&&Array.isArray(advanced.body)
  ? advanced.body.filter(setting=>/(page|privacy|terms|checkout|account|cart)/i.test(`${setting.id||''} ${setting.label||''} ${setting.desc||''}`)).map(setting=>({id:setting.id,label:setting.label,value:setting.value,default:setting.default,type:setting.type}))
  : {status:advanced.status,error:'WooCommerce advanced settings unavailable'};

const report={generatedAt:new Date().toISOString(),siteUrl,totalPages:pages.length,matchingPages,woocommerceAdvancedSettings:advancedSettings};
await writeFile(join(outputRoot,'policy-pages-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
