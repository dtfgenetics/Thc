#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-encyclopedia-copy-repair';
const ownerAuthorization=JSON.parse(await (await import('node:fs/promises')).readFile('content/encyclopedia/review/owner-publication-authorization-2026-10-03.json','utf8'));
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth='Basic '+Buffer.from(`${user}:${pass}`).toString('base64');
const malformedPublicCopy=/\b(?:Open|ppen) sourc(?:\b|ee\b)|\bsourcee\b|\babstracte\b/i;
const genericMisconceptionPlaceholder=/Correction:\s*See the (?:controlled )?lesson evidence and context\.?/i;
const fingerprintOf=a=>createHash('sha256').update(JSON.stringify({
  id:a.id,title:a.title,objective:a.objective,terms:a.terms,coreScience:a.coreScience,
  cultivationRelevance:a.cultivationRelevance,measureAndRecord:a.measureAndRecord,
  misconceptions:a.misconceptions,evidenceLimits:a.evidenceLimits,crossLinks:a.crossLinks,
  sourceNotes:a.sourceNotes,assessment:effectiveLessonAssessment(a).prompts
})).digest('hex').slice(0,24);
const hasStructuredData=(html,id)=>String(html||'').includes('application/ld+json') &&
  String(html||'').includes('"LearningResource"') &&
  String(html||'').includes('"Article"') &&
  String(html||'').includes('"BreadcrumbList"') &&
  String(html||'').includes('"identifier":"'+id+'"');
