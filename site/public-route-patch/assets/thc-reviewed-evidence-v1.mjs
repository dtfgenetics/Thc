const DEFAULT_URL='/thc-grow-doc/data/rag_claims_v1.json';
export function validateReviewedEvidenceBundle(doc){
 if(!doc||doc.schema_version!=='grow-doc-rag-claims-published-v1')throw new Error('Unsupported reviewed evidence schema');
 if(doc.publication_policy?.reviewed_claims_only!==true||doc.publication_policy?.weight_training_eligible!==false)throw new Error('Unsafe reviewed evidence policy');
 if(!Array.isArray(doc.claims))throw new Error('Reviewed evidence claims must be an array');
 for(const [i,c] of doc.claims.entries()){
  if(!c?.claim_sha256||!/^[0-9a-f]{64}$/.test(c.claim_sha256))throw new Error(`Claim ${i} missing stable hash`);
  if(!c.source_id||!c.claim||!c.citation_locator||!c.scope)throw new Error(`Claim ${i} missing provenance`);
 }
 return doc;
}
export async function loadReviewedEvidence({url=DEFAULT_URL,fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')throw new Error('fetch implementation required');
 const res=await fetchImpl(url,{headers:{Accept:'application/json'}});
 if(!res.ok)throw new Error(`Reviewed evidence request failed: HTTP ${res.status}`);
 return validateReviewedEvidenceBundle(await res.json());
}
export const reviewedEvidenceUrl=DEFAULT_URL;
