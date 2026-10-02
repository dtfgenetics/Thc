#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const RUNINFO_ENDPOINT='https://trace.ncbi.nlm.nih.gov/Traces/sra/sra.cgi';

export function buildRunInfoUrl(query) {
  if (!query || !String(query).trim()) throw new Error('RunInfo query is required');
  const url=new URL(RUNINFO_ENDPOINT);
  url.searchParams.set('save','efetch');
  url.searchParams.set('db','sra');
  url.searchParams.set('rettype','runinfo');
  url.searchParams.set('term',String(query).trim());
  return url.toString();
}

export function validateRunInfoCsv(text) {
  const firstLine=String(text||'').split(/\r?\n/,1)[0];
  if (!firstLine) throw new Error('NCBI RunInfo response is empty');
  const headers=firstLine.split(',').map(x=>x.replace(/^"|"$/g,'').trim());
  const required=['Run'];
  for (const name of required) {
    if (!headers.includes(name)) throw new Error(`NCBI RunInfo response missing required column: ${name}`);
  }
  const identityAny=['BioProject','BioSample','Experiment','Sample','SRAStudy'];
  if (!identityAny.some(name=>headers.includes(name))) {
    throw new Error('NCBI RunInfo response does not expose any expected project/sample identity columns');
  }
  return headers;
}

export async function fetchRunInfo(query,{output,force=false}={}) {
  const url=buildRunInfoUrl(query);
  const response=await fetch(url,{
    headers:{
      'Accept':'text/csv,text/plain;q=0.9,*/*;q=0.1',
      'User-Agent':'DTF-Genetics-Research-Ingestion/1.0 (+https://dtfseeds.com)'
    },
    redirect:'follow'
  });
  if (!response.ok) throw new Error(`NCBI RunInfo request failed: HTTP ${response.status}`);
  const text=await response.text();
  const headers=validateRunInfoCsv(text);
  if (output) {
    const full=path.resolve(output);
    if (fs.existsSync(full) && !force) throw new Error(`Refusing to overwrite existing file without --force: ${full}`);
    fs.mkdirSync(path.dirname(full),{recursive:true});
    fs.writeFileSync(full,text);
  }
  return {url,headers,row_count:Math.max(0,text.split(/\r?\n/).filter(Boolean).length-1),text};
}

function selfTest(){
  const url=buildRunInfoUrl('PRJNA1206134');
  const parsed=new URL(url);
  const errors=[];
  if(parsed.protocol!=='https:') errors.push('RunInfo endpoint must use HTTPS');
  if(parsed.searchParams.get('save')!=='efetch') errors.push('missing save=efetch');
  if(parsed.searchParams.get('db')!=='sra') errors.push('missing db=sra');
  if(parsed.searchParams.get('rettype')!=='runinfo') errors.push('missing rettype=runinfo');
  if(parsed.searchParams.get('term')!=='PRJNA1206134') errors.push('query encoding failed');
  const headers=validateRunInfoCsv('Run,BioProject,BioSample,Experiment,Sample,SRAStudy\nSRR1,PRJNA1,SAMN1,SRX1,SRS1,SRP1\n');
  if(!headers.includes('Run')||!headers.includes('BioSample')) errors.push('RunInfo CSV validation failed');
  let rejected=false;
  try{validateRunInfoCsv('<html>error</html>');}catch{rejected=true;}
  if(!rejected) errors.push('non-RunInfo payload was not rejected');
  if(errors.length){console.error(errors.join('\n'));process.exit(1);}
  console.log('NCBI RunInfo fetcher self-test passed.');
}

const args=process.argv.slice(2);
if(args.includes('--self-test')) selfTest();
else{
  const query=args.find(a=>!a.startsWith('--'));
  const outputIndex=args.indexOf('--output');
  const output=outputIndex>=0?args[outputIndex+1]:null;
  const force=args.includes('--force');
  if(!query||!output){
    console.error('Usage: node scripts/fetch-ncbi-sra-runinfo.mjs <query> --output <runinfo.csv> [--force]');
    process.exit(2);
  }
  const result=await fetchRunInfo(query,{output,force});
  console.log(JSON.stringify({query,url:result.url,output:path.resolve(output),rows:result.row_count,headers:result.headers},null,2));
}
