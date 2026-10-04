import { transitionJob } from './state.mjs'

export function loadRetryPolicy(config, name) {
  const policy=config?.policies?.[name]
  if(!policy) throw new Error(`Unknown retry policy: ${name}`)
  return { name, ...policy }
}

export function planRepair(job, failure, retryConfig, { now=new Date() }={}) {
  if(!failure) throw new Error('failure classification is required')
  const policy=loadRetryPolicy(retryConfig, failure.retryPolicy || job.retryPolicy || retryConfig.defaultPolicy)
  const attempt=Number(job.attempt||0)
  if(policy.blockImmediately || failure.automatic === false) {
    return { action:'BLOCK', state:'BLOCKED', policy:policy.name, repairWorker:failure.repairWorker||policy.repairWorker||null, attempt, reason:failure.class }
  }
  if(attempt >= Number(policy.maxAttempts||0)) {
    return { action:policy.quarantineAfterMaxAttempts ? 'QUARANTINE':'BLOCK', state:policy.quarantineAfterMaxAttempts ? 'QUARANTINED':'BLOCKED', policy:policy.name, repairWorker:failure.repairWorker||policy.repairWorker||null, attempt, reason:'max-attempts-exhausted' }
  }
  const delays=Array.isArray(policy.backoffMinutes)?policy.backoffMinutes:[]
  const backoffMinutes=Number(delays[Math.min(attempt,Math.max(0,delays.length-1))]||0)
  const nextEligibleAt=new Date(now.getTime()+backoffMinutes*60_000).toISOString()
  const repairWorker=failure.repairWorker||policy.repairWorker||null
  return { action:repairWorker ? 'REPAIR':'RETRY', state:repairWorker ? 'REPAIRING':'RETRY_WAIT', policy:policy.name, repairWorker, attempt:attempt+1, backoffMinutes, nextEligibleAt, reason:failure.class }
}

export function applyRepairPlan(job, failure, plan, { now=new Date().toISOString() }={}) {
  const prepared={...job,attempt:plan.attempt,lastFailure:{...failure,classifiedAt:now,policy:plan.policy},repair:{workerKind:plan.repairWorker||null,policy:plan.policy,nextEligibleAt:plan.nextEligibleAt||null,plannedAt:now}}
  return transitionJob(prepared,plan.state,{now,event:`verification-${plan.action.toLowerCase()}`})
}
