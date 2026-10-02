const SCHEMA='thc-research-evidence-dataset';
const VERSION=1;
const KINDS=new Set(['genomics-run','biosample','plant-trait','environment-response','pathogen','pest','nutrient','compound','citation']);
const text=v=>String(v??'').trim();
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function validateResearchEvidenceDataset(dataset){
 const errors=[];
 if(!object(dataset))return ['dataset must be an object'];
 if(dataset.schema!==SCHEMA)errors.push('schema must be '+SCHEMA);
 if(dataset.version!==VERSION)errors.push('unsupported dataset version');
 if(!text(dataset.datasetId))errors.push('datasetId is required');
 if(!Number.isFinite(Date.parse(dataset.generatedAt)))errors.push('generatedAt must be an ISO date/time');
 if(!Array.isArray(dataset.sources)||!dataset.sources.length)errors.push('sources must be a non-empty array');
 if(!Array.isArray(dataset.records))errors.push('records must be an array');
 const sourceIds=new Set();
 for(const [i,s] of (Array.isArray(dataset.sources)?dataset.sources:[]).entries()){
  if(!object(s)){errors.push('source '+i+' must be an object');continue;}
  const id=text(s.sourceId); if(!id)errors.push('source '+i+' sourceId is required'); else if(sourceIds.has(id))errors.push('duplicate sourceId: '+id); else sourceIds.add(id);
  if(!text(s.provider))errors.push('source '+i+' provider is required');
  if(!Number.isFinite(Date.parse(s.retrievedAt)))errors.push('source '+i+' retrievedAt must be valid');
  if(!object(s.identifiers)||!Object.keys(s.identifiers).length)errors.push('source '+i+' identifiers are required');
 }
 const recordIds=new Set();
 for(const [i,r] of (Array.isArray(dataset.records)?dataset.records:[]).entries()){
  if(!object(r)){errors.push('record '+i+' must be an object');continue;}
  const id=text(r.recordId); if(!id)errors.push('record '+i+' recordId is required'); else if(recordIds.has(id))errors.push('duplicate recordId: '+id); else recordIds.add(id);
  if(!KINDS.has(r.kind))errors.push('record '+i+' has unsupported kind');
  if(!sourceIds.has(text(r.sourceId)))errors.push('record '+i+' references unknown sourceId');
  if(!object(r.identifiers)||!Object.keys(r.identifiers).length)errors.push('record '+i+' identifiers are required');
  if(!object(r.facts))errors.push('record '+i+' facts must be an object');
  for(const [name,fact] of Object.entries(object(r.facts)?r.facts:{})) if(object(fact)&&'value' in fact&&typeof fact.value==='number'&&!text(fact.unit)) errors.push('record '+i+' numeric fact '+name+' requires unit');
 }
 return errors;
}
export function indexResearchEvidence(dataset){
 const errors=validateResearchEvidenceDataset(dataset); if(errors.length)throw new Error('Invalid research evidence dataset: '+errors.join('; '));
 const sources=new Map(dataset.sources.map(s=>[s.sourceId,s]));
 const byKind=new Map(); for(const r of dataset.records){const rows=byKind.get(r.kind)||[];rows.push(r);byKind.set(r.kind,rows);}
 return {datasetId:dataset.datasetId,sources,records:dataset.records.slice(),byKind};
}
export function researchEvidenceForKind(index,kind){return (index?.byKind?.get(kind)||[]).slice();}
