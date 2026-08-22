import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-education-wave2';
if(!user||!pass) throw new Error('Missing WordPress API credentials.');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function api(endpoint,{method='GET',json}={}){
  let last;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const r=await fetch(`${site}/wp-json/wp/v2${endpoint}`,{
        method,
        headers:{Authorization:auth,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{})},
        body:json!==undefined?JSON.stringify(json):undefined,
      });
      const text=await r.text();
      let body=text; try{body=text?JSON.parse(text):null}catch{}
      if(!r.ok) throw new Error(`${method} ${endpoint} -> ${r.status}: ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(e){last=e;if(attempt<5)await sleep(attempt*1500)}
  }
  throw last;
}
async function find(slug,parent){const q=new URLSearchParams({slug,context:'edit',per_page:'100'});if(parent!==undefined)q.set('parent',String(parent));return (await api(`/pages?${q}`))[0]||null}
async function backup(label,obj){await mkdir(backupRoot,{recursive:true});await writeFile(path.join(backupRoot,`${label}.json`),JSON.stringify(obj,null,2))}

const learn=await find('learn');
if(!learn) throw new Error('Missing /learn/ parent.');
let old=await find('downloads',learn.id);
let records=await find('records',learn.id);
if(!old&&!records) throw new Error('Neither downloads nor records education page exists.');

if(old){
  await backup(`page-${old.id}-downloads-before-route-repair`,old);
  if(records){
    await backup(`page-${records.id}-records-before-route-repair`,records);
    records=await api(`/pages/${records.id}`,{method:'POST',json:{
      title:old.title?.raw||'Printable Grow Records & Worksheets',
      content:old.content?.raw||old.content?.rendered||'',
      status:'publish',parent:learn.id,slug:'records',comment_status:'closed',ping_status:'closed'
    }});
    await api(`/pages/${old.id}`,{method:'POST',json:{status:'trash'}});
  }else{
    records=await api(`/pages/${old.id}`,{method:'POST',json:{slug:'records',status:'publish',parent:learn.id}});
  }
}

const replacementFrom='/learn/downloads/';
const replacementTo='/learn/records/';
const ids=[869,980,981,982,983,984,985,986,987,988,989,990,991,992,993,994,995,996,998,999];
const updated=[];
for(const id of ids){
  let page;
  try{page=await api(`/pages/${id}?context=edit`)}catch{continue}
  const raw=page.content?.raw||page.content?.rendered||'';
  if(!raw.includes(replacementFrom)) continue;
  await backup(`page-${id}-before-record-link-repair`,page);
  const next=raw.split(replacementFrom).join(replacementTo);
  await api(`/pages/${id}`,{method:'POST',json:{content:next,status:'publish'}});
  updated.push(id);
}

const result={repairedAt:new Date().toISOString(),recordsPageId:records.id,recordsLink:records.link,updatedLinkPages:updated};
await backup('records-route-repair-result',result);
console.log(JSON.stringify(result,null,2));