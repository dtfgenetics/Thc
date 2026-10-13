import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const PUBLIC_ROUTES=Object.freeze([
  {path:'/',marker:'Genetics first.'},
  {path:'/learn/',marker:'Learn the plant as one connected system.'},
  {path:'/tools/',marker:'Grow with records.'},
  {path:'/games/',marker:'Pick what is playable.'}
]);
export async function probePublicRoutes({expectedDeploymentSha=null,base='https://dtfseeds.com',routes=PUBLIC_ROUTES,fetchImpl=fetch,now=()=>new Date().toISOString()}={}) {
  const shaPattern=/^[a-f0-9]{40}$/i;
  if(expectedDeploymentSha!==null&&!shaPattern.test(expectedDeploymentSha))throw Error('Invalid expected deployment SHA');
  const origin=new URL(base);
  if(origin.protocol!=='https:' || origin.hostname!=='dtfseeds.com' || origin.pathname!=='/' || origin.search || origin.hash) throw Error('Unsupported production origin');
  const results=[];
  for(const route of routes){
    if(typeof route.path!=='string'||!(route.path==='/' || /^\/[a-z0-9/-]+\/$/.test(route.path))||typeof route.marker!=='string'||!route.marker)throw Error('Invalid smoke route');
    const url=new URL(route.path,origin);
    try{
      const response=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html','User-Agent':'DTF-ProjectOS-Smoke/1.0'}});
      const contentType=response.headers.get('content-type')||'';
      const deploymentHeader=response.headers.get('x-dtf-deployment-sha');
      const observedDeploymentSha=shaPattern.test(deploymentHeader||'')?deploymentHeader.toLowerCase():null;
      const deploymentIdentity=observedDeploymentSha===null?'absent':expectedDeploymentSha===null?'observed-not-compared':observedDeploymentSha===expectedDeploymentSha.toLowerCase()?'header-matches-expected':'header-mismatch';
      const html=response.ok&&contentType.includes('text/html')?(await response.text()).slice(0,1024*1024):'';
      const heading=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        ?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||'';
      const pass=response.status===200&&contentType.includes('text/html')&&heading.toLowerCase().includes(route.marker.toLowerCase());
      results.push({route:route.path,url:url.href,status:response.status,observedDeploymentSha,deploymentIdentity,pass,reason:pass?null:'unexpected status, content-type, or missing route-specific h1'});
    }catch(error){results.push({route:route.path,url:url.href,status:null,observedDeploymentSha:null,deploymentIdentity:'unavailable',pass:false,reason:error?.name==='TimeoutError'?'timeout':('request failure'+(typeof error?.cause?.code==='string'&&/^[A-Z0-9_]+$/.test(error.cause.code)?': '+error.cause.code:''))});}
  }
  return {schemaVersion:1,checkedAt:now(),origin:origin.href,scope:'public HTTP and content smoke with optional unauthenticated deployment header observation; header agreement is not proof of artifact provenance, browser UX, or release attestation',expectedDeploymentSha,total:results.length,passing:results.filter(x=>x.pass).length,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const expectedDeploymentSha=process.env.PROJECT_OS_EXPECTED_DEPLOYMENT_SHA||null;
  const report=await probePublicRoutes({expectedDeploymentSha});
  const dest=process.env.PROJECT_OS_PRODUCTION_SMOKE_REPORT||'.artifacts/project-os/production-smoke.json';
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({total:report.total,passing:report.passing,results:report.results},null,2));
  if(report.passing!==report.total) process.exitCode=1;
}
