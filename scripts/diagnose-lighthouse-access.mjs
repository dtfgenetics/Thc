import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ALLOWED_HEADERS=['content-type','server','cf-mitigated','cf-ray','x-request-id','x-cache','x-served-by'];
const REQUESTS=[
  {name:'qa-agent',userAgent:'DTFSeeds-Web-QA/1.0'},
  {name:'chrome-ua-only',userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'}
];
export function publicHeaders(headers){
  const result={};
  for(const key of ALLOWED_HEADERS){
    const value=headers.get(key);
    if(value) result[key]=String(value).replace(/[^\x20-\x7e]/g,'').slice(0,160);
  }
  return result;
}
export async function collectAccessDiagnostics(target,fetchImpl=fetch){
  const result={schemaVersion:1,route:new URL(target).pathname,probes:[]};
  for(const item of REQUESTS){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetchImpl(target,{
        redirect:'manual',signal:controller.signal,
        headers:{'user-agent':item.userAgent,'accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'},
      });
      result.probes.push({
        client:item.name,status:response.status,redirected:response.status>=300&&response.status<400,
        headers:publicHeaders(response.headers)
      });
      await response.body?.cancel().catch(()=>{});
    }catch(error){
      result.probes.push({client:item.name,status:0,errorName:String(error?.name||'RequestError').slice(0,80)});
    }finally{clearTimeout(timeout);}
  }
  return result;
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  // Diagnostics are intentionally scoped to the known public origin; no arbitrary URL input.
  const target='https://dtfseeds.com/';
  const out=process.env.WEB_QA_ARTIFACT_DIR||'.artifacts/web-qa';
  const report=await collectAccessDiagnostics(target);
  await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'lighthouse-access.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Lighthouse access diagnostic (UA-only comparisons; not browser-fingerprint proof):');
  console.log(JSON.stringify(report,null,2));
  // This is diagnostic evidence only. The Lighthouse failure itself remains fatal.
}
