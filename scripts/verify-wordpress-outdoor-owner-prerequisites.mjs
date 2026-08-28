import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');

async function request(path){
  let last;
  for(let attempt=1;attempt<=6;attempt++){
    try{
      const response=await fetch(`${site}${path}`,{
        headers:{Authorization:auth,Accept:'application/json','User-Agent':'THC-Outdoor-Owner-Prerequisites/1.0'},
        signal:AbortSignal.timeout(60000)
      });
      const text=await response.text();
      let body=text;
      try{body=text?JSON.parse(text):null}catch{}
      if((response.status===429||response.status>=500)&&attempt<6){await sleep(attempt*1200);continue}
      if(!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<6)await sleep(attempt*1200)}
  }
  throw last;
}

async function page(slug){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=20`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected exactly one WordPress page for ${slug}; found ${Array.isArray(rows)?rows.length:'invalid response'}`);
  return rows[0];
}

const specs=[
  {slug:'learn',required:['data-dtf-layout="learn-v3"']},
  {slug:'harvest-postharvest',required:['data-dtf-topic="harvest-postharvest"']},
  {slug:'outdoor',required:['data-dtf-topic="outdoor-cultivation"']}
];
const results=[];
for(const spec of specs){
  const item=await page(spec.slug);
  const content=rendered(item.content);
  for(const marker of spec.required){
    if(!content.includes(marker)) throw new Error(`${spec.slug}: missing required WordPress ownership marker ${marker}`);
  }
  if(spec.slug==='outdoor'){
    const lower=content.toLowerCase();
    const forbidden=[
      'mystery_line_f1_regular_dtf_strain_card',
      'mystery line f1 regular dtf strain card',
      'rainbow_bubblegum_f1_regular_dtf_strain_card',
      'rainbow bubblegum f1 regular dtf strain card'
    ];
    for(const phrase of forbidden) if(lower.includes(phrase)) throw new Error(`outdoor: stale genetics visual reference remains: ${phrase}`);
  }
  results.push({slug:spec.slug,pageId:item.id,status:item.status,markers:spec.required});
}

console.log(JSON.stringify({valid:true,scope:'outdoor-owner-prerequisites',results},null,2));
