import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Strain-Media-Audit/1.0'};
const targets=[
  {id:'berry-blue',terms:['Berry Blue','berry-blue','Berry_Blue']},
  {id:'berry-lemonade',terms:['Berry Lemonade','berry-lemonade','Berry_Lemonade']},
  {id:'zestberry',terms:['Zestberry','zestberry']},
  {id:'blue-bubblegum',terms:['Blue Bubblegum','Blueberry Bubblegum','blue-bubblegum','Blue_Bubblegum']},
  {id:'blue-cali-glue',terms:['Blue Cali Glue','blue-cali-glue','Blue_Cali_Glue']},
  {id:'blue-mango',terms:['Blue Mango','blue-mango','Blue_Mango']},
  {id:'blue-mango-bx1',terms:['Blue Mango BX1','blue-mango-bx1','Blue_Mango_BX1']},
  {id:'mango-bubbles',terms:['Mango Bubbles','Blue Mango F2 Blue Bubblegum','mango-bubbles','Mango_Bubbles']}
];

async function request(path){
  const response=await fetch(`${siteUrl}${path}`,{headers,redirect:'follow',signal:AbortSignal.timeout(30_000)});
  const text=await response.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1000)};}
  if(!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${body?.message||body?.raw||'unknown'}`);
  return body;
}
function text(value){
  if(typeof value==='string') return value;
  return value?.rendered||value?.raw||'';
}
function compact(item){
  const details=item?.media_details||{};
  return {
    id:item?.id||null,
    slug:item?.slug||'',
    title:text(item?.title),
    altText:item?.alt_text||'',
    caption:text(item?.caption),
    sourceUrl:item?.source_url||'',
    mimeType:item?.mime_type||'',
    width:details?.width||null,
    height:details?.height||null,
    modifiedGmt:item?.modified_gmt||null
  };
}

const all=[];
for(let page=1;page<=10;page+=1){
  const rows=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`).catch(error=>{
    if(/invalid_page_number|400/.test(error.message)) return [];
    throw error;
  });
  if(!Array.isArray(rows)||!rows.length) break;
  all.push(...rows);
  if(rows.length<100) break;
}

const report={generatedAt:new Date().toISOString(),siteUrl,mediaCount:all.length,targets:[]};
for(const target of targets){
  const terms=target.terms.map(x=>x.toLowerCase());
  const matches=all.filter(item=>{
    const hay=[item?.slug,text(item?.title),item?.alt_text,text(item?.caption),item?.source_url].join(' ').toLowerCase();
    return terms.some(term=>hay.includes(term));
  }).map(compact);
  report.targets.push({id:target.id,matchCount:matches.length,matches});
}

await writeFile('wordpress-strain-card-media-audit.json',`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(JSON.stringify(report,null,2));
