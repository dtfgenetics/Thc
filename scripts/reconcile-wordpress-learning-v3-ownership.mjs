import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_LEARNING_V3_OWNERSHIP||'').toLowerCase()==='true';
const mode=String(process.env.LEARNING_V3_OWNERSHIP_MODE||'reconcile').toLowerCase();
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-learning-v3';
const topicPath=process.env.TOPIC_LITERATURE_PATH||'site/wordpress/education/topic-literature.json';
if(!['reconcile','verify'].includes(mode)) throw new Error(`Unsupported LEARNING_V3_OWNERSHIP_MODE: ${mode}`);
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Learning-V3-Ownership/1.0'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rendered=value=>typeof value==='string'?value:(value?.raw||value?.rendered||'');
const normalizePath=value=>{
  const path=new URL(value||'/',siteUrl).pathname.replace(/\/{2,}/g,'/');
  return path==='/'?'/':`${path.replace(/\/$/,'')}/`;
};

await mkdir(backupRoot,{recursive:true});
const source=JSON.parse(await readFile(topicPath,'utf8'));
if(!Array.isArray(source?.topics)||!source.topics.length) throw new Error(`Learning topic literature is empty: ${topicPath}`);

async function request(path,options={}){
  const method=String(options.method||'GET').toUpperCase();
  const retryUnsafe=options.retryUnsafe!==false;
  let lastError;
  for(let attempt=1;attempt<=5;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{
        ...options,
        headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
        redirect:'follow',
        signal:AbortSignal.timeout(45_000)
      });
      const text=await response.text();
      let body=text;
      try{body=text?JSON.parse(text):null}catch{}
      const transient=[408,425,429].includes(response.status)||response.status>=500;
      if(transient&&attempt<5&&(method==='GET'||retryUnsafe)){
        await sleep(Math.min(8000,1200*attempt));
        continue;
      }
      if(!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,700):JSON.stringify(body).slice(0,700)}`);
      return body;
    }catch(error){
      lastError=error;
      if(attempt<5&&(method==='GET'||retryUnsafe)){
        await sleep(Math.min(8000,1200*attempt));
        continue;
      }
      break;
    }
  }
  throw lastError;
}

async function pagesBySlug(slug){
  const body=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  return Array.isArray(body)?body:[];
}

async function pageById(id){
  return request(`/wp-json/wp/v2/pages/${encodeURIComponent(id)}?context=edit`);
}

async function createPage(slug,title,parent){
  if(!apply) throw new Error(`Missing published page ${slug}; APPLY_LEARNING_V3_OWNERSHIP is not true`);
  try{
    return await request('/wp-json/wp/v2/pages',{
      method:'POST',
      retryUnsafe:false,
      body:JSON.stringify({slug,title,parent,status:'publish',content:''})
    });
  }catch(error){
    const recovered=await pagesBySlug(slug);
    if(recovered.length===1) return recovered[0];
    throw new Error(`Create ${slug} was ambiguous and could not be recovered safely: ${error.message}`);
  }
}

async function saveBefore(page,label){
  if(!page?.id) return;
  await writeFile(join(backupRoot,`ownership-${label}-${page.id}-before.json`),`${JSON.stringify(page,null,2)}\n`);
}

async function updatePage(page,payload,label){
  await saveBefore(page,label);
  if(!apply) throw new Error(`${label} requires reconciliation but APPLY_LEARNING_V3_OWNERSHIP is not true`);
  return request(`/wp-json/wp/v2/pages/${encodeURIComponent(page.id)}`,{
    method:'POST',
    body:JSON.stringify(payload)
  });
}

function routeSlug(route){
  return normalizePath(route).split('/').filter(Boolean).pop()||'';
}

async function requireSinglePublishedSlug(slug,label){
  const candidates=await pagesBySlug(slug);
  if(candidates.length!==1){
    const details=candidates.map(page=>({id:page.id,parent:page.parent,link:page.link,status:page.status}));
    throw new Error(`${label} must have exactly one published WordPress owner for slug ${slug}; found ${candidates.length}: ${JSON.stringify(details)}`);
  }
  return candidates[0];
}

const results=[];
let learnCandidates=await pagesBySlug('learn');
let learn;
if(learnCandidates.length===0){
  learn=await createPage('learn','Teaching Healthy Cultivation',0);
}else if(learnCandidates.length===1){
  learn=learnCandidates[0];
}else{
  const exact=learnCandidates.filter(page=>normalizePath(page.link)==='/learn/');
  if(exact.length!==1) throw new Error(`Learn root has ambiguous published ownership: ${JSON.stringify(learnCandidates.map(page=>({id:page.id,parent:page.parent,link:page.link})))}`);
  throw new Error(`Learn root has duplicate published slug owners even though page ${exact[0].id} owns /learn/; refusing nondeterministic V3 lookup.`);
}

if(mode==='reconcile'&&(Number(learn.parent)!==0||learn.slug!=='learn'||learn.status!=='publish')){
  learn=await updatePage(learn,{parent:0,slug:'learn',status:'publish'},'learn');
}
learn=await requireSinglePublishedSlug('learn','Learn root');
learn=await pageById(learn.id);
if(Number(learn.parent)!==0) throw new Error(`Learn root ${learn.id} still has parent ${learn.parent}`);
if(normalizePath(learn.link)!=='/learn/') throw new Error(`Learn root ${learn.id} permalink is ${learn.link}, expected ${siteUrl}/learn/`);
if(mode==='verify'&&!rendered(learn.content).includes('data-dtf-layout="learn-v3"')) throw new Error(`Learn root ${learn.id} is missing stored learn-v3 marker`);
results.push({kind:'learn',id:learn.id,slug:'learn',parent:learn.parent,route:'/learn/',storedMarker:mode==='verify'});

for(const topic of source.topics){
  const route=normalizePath(topic.route||'');
  const slug=routeSlug(route);
  if(!slug) throw new Error(`Topic ${topic.id} has no usable route`);
  let candidates=await pagesBySlug(slug);
  let page;
  if(candidates.length===0){
    page=await createPage(slug,topic.title||topic.id,learn.id);
  }else if(candidates.length===1){
    page=candidates[0];
  }else{
    const exact=candidates.filter(candidate=>normalizePath(candidate.link)===route);
    const details=candidates.map(candidate=>({id:candidate.id,parent:candidate.parent,link:candidate.link,status:candidate.status}));
    if(exact.length===1) throw new Error(`${topic.id} has duplicate published slug owners; page ${exact[0].id} owns ${route}, but V3 lookup would remain nondeterministic: ${JSON.stringify(details)}`);
    throw new Error(`${topic.id} has ambiguous published slug owners for ${slug}: ${JSON.stringify(details)}`);
  }

  if(mode==='reconcile'&&(Number(page.parent)!==Number(learn.id)||page.slug!==slug||page.status!=='publish')){
    page=await updatePage(page,{parent:learn.id,slug,status:'publish'},topic.id);
  }

  page=await requireSinglePublishedSlug(slug,topic.id);
  page=await pageById(page.id);
  if(Number(page.parent)!==Number(learn.id)) throw new Error(`${topic.id} page ${page.id} parent is ${page.parent}; expected Learn ${learn.id}`);
  if(page.slug!==slug) throw new Error(`${topic.id} page ${page.id} slug is ${page.slug}; expected ${slug}`);
  if(normalizePath(page.link)!==route) throw new Error(`${topic.id} page ${page.id} permalink is ${page.link}; expected ${siteUrl}${route}`);
  const marker=`data-dtf-topic="${topic.id}"`;
  if(mode==='verify'&&!rendered(page.content).includes(marker)) throw new Error(`${topic.id} page ${page.id} is missing stored marker ${marker}`);
  results.push({kind:'topic',topicId:topic.id,id:page.id,slug,parent:page.parent,route,storedMarker:mode==='verify'});
}

const report={generatedAt:new Date().toISOString(),siteUrl,mode,apply,topicPath,learnPageId:learn.id,topicCount:source.topics.length,results};
const reportPath=join(backupRoot,`learning-v3-ownership-${mode}.json`);
await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
