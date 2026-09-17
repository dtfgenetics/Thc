import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const routes=(process.env.HEADER_V6_ROUTES||'/,/seeds/,/learn/,/courses/,/tools/,/games/,/community/,/shop/,/gallery/,/about/,/contact/,/learn/start-here/,/learn/infographics/').split(',').map(v=>v.trim()).filter(Boolean);
const expected=[
  ['/','Home'],
  ['/seeds/','Seeds'],
  ['/learn/','Learn'],
  ['/courses/','Courses'],
  ['/tools/','Diagnostic'],
  ['/games/','Games'],
  ['/community/','Community'],
  ['/shop/','Shop'],
];
const forbiddenLabels=new Set(['Genetics','Tools']);
const concurrency=Math.max(1,Math.min(10,Number(process.env.HEADER_AUDIT_CONCURRENCY||5)));

function normalizeHref(value=''){
  try{
    const url=new URL(value,siteUrl);
    if(url.origin!==new URL(siteUrl).origin) return value;
    return url.pathname==='/'?'/':(url.pathname.endsWith('/')?url.pathname:`${url.pathname}/`);
  }catch{return value;}
}

function decodeText(value=''){
  return String(value).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#0*39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}

function inspect(html,route){
  const match=html.match(/<header\b[^>]*data-dtf-shell=["']header-v6["'][^>]*>[\s\S]*?<\/header>/i);
  if(!match) throw new Error(`${route}: canonical header-v6 not found`);
  const header=match[0];
  if(!/data-dtf-sitewide-header=["']canonical-eight-v1["']/i.test(header)) throw new Error(`${route}: canonical-eight-v1 marker missing`);
  const navMatch=header.match(/<nav\b[^>]*id=["']dtf-global-primary-nav["'][^>]*>([\s\S]*?)<\/nav>/i);
  if(!navMatch) throw new Error(`${route}: primary navigation not found`);
  const anchors=[...navMatch[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m)=>{
    const href=m[1].match(/href=["']([^"']+)["']/i)?.[1]||'';
    return {href:normalizeHref(href),label:decodeText(m[2])};
  });
  if(anchors.length!==expected.length) throw new Error(`${route}: expected ${expected.length} primary links, found ${anchors.length}: ${JSON.stringify(anchors)}`);
  for(let i=0;i<expected.length;i+=1){
    const [href,label]=expected[i];
    if(anchors[i].href!==href||anchors[i].label!==label) throw new Error(`${route}: nav item ${i+1} expected ${label} ${href}, saw ${anchors[i].label} ${anchors[i].href}`);
  }
  for(const item of anchors){
    if(forbiddenLabels.has(item.label)) throw new Error(`${route}: obsolete primary label remains: ${item.label}`);
  }
  for(const utility of ['Search DTF Genetics','Account','Cart']){
    if(!header.includes(`aria-label="${utility}"`)&&!header.includes(`aria-label='${utility}'`)) throw new Error(`${route}: missing utility control ${utility}`);
  }
  return anchors;
}

async function verifyRoute(route){
  let lastError;
  for(let attempt=1;attempt<=5;attempt+=1){
    try{
      const joiner=route.includes('?')?'&':'?';
      const response=await fetch(`${siteUrl}${route}${joiner}dtf_header_v6_audit=${Date.now()}-${attempt}`,{
        headers:{'Cache-Control':'no-cache, no-store, max-age=0',Pragma:'no-cache','User-Agent':'DTFSeeds-Header-V6-Audit/1.1'},
        redirect:'follow',
        signal:AbortSignal.timeout(45_000),
      });
      if(!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
      const html=await response.text();
      inspect(html,route);
      return {route,status:response.status,bytes:Buffer.byteLength(html)};
    }catch(error){
      lastError=error;
      if(attempt<5) await new Promise(r=>setTimeout(r,1500*attempt));
    }
  }
  throw lastError;
}

const queue=[...routes];
const results=[];
const failures=[];
async function worker(){
  while(queue.length){
    const route=queue.shift();
    try{results.push(await verifyRoute(route));}
    catch(error){failures.push({route,error:error?.message||String(error)});}
  }
}
await Promise.all(Array.from({length:Math.min(concurrency,routes.length)},()=>worker()));
results.sort((a,b)=>a.route.localeCompare(b.route));
failures.sort((a,b)=>a.route.localeCompare(b.route));
const report={generatedAt:new Date().toISOString(),siteUrl,header:'v6',canonicalNav:expected.map(([,label])=>label),checked:routes.length,passed:results.length,failed:failures.length,results,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exitCode=1;
