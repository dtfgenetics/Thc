import { readFile } from 'node:fs/promises';
import process from 'node:process';
const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const config=JSON.parse(await readFile(process.env.TECH1_PUBLIC_COURSES_PATH||'site/wordpress/education/tech1-courses-public-v1.json','utf8'));
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const must=(v,m)=>{if(!v)throw new Error(m)};
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
must(auth,'WordPress credentials required for verification.');
async function wp(endpoint){const r=await fetch(`${site}/wp-json/wp/v2/${endpoint.replace(/^\//,'')}`,{headers:{Authorization:auth},signal:AbortSignal.timeout(30000)});const t=await r.text();if(!r.ok)throw new Error(`${endpoint} returned ${r.status}: ${t.slice(0,400)}`);return t?JSON.parse(t):null}
async function find(slug,parent=null){const pq=parent===null?'':`&parent=${parent}`;const rows=await wp(`pages?slug=${encodeURIComponent(slug)}${pq}&context=edit&per_page=100`);return rows[0]||null}
const program=await find(config.program.slug,null);must(program&&program.status==='publish','Technician I program parent is not published.');
const verified=[];
for(const entry of config.courses){
  const root=await find(entry.slug,program.id);must(root,`${entry.id}: course root missing.`);must(root.status==='publish',`${entry.id}: root is not publish status.`);const rootHtml=rendered(root.content);must(rootHtml.includes('dtf-tech1-public-courses-v1'),`${entry.id}: public UI marker missing.`);
  for(let i=1;i<=4;i++){const lesson=await find(`lesson-${String(i).padStart(2,'0')}`,root.id);must(lesson&&lesson.status==='publish',`${entry.id}: lesson ${i} missing or not published.`);must(rendered(lesson.content).includes('dtf-tech1-public-courses-v1'),`${entry.id}: lesson ${i} UI marker missing.`)}
  const knowledge=entry.number===7?'readiness-check':'knowledge-check';const k=await find(knowledge,root.id);must(k&&k.status==='publish',`${entry.id}: ${knowledge} missing.`);
  if(entry.number<7){const final=await find('course-assessment',root.id);must(final&&final.status==='publish',`${entry.id}: course assessment missing.`)}
  let publicOk=false;
  for(let attempt=1;attempt<=6;attempt++){
    const nonce=`${Date.now()}-${entry.number}-${attempt}`;
    const r=await fetch(`${site}${config.program.route}${entry.slug}/?verify=${nonce}`,{headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(30000)});
    const html=await r.text();
    if(r.ok&&html.includes('dtf-tech1-public-courses-v1')&&html.includes(`Course ${entry.number}`)){publicOk=true;break}
    await sleep(3000);
  }
  must(publicOk,`${entry.id}: anonymous visitor-facing course root did not become readable.`);
  verified.push({courseId:entry.id,route:`${config.program.route}${entry.slug}/`,rootPageId:root.id,lessons:4,anonymousPublic:true});
}
console.log(JSON.stringify({result:'success',verified},null,2));
