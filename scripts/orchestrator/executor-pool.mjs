import { loadWorkerRegistry, workerSpec } from './executor.mjs'

export function executorDemand(job,{workerConfig=loadWorkerRegistry(),now=new Date()}={}) {
  const requested = job.state === 'REPAIRING' ? (job.repair?.workerKind || job.workerKind) : job.workerKind
  if(!requested) return {ready:false,reasons:['missing-worker-kind']}
  const spec=workerSpec(requested,workerConfig)
  const reasons=[]
  if(!['LEASED','REPAIRING'].includes(job.state)) reasons.push('state-not-executor-ready')
  if(job.state==='REPAIRING' && job.repair?.nextEligibleAt && new Date(job.repair.nextEligibleAt)>now) reasons.push('repair-backoff-active')
  if(spec.productionAccess) reasons.push('production-worker-requires-release-conveyor')
  return {ready:reasons.length===0,workerKind:requested,class:spec.class,capabilities:spec.capabilities||[],reasons}
}

export function executorQueue(jobs,{workerConfig=loadWorkerRegistry(),now=new Date()}={}) {
  const active=new Map()
  for(const job of jobs){
    const kind=job.executor?.status==='RUNNING' ? (job.state==='REPAIRING' ? job.repair?.workerKind : job.workerKind) : null
    if(kind) active.set(kind,(active.get(kind)||0)+1)
  }
  return jobs.map(job=>({job,demand:executorDemand(job,{workerConfig,now})}))
    .filter(x=>x.demand.ready)
    .filter(x=>(active.get(x.demand.workerKind)||0)<Number(workerSpec(x.demand.workerKind,workerConfig).maxConcurrent||1))
    .sort((a,b)=>Number(a.job.attempt||0)-Number(b.job.attempt||0) || new Date(a.job.createdAt||0)-new Date(b.job.createdAt||0))
}
