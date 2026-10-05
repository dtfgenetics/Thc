#!/usr/bin/env node
import fs from 'node:fs';

const queuePath='data/encyclopedia-source-resolution-queue.json';
const outPath='data/encyclopedia-source-resolution-enrichment.json';
if(!fs.existsSync(queuePath)) throw new Error('Missing '+queuePath+'. Build the source-resolution queue first.');

const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
const references=Array.isArray(queue.references)?queue.references:[];
const limit=Math.max(1,Math.min(1000,Number(process.env.ENCYCLOPEDIA_SOURCE_ENRICH_LIMIT||250)));
const contact=String(process.env.CROSSREF_MAILTO||'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>encodeURIComponent(String(v||'').trim());
const normalize=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

function idsFromText(value){
  const text=String(value||'');
  const doi=text.match(/10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/i)?.[0]?.replace(/[.,;:]+$/,'').toLowerCase()||null;
  const pmc=text.match(/\bPMC\d{5,}\b/i)?.[0]?.toUpperCase()||null;
  const pmid=text.match(/\bPMID\s*[:.]?\s*(\d{6,9})\b/i)?.[1]||null;
  return {doi,pmc,pmid};
}

function titleTokens(value){
  return new Set(normalize(value).split(' ').filter(x=>x.length>=4));
}
function overlapScore(a,b){
  const A=titleTokens(a), B=titleTokens(b);
  if(!A.size||!B.size) return 0;
  let hit=0; for(const x of A) if(B.has(x)) hit++;
  return hit/Math.max(A.size,B.size);
}
function citationQuery(raw){
  return String(raw||'')
    .replace(/https:\/\/\S+/g,' ')
    .replace(/\b(?:PMCID?|doi)\s*[:.]?\s*\S+/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,700);
}
function candidateTitleFromCitation(raw){
  const cleaned=citationQuery(raw);
  const parts=cleaned.split(/\.\s+/).map(x=>x.trim()).filter(Boolean);
  const likely=parts.find(x=>x.length>=25&&!/^(?:19|20)\d{2}$/.test(x));
  return likely||cleaned;
}

async function fetchJson(url,provider){
  const res=await fetch(url,{headers:{'User-Agent':'DTF-THC-Encyclopedia-Source-Resolver/1.0'},signal:AbortSignal.timeout(30_000)});
  const text=await res.text();
  if(!res.ok) throw new Error(provider+' '+res.status+': '+text.slice(0,300));
  return JSON.parse(text);
}

async function crossref(raw){
  const q=citationQuery(raw); if(!q) return [];
  const params=new URLSearchParams({'query.bibliographic':q,rows:'3',select:'DOI,title,container-title,published-print,published-online,URL,score,author'});
  if(contact) params.set('mailto',contact);
  const data=await fetchJson('https://api.crossref.org/works?'+params.toString(),'crossref');
  await sleep(150);
  return (data?.message?.items||[]).map(item=>{
    const doi=String(item.DOI||'').toLowerCase()||null;
    const title=Array.isArray(item.title)?String(item.title[0]||''):String(item.title||'');
    return {
      provider:'crossref',
      providerScore:Number(item.score||0),
      title,
      doi,
      url:doi?'https://doi.org/'+doi:(item.URL||null),
      containerTitle:Array.isArray(item['container-title'])?item['container-title'][0]||null:null,
      titleOverlap:overlapScore(candidateTitleFromCitation(raw),title)
    };
  });
}

async function pubmed(raw){
  const q=citationQuery(raw); if(!q) return [];
  const search=await fetchJson('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&term='+esc(q),'pubmed-esearch');
  await sleep(360);
  const ids=search?.esearchresult?.idlist||[];
  if(!ids.length) return [];
  const summary=await fetchJson('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id='+ids.join(','),'pubmed-esummary');
  await sleep(360);
  return ids.map(pmid=>{
    const row=summary?.result?.[pmid]||{};
    const title=String(row.title||'');
    const articleIds=Array.isArray(row.articleids)?row.articleids:[];
    const doi=String(articleIds.find(x=>x.idtype==='doi')?.value||'').toLowerCase()||null;
    const pmc=String(articleIds.find(x=>x.idtype==='pmc')?.value||'').toUpperCase()||null;
    return {
      provider:'pubmed',
      title,
      pmid:String(pmid),
      pmc:pmc||null,
      doi:doi||null,
      url:'https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/',
      titleOverlap:overlapScore(candidateTitleFromCitation(raw),title)
    };
  });
}

const eligible=references
  .filter(x=>x.traceabilityRequired!==false)
  .filter(x=>!(x.resolvedAuthoritativeSourceIds||[]).length)
  .filter(x=>!['control_note_resolved_not_evidence_source'].includes(x.resolutionStatus))
  .slice(0,limit);

const rows=[];
for(const ref of eligible){
  const exact=idsFromText(ref.rawReference);
  const candidates=[];
  if(exact.doi) candidates.push({provider:'citation-identifier',identifierType:'doi',doi:exact.doi,url:'https://doi.org/'+exact.doi,confidence:'exact_identifier'});
  if(exact.pmid) candidates.push({provider:'citation-identifier',identifierType:'pmid',pmid:exact.pmid,url:'https://pubmed.ncbi.nlm.nih.gov/'+exact.pmid+'/',confidence:'exact_identifier'});
  if(exact.pmc) candidates.push({provider:'citation-identifier',identifierType:'pmcid',pmc:exact.pmc,url:'https://pmc.ncbi.nlm.nih.gov/articles/'+exact.pmc+'/',confidence:'exact_identifier'});
  const errors=[];
  if(!exact.doi){
    try{candidates.push(...await crossref(ref.rawReference));}catch(e){errors.push(String(e?.message||e));}
  }
  if(!exact.pmid){
    try{candidates.push(...await pubmed(ref.rawReference));}catch(e){errors.push(String(e?.message||e));}
  }
  const dedup=new Map();
  for(const c of candidates){
    const key=[c.provider,c.doi||'',c.pmid||'',c.pmc||'',c.url||'',normalize(c.title||'')].join('|');
    if(!dedup.has(key)) dedup.set(key,c);
  }
  rows.push({
    referenceId:ref.referenceId,
    rawReference:ref.rawReference,
    lessonIds:ref.lessonIds||[],
    existingResolutionStatus:ref.resolutionStatus,
    exactIdentifiers:exact,
    candidates:[...dedup.values()],
    errors,
    reviewState:'pending_independent_source_and_claim_review',
    publicationEffect:'none'
  });
}

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-source-resolution-enrichment',
  generatedBy:'scripts/enrich-encyclopedia-source-resolution-candidates.mjs',
  generatedAt:new Date().toISOString(),
  boundary:'External metadata matches are reviewer candidates only. This artifact never approves a source, claim, lesson, or publication state.',
  providers:['citation-identifier','crossref','pubmed'],
  inputReferenceCount:references.length,
  processedReferenceCount:rows.length,
  limit,
  summary:{
    rowsWithCandidates:rows.filter(x=>x.candidates.length).length,
    exactIdentifierRows:rows.filter(x=>Object.values(x.exactIdentifiers).some(Boolean)).length,
    providerErrors:rows.reduce((n,x)=>n+x.errors.length,0)
  },
  rows
};
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary,null,2));
console.log('Wrote '+outPath);
