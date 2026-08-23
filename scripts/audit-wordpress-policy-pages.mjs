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
      const response=await fetch(`${siteUrl}${path}`,{headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Policy-Audit/1.1'},redirect:'follow',signal:AbortSignal.timeout(30_000)});
      const text=await response.text();
      let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,500)};}
      if((response.status>=500||response.status===429)&&attempt<5){await sleep(attempt*2000);continue;}
      return {status:response.status,ok:response.ok,body,headers:{total:response.headers.get('x-wp-total'),totalPages:response.headers.get('x-wp-totalpages')}};
    }catch(error){lastError=error;if(attempt<5){await sleep(attempt*2000);continue;}}
  }
  throw lastError;
}

const pages=[];
let reportedTotal=null;
let reportedTotalPages=null;
for(let pageNumber=1;pageNumber<=100;pageNumber++){
  const result=await request(`/wp-json/wp/v2/pages?context=edit&per_page=100&orderby=id&order=asc&page=${pageNumber}`);
  if(!result.ok){
    if(result.status===400&&result.body?.code==='rest_post_invalid_page_number') break;
    throw new Error(`Unable to list WordPress pages page ${pageNumber} (${result.status})`);
  }
  if(!Array.isArray(result.body)) throw new Error(`Unexpected WordPress pages response on page ${pageNumber}`);
  if(pageNumber===1){
    reportedTotal=Number(result.headers.total||0)||null;
    reportedTotalPages=Number(result.headers.totalPages||0)||null;
  }
  pages.push(...result.body);
  if(result.body.length<100) break;
  if(reportedTotalPages&&pageNumber>=reportedTotalPages) break;
}

const normalizedPages=pages.map(page=>({id:page.id,slug:page.slug,status:page.status,title:page.title?.raw||page.title?.rendered||'',link:page.link,parent:page.parent||0}));
const policyPattern=/(privacy|terms|condition|refund|return|shipping|delivery|replacement|policy|legal|support)/i;
const matchingPages=normalizedPages.filter(page=>policyPattern.test(`${page.slug} ${page.title}`));

const advanced=await request('/wp-json/wc/v3/settings/advanced',wcAuth);
const advancedSettings=advanced.ok&&Array.isArray(advanced.body)
  ? advanced.body.filter(setting=>/(page|privacy|terms|checkout|account|cart)/i.test(`${setting.id||''} ${setting.label||''} ${setting.desc||''}`)).map(setting=>({id:setting.id,label:setting.label,value:setting.value,default:setting.default,type:setting.type}))
  : {status:advanced.status,error:'WooCommerce advanced settings unavailable'};

const report={
  generatedAt:new Date().toISOString(),siteUrl,
  totalPagesFetched:normalizedPages.length,reportedTotal,reportedTotalPages,
  completePageInventory:reportedTotal?normalizedPages.length===reportedTotal:true,
  matchingPages,woocommerceAdvancedSettings:advancedSettings
};
await writeFile(join(outputRoot,'policy-pages-audit.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
