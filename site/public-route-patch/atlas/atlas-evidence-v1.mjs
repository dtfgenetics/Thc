import {loadReviewedEvidence} from '/assets/thc-reviewed-evidence-v1.mjs';
import {indexResearchEvidence,researchEvidenceForKind,validateResearchEvidenceDataset} from '/assets/thc-research-evidence-v1.mjs';
const STRUCTURED_URL='/data/research/evidence/latest.json';
const MAP_URL='/atlas/data/evidence-map-v1.json';
const clean=v=>String(v??'').trim();
const scopeText=scope=>Object.values(scope&&typeof scope==='object'?scope:{}).map(clean).filter(Boolean).join(' ').toLowerCase();
export async function loadAtlasEvidence({systemId,fetchImpl=globalThis.fetch}={}){
 const id=clean(systemId).toLowerCase(); if(!id)throw new Error('systemId is required');
 const map=await fetchImpl(MAP_URL,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():{systems:{}}).catch(()=>({systems:{}}));
 const config=map.systems?.[id]||{};
 const terms=(config.reviewedScopeTerms||[id]).map(clean).filter(Boolean);
 const [reviewedResult,structuredResult]=await Promise.allSettled([
  loadReviewedEvidence({fetchImpl}),
  fetchImpl(STRUCTURED_URL,{headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)throw new Error('Structured evidence HTTP '+r.status);const d=await r.json();const e=validateResearchEvidenceDataset(d);if(e.length)throw new Error(e.join('; '));return indexResearchEvidence(d);})
 ]);
 const reviewed=reviewedResult.status==='fulfilled'?reviewedResult.value.claims.filter(c=>terms.some(term=>scopeText(c.scope).includes(term.toLowerCase()))):[];
 const kinds=config.structuredKinds||['genomics-run','plant-trait','environment-response'];
 const structured=structuredResult.status==='fulfilled'?kinds.flatMap(kind=>researchEvidenceForKind(structuredResult.value,kind)):[];
 return {reviewed,structured,config,status:{reviewed:reviewedResult.status,structured:structuredResult.status}};
}
export function renderAtlasEvidencePanel(target,evidence){
 if(!target)return;const reviewed=evidence?.reviewed||[],structured=evidence?.structured||[];
 const config=evidence?.config||{}; target.innerHTML='<h2>Research evidence</h2><p>'+escapeHtml(config.intro||'Reviewed claims and structured source records are shown separately so citations are not confused with raw observations.')+'</p>'+
  (reviewed.length?'<h3>Reviewed claims</h3>'+reviewed.slice(0,5).map(c=>'<div class="warning"><strong>'+escapeHtml(c.claim)+'</strong><br><small>'+escapeHtml(c.source_id)+' · '+escapeHtml(c.citation_locator)+'</small></div>').join(''):'<p>No reviewed claims are mapped to this system yet.</p>')+
  (structured.length?'<h3>Structured source records</h3><p>'+structured.length+' validated research records are available to Atlas data workflows.</p>':'<p>No structured source records are published for this system yet.</p>')+
  ((config.questions||[]).length?'<h3>Interpretation questions</h3>'+config.questions.map(q=>'<div class="warning">'+escapeHtml(q)+'</div>').join(''):'');
}
const escapeHtml=v=>clean(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const atlasStructuredEvidenceUrl=STRUCTURED_URL;
