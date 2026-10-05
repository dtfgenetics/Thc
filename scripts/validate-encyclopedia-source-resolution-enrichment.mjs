#!/usr/bin/env node
import fs from 'node:fs';

const queuePath='data/encyclopedia-source-resolution-queue.json';
const enrichmentPath='data/encyclopedia-source-resolution-enrichment.json';
const errors=[];
if(!fs.existsSync(queuePath)) errors.push('Missing '+queuePath);
if(!fs.existsSync(enrichmentPath)) errors.push('Missing '+enrichmentPath);

if(!errors.length){
  const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
  const data=JSON.parse(fs.readFileSync(enrichmentPath,'utf8'));
  const known=new Set((queue.references||[]).map(x=>x.referenceId));
  if(data.artifactId!=='thc-encyclopedia-source-resolution-enrichment') errors.push('Unexpected enrichment artifact id.');
  if(!String(data.boundary||'').includes('never approves')) errors.push('Enrichment boundary must forbid automatic approval.');
  if(!Array.isArray(data.rows)) errors.push('Enrichment rows must be an array.');
  for(const row of data.rows||[]){
    if(!known.has(row.referenceId)) errors.push(row.referenceId+': reference is absent from source-resolution queue.');
    if(row.reviewState!=='pending_independent_source_and_claim_review') errors.push(row.referenceId+': review state must remain pending.');
    if(row.publicationEffect!=='none') errors.push(row.referenceId+': publication effect must remain none.');
    if('approved' in row && row.approved!==false) errors.push(row.referenceId+': enrichment must not approve references.');
    if(!Array.isArray(row.candidates)) errors.push(row.referenceId+': candidates must be an array.');
    for(const candidate of row.candidates||[]){
      if(!['citation-identifier','crossref','pubmed'].includes(candidate.provider)) errors.push(row.referenceId+': unknown provider '+candidate.provider);
      if(candidate.url&&!/^https:\/\//.test(String(candidate.url))) errors.push(row.referenceId+': candidate URL must use HTTPS.');
      if(candidate.doi&&!/^10\.\d{4,9}\//i.test(String(candidate.doi))) errors.push(row.referenceId+': malformed DOI candidate.');
      if(candidate.pmid&&!/^\d{6,9}$/.test(String(candidate.pmid))) errors.push(row.referenceId+': malformed PMID candidate.');
      if(candidate.pmc&&!/^PMC\d{5,}$/i.test(String(candidate.pmc))) errors.push(row.referenceId+': malformed PMCID candidate.');
    }
  }
}
if(errors.length){
  console.error('Encyclopedia source enrichment validation failed with '+errors.length+' issue(s):');
  errors.slice(0,100).forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('Encyclopedia source enrichment PASS: reviewer candidates remain non-authoritative and publication-neutral.');
