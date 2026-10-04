const SUPPORTED_TYPES = new Set(['check','path-exists','json-path','production-live'])

export function normalizeAcceptanceCriterion(criterion) {
  if (typeof criterion === 'string') return { type: 'check', description: criterion, legacy: true }
  if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) throw new Error('acceptance criterion must be a string or object')
  const type=String(criterion.type||'').trim()
  if(!SUPPORTED_TYPES.has(type)) throw new Error(`unsupported acceptance criterion type: ${type || '(missing)'}`)
  if(type === 'check' && !String(criterion.description||criterion.name||'').trim()) throw new Error('check criterion requires description or name')
  if(type === 'path-exists' && !String(criterion.path||'').trim()) throw new Error('path-exists criterion requires path')
  if(type === 'json-path' && (!String(criterion.path||'').trim() || !String(criterion.pointer||'').trim())) throw new Error('json-path criterion requires path and pointer')
  if(type === 'production-live' && !String(criterion.target||'').trim()) throw new Error('production-live criterion requires target')
  return { ...criterion, type, legacy:false }
}

export function inspectAcceptanceContract(criteria=[], { productionImpact=false }={}) {
  const normalized=(criteria||[]).map(normalizeAcceptanceCriterion)
  const executable=normalized.filter((c)=>!c.legacy)
  const live=normalized.filter((c)=>c.type==='production-live')
  const reasons=[]
  if(normalized.length===0) reasons.push('missing-acceptance-criteria')
  if(productionImpact && live.length===0) reasons.push('production-live-criterion-required')
  return { ok: reasons.length===0, normalized, executable, legacyCount:normalized.length-executable.length, reasons }
}

export function acceptanceSummary(criteria=[], options={}) {
  const inspection=inspectAcceptanceContract(criteria,options)
  return { ok:inspection.ok,total:inspection.normalized.length,typed:inspection.executable.length,legacy:inspection.legacyCount,reasons:inspection.reasons }
}
