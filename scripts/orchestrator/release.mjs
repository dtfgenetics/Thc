import { transitionJob, validateJob } from './state.mjs'

function requireWorkflowRunId(value) {
  const runId=Number(value)
  if(!Number.isSafeInteger(runId)||runId<=0) throw new Error('workflowRunId must be a positive integer')
  return runId
}

function requireSourceSha(value) {
  const sha=String(value||'').trim()
  if(!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('sourceSha must be a 40-character Git commit SHA')
  return sha
}

export function startProductionRelease(job,{workflowRunId,sourceSha,workflow='dtfseeds-production-gateway.yml',now=new Date().toISOString()}={}) {
  validateJob(job)
  if(job.state!=='PRODUCTION_READY') throw new Error(`release start requires PRODUCTION_READY; found ${job.state}`)
  if(!job.productionImpact) throw new Error('release start requires productionImpact=true')
  const runId=requireWorkflowRunId(workflowRunId)
  const releaseSha=requireSourceSha(sourceSha)
  const prepared={...job,release:{workflow,workflowRunId:runId,sourceSha:releaseSha,startedAt:now,status:'DEPLOYING'}}
  return transitionJob(prepared,'DEPLOYING',{now,event:'production-gateway-started'})
}

export function recordDeploymentComplete(job,{workflowRunId,sourceSha,conclusion,now=new Date().toISOString()}={}) {
  validateJob(job)
  if(job.state!=='DEPLOYING') throw new Error(`deployment completion requires DEPLOYING; found ${job.state}`)
  const runId=requireWorkflowRunId(workflowRunId)
  const deployedSha=requireSourceSha(sourceSha)
  if(Number(job.release?.workflowRunId)!==runId) throw new Error('workflow run does not match recorded release')
  if(job.release?.sourceSha!==deployedSha) throw new Error('deployed source SHA does not match recorded release')
  if(conclusion!=='success') throw new Error(`production gateway conclusion must be success; found ${conclusion}`)
  const prepared={...job,release:{...job.release,deployedAt:now,deploymentConclusion:conclusion,status:'LIVE_VERIFYING'}}
  return transitionJob(prepared,'LIVE_VERIFYING',{now,event:'production-gateway-published'})
}

export function recordLiveVerification(job,{workflowRunId,sourceSha,checks=[],now=new Date().toISOString()}={}) {
  validateJob(job)
  if(job.state!=='LIVE_VERIFYING') throw new Error(`live verification requires LIVE_VERIFYING; found ${job.state}`)
  const runId=requireWorkflowRunId(workflowRunId)
  const verifiedSha=requireSourceSha(sourceSha)
  if(Number(job.release?.workflowRunId)!==runId) throw new Error('workflow run does not match recorded release')
  if(job.release?.sourceSha!==verifiedSha) throw new Error(`live source SHA ${sourceSha} does not match release source ${job.release?.sourceSha}`)
  if(!Array.isArray(checks)||checks.length===0) throw new Error('live verification evidence is required')
  if(checks.some((check)=>check?.ok!==true)) throw new Error('all live verification checks must pass')
  if(checks.some((check)=>typeof check?.target!=='string'||!check.target.trim())) throw new Error('each live verification check requires a target')
  const prepared={...job,release:{...job.release,status:'VERIFIED',verifiedAt:now,liveChecks:checks}}
  return transitionJob(prepared,'DONE',{now,event:'production-live-verified'})
}
