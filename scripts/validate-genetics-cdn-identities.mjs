import {readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';

export function compareCdnIdentities(report,registry){
  const discrepancies=[];
  if(!Array.isArray(report?.rows)||!Array.isArray(registry?.cards)) return [{slug:'_schema',reason:'Missing source report rows or approved identity cards'}];
  const approved=new Map();
  for(const card of registry.cards){
    if(!card?.wordpressSlug||approved.has(card.wordpressSlug)){
      discrepancies.push({slug:String(card?.wordpressSlug||'_missing'),reason:'Invalid or duplicate approved identity'});
      continue;
    }
    approved.set(card.wordpressSlug,card);
  }
  const seen=new Set();
  for(const observed of report.rows){
    const slug=String(observed?.wordpressSlug||'_missing');
    if(seen.has(slug)){discrepancies.push({slug,reason:'Duplicate observed card'});continue;}
    seen.add(slug);
    const expected=approved.get(slug);
    if(!expected){discrepancies.push({slug,reason:'Card missing from approved identities'});continue;}
    const changed=[];
    for(const key of ['cdnByteLength','cdnSha256','mimeType','width','height']){
      if(observed[key]!==expected[key]) changed.push(key);
    }
    if(changed.length) discrepancies.push({slug,reason:'CDN rendition differs from approved identity',changed,
      approvedBytes:expected.cdnByteLength,observedBytes:observed.cdnByteLength,
      approvedSha256:expected.cdnSha256,observedSha256:observed.cdnSha256});
  }
  for(const slug of approved.keys()) if(!seen.has(slug)) discrepancies.push({slug,reason:'Approved card absent from observed source audit'});
  return discrepancies;
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  const observedPath=process.env.GENETICS_CDN_REPORT||'genetics-cdn-source-report.json';
  const approvedPath=process.env.GENETICS_CDN_IDENTITIES||'site/wordpress/products/genetics-cdn-identities.json';
  const outPath=process.env.GENETICS_CDN_DRIFT_REPORT||'genetics-cdn-drift-report.json';
  const [observed,approved]=await Promise.all([readFile(observedPath,'utf8'),readFile(approvedPath,'utf8')]);
  const source=JSON.parse(observed),identity=JSON.parse(approved);
  const discrepancies=compareCdnIdentities(source,identity);
  const result={schemaVersion:1,sourceReport:observedPath,approvedRegistry:approvedPath,checked:source.rows?.length||0,discrepancyCount:discrepancies.length,discrepancies};
  await writeFile(outPath,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if(discrepancies.length) {
    console.error('Genetics CDN identity drift: refusing WordPress mutations until affected images are reviewed and approved.');
    process.exitCode=1;
  }
}
