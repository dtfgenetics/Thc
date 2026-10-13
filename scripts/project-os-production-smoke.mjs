import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const PUBLIC_ROUTES=Object.freeze([
  {path:'/',marker:'DTF Genetics'},
  {path:'/learn/',marker:'Teaching Healthy Cultivation'},
  {path:'/tools/',marker:'GrowLens'},
  {path:'/games/',marker:'Game'}
]);
export async function probePublicRoutes({base='https://dtfseeds.com',routes=PUBLIC_ROUTES,fetchImpl=fetch,now=()=>new Date().toISOString()}={}) {
  const origin=new URL(base);
  if(origin.protocol!=='https:' || origin.hostname!=='dtfseeds.com' || origin.pathname!=='/' || origin.search || origin.hash) throw Error('Unsupported production origin');
  const results=[];
  for(const route of routes){
    if(typeof route.path!=='string'||!/^\/[a-z0-9/-]*\/$/.test(route.path)||typeof route.marker!=='string'||!route.marker)throw Error('Invalid smoke route');
    const url=new URL(route.path,origin);
    try{
      const response=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html','User-Agent':'DTF-ProjectOS-Smoke/1.0'}});
      const contentType=response.headers.get('content-type')||'';
      const html=response.ok&&contentType.includes('text/html')?(await response.text()).slice(0,1024*1024):'';
      const pass=response.status===200&&contentType.includes('text/html')&&html.toLowerCase().includes(route.marker.toLowerCase());
      results.push({route:route.path,url:url.href,status:response.status,pass,reason:pass?null:'unexpected status, content-type, or missing expected page content'});
    }catch(error){results.push({route:route.path,url:url.href,status:null,pass:false,reason:error?.name==='TimeoutError'?'timeout':'request failure'});}
  }
  return {schemaVersion:1,checkedAt:now(),origin:origin.href,scope:'public HTTP and content smoke only; no source SHA, browser UX, or release attestation',total:results.length,passing:results.filter(x=>x.pass).length,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const report=await probePublicRoutes();
  const dest=process.env.PROJECT_OS_PRODUCTION_SMOKE_REPORT||'.artifacts/project-os/production-smoke.json';
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({total:report.total,passing:report.passing,results:report.results},null,2));
  if(report.passing!==report.total) process.exitCode=1;
}