const liveFingerprint=html=>String(html||'').match(/data-thc-source-fingerprint=["']([0-9a-f]{24})["']/i)?.[1]||null;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wp(endpoint){
  let lastError=null;
  for(let attempt=1;attempt<=4;attempt++){
    try{
      const response=await fetch(`${site}/wp-json/wp/v2${endpoint}`,{
        redirect:'follow',
        signal:AbortSignal.timeout(60000),
        headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache','User-Agent':'DTF-Encyclopedia-Copy-Repair/1.1'}
      });
      const text=await response.text();
      let body=text;
      try{body=text?JSON.parse(text):null}catch{}
      if(!response.ok) throw new Error(`GET ${endpoint} failed ${response.status}: ${typeof body==='string'?body.slice(0,600):JSON.stringify(body).slice(0,600)}`);
      return {body,headers:response.headers};
    }catch(error){
      lastError=error;
      if(attempt===4) break;
      console.warn(`WordPress API attempt ${attempt}/4 failed for ${endpoint}: ${error instanceof Error?error.message:String(error)}`);
      await sleep(1500*attempt);
    }
  }
  throw lastError;
}
async function findPage(slug,parent=null){
  const {body}=await wp(`/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  const rows=Array.isArray(body)?body:[];
  return rows.find(x=>parent===null||Number(x.parent)===Number(parent))||null;
}
async function allChildren(parent){
  const out=[];
  for(let page=1;;page++){
    const {body,headers}=await wp(`/pages?parent=${parent}&context=edit&status=publish&per_page=50&page=${page}&orderby=slug&order=asc`);
    if(!Array.isArray(body)) throw new Error('WordPress child-page response was not an array.');
    out.push(...body);
    const totalPages=Number(headers.get('x-wp-totalpages')||1);
    if(page>=totalPages) break;
  }
  return out;
}
const rendered=value=>typeof value==='string'?value:(value?.raw||value?.rendered||'');
const decodeHtml=value=>String(value||'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replaceAll('&nbsp;',' ')
  .replaceAll('&amp;','&')
  .replaceAll('&quot;','"')
  .replaceAll('&#39;',"'")
  .replace(/\s+/g,' ')
  .trim();
async function fetchPublic(slug){
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(`${site}/learn/encyclopedia/${slug}/?dtf_copy_repair=${Date.now()}-${attempt}`,{
        redirect:'follow',
        signal:AbortSignal.timeout(30000),
        headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache','User-Agent':'DTF-Encyclopedia-Copy-Repair/1.2'}
      });
      const body=await response.text();
      return {status:response.status,raw:body,text:decodeHtml(body)};
    }catch(error){
      lastError=error;
      if(attempt<3) await sleep(1000*attempt);
    }
  }
  return {status:0,text:'',error:lastError instanceof Error?lastError.message:String(lastError)};
}
const copyDefectKinds=html=>{
  const kinds=[];
  if(malformedPublicCopy.test(html)) kinds.push('malformed-source-copy');
  if(genericMisconceptionPlaceholder.test(html)) kinds.push('generic-misconception-placeholder');
  return kinds;
};
const fingerprintDefectKinds=(raw,expectedFingerprint)=>{
  const kinds=[];
  const found=liveFingerprint(raw);
  if(!found) kinds.push('source-fingerprint-missing');
  else if(expectedFingerprint&&found!==expectedFingerprint) kinds.push('source-fingerprint-mismatch');
  return kinds;
};
const publicParityDefectKinds=(raw,id,expectedFingerprint)=>[
  ...(!hasStructuredData(raw,id)?['structured-data-missing']:[]),
  ...fingerprintDefectKinds(raw,expectedFingerprint)
];

const learn=await findPage('learn');
if(!learn) throw new Error('Canonical /learn/ WordPress page not found.');
const encyclopedia=await findPage('encyclopedia',learn.id);
if(!encyclopedia) throw new Error('Canonical /learn/encyclopedia/ WordPress page not found.');

const children=await allChildren(encyclopedia.id);
const canonical=readCanonicalEncyclopediaLessons(process.cwd());
const byId=new Map(canonical.map(lesson=>[lesson.id,lesson]));
const lessonPages=children.filter(page=>/^thc-enc-\d{3}$/.test(page.slug||''));
const scanConcurrency=Math.max(1,Math.min(24,Number(process.env.ENC_COPY_REPAIR_CONCURRENCY||8)));
const scanResults=new Array(lessonPages.length);
let scanNext=0;
async function scanWorker(){
  while(true){
    const index=scanNext++;
    if(index>=lessonPages.length) return;
    const page=lessonPages[index];
    const id=String(page.slug).toUpperCase();
    const lesson=byId.get(id);
    const expectedFingerprint=lesson?fingerprintOf(lesson):null;
    const storedRaw=rendered(page.content);
    const storedKinds=[
      ...copyDefectKinds(storedRaw),
      ...fingerprintDefectKinds(storedRaw,expectedFingerprint)
    ];
    const publicView=await fetchPublic(page.slug);
    const renderedKinds=publicView.status===200
      ? [...copyDefectKinds(publicView.text),...publicParityDefectKinds(publicView.raw,id,expectedFingerprint)]
      : [];
    const kinds=[...new Set([...storedKinds,...renderedKinds])];
    scanResults[index]={page,id,expectedFingerprint,storedKinds,publicView,renderedKinds,kinds};
  }
}
await Promise.all(Array.from({length:scanConcurrency},()=>scanWorker()));

const candidates=[];
for(const row of scanResults){
  const {page,id,storedKinds,publicView,renderedKinds,kinds}=row;
  if(!kinds.length) continue;
  const lesson=byId.get(id);
  if(!lesson) throw new Error(`${id}: live defective page has no canonical lesson source.`);
  const canonicalBlob=JSON.stringify(lesson);
  const canonicalKinds=copyDefectKinds(canonicalBlob);
  if(canonicalKinds.length) throw new Error(`${id}: canonical source still contains blocked copy defects: ${canonicalKinds.join(', ')}`);
  const control=lesson.reviewControl||{};
  const lessonPublicationAuthorized=control.publicationAuthorized ?? lesson.publicationAuthorized ?? false;
  const ownerOverrideEligible=
    ownerAuthorization.publicationAuthorized===true &&
    ownerAuthorization.independentApproval===false &&
    ownerAuthorization.authorizedBy==='project_owner' &&
    String(control.releaseTimeReview||'').startsWith(ownerAuthorization.eligibility?.requireReleaseTimeReviewPrefix||'completed_') &&
    control.independentApproval!==true &&
    control.safetyHold!==true &&
    lesson.safetyHold!==true;
  if(lessonPublicationAuthorized!==true && !ownerOverrideEligible){
    throw new Error(`${id}: live copy is defective but neither canonical nor eligible owner publication authorization permits automatic republish.`);
  }
  candidates.push({
    id,pageId:page.id,slug:page.slug,kinds,
    storedKinds,renderedKinds,
    publicStatus:publicView.status,
    runtimeOnly:storedKinds.length===0&&renderedKinds.length>0,
    sourceFile:lesson.__path,
    ownerOverride:lessonPublicationAuthorized!==true&&ownerOverrideEligible
  });
}

const report={
  scannedPublishedLessons:lessonPages.length,
  scanConcurrency,
  defectsFound:candidates.length,
  runtimeOnlyDefects:candidates.filter(x=>x.runtimeOnly).length,
  storedContentDefects:candidates.filter(x=>x.storedKinds.length>0).length,
  structuredDataMissing:candidates.filter(x=>x.kinds.includes('structured-data-missing')).length,
  sourceFingerprintMissing:candidates.filter(x=>x.kinds.includes('source-fingerprint-missing')).length,
  sourceFingerprintMismatch:candidates.filter(x=>x.kinds.includes('source-fingerprint-mismatch')).length,
  candidates
};
await writeFile('/tmp/encyclopedia-copy-repair-scan.json',JSON.stringify(report,null,2)+'\n','utf8');

if(!candidates.length){
  console.log(JSON.stringify({...report,result:'no-repair-needed'},null,2));
  process.exit(0);
}

const manifestPath='/tmp/encyclopedia-copy-repair-batch.json';
await writeFile(manifestPath,JSON.stringify({
  schemaVersion:1,
  batch:'live-copy-defect-repair',
  status:'canonical_repair_batch',
  publicationAuthorized:true,
  validationGate:'live-copy-defect-repair-v1',
  source:{
    controlledCatalogueVersion:'current-controlled-registry',
    version:'Live copy defect repair',
    publicationAuthorization:'Republish only already-live lessons whose current canonical source is publication-eligible and free of blocked copy defects.',
    note:'Generated automatically from live WordPress defect scan; no new lesson authorization is created.'
  },
  ownerPublicationOverride:candidates.some(x=>x.ownerOverride),
  ownerPublicationAuthorizationId:ownerAuthorization.authorizationId,
  ownerOverrideLessonIds:candidates.filter(x=>x.ownerOverride).map(x=>x.id),
  lessonFiles:candidates.map(x=>x.sourceFile)
},null,2)+'\n','utf8');

const child=spawnSync(process.execPath,['scripts/publish-wordpress-encyclopedia-canonical-batch.mjs'],{
  cwd:process.cwd(),
  stdio:'inherit',
  env:{...process.env,ENCYCLOPEDIA_BATCH_FILE:manifestPath,BACKUP_ROOT:backupRoot}
});
if(child.status!==0) process.exit(child.status??1);

console.log(JSON.stringify({...report,result:'repaired-via-canonical-publisher'},null,2));
