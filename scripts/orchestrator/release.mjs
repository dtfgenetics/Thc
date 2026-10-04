import { transitionJob } from './state.mjs'

export function startProductionRelease(job,{workflowRunId,sourceSha,workflow='dtfseeds-production-gateway.yml',now=new Date().toISOString()}={}) {
  if(job.state!=='PRODUCTION_READY') throw new Error(`release start requires PRODUCTION_READY; found ${job.state}`)
  if(!job.productionImpact) throw new Error('release start requires productionImpact=true')
  if(!workflowRunId) throw new Error('workflowRunId is required')
  if(!sourceSha) throw new Error('sourceSha is required')
  const prepared={...job,release:{workflow,workflowRunId:Number(workflowRunId),sourceSha,startedAt:now,status:'DEPLOYING'}}
  return transitionJob(prepared,'DEPLOYING',{now,event:'production-gateway-started'})
}

export function recordDeploymentComplete(job,{workflowRunId,conclusion,now=new Date().toISOString()}={}) {
  if(job.state!=='DEPLOYING') throw new Error(`deployment completion requires DEPLOYING; found ${job.state}`)
  if(Number(job.release?.workflowRunId)!==Number(workflowRunId)) throw new Error('workflow run does not match recorded release')
  if(conclusion!=='success') throw new Error(`production gateway conclusion must be success; found ${conclusion}`)
  const prepared={...job,release:{...job.release,deployedAt:now,deploymentConclusion:conclusion,status:'LIVE_VERIFYING'}}
  return transitionJob(prepared,'LIVE_VERIFYING',{now,event:'production-gateway-published'})
}

export function recordLiveVerification(job,{workflowRunId,sourceSha,checks=[],now=new Date().toISOString()}={}) {
  if(job.state!=='LIVE_VERIFYING') throw new Error(`live verification requires LIVE_VERIFYING; found ${job.state}`)
  if(Number(job.release?.workflowRunId)!==Number(workflowRunId)) throw new Error('workflow run does not match recorded release')
  if(job.release?.sourceSha!==sourceSha) throw new Error(`live source SHA ${sourceSha} does not match release source ${job.release?.sourceSha}`)
  if(!Array.isArray(checks)||checks.length===0) throw new Error('live verification evidence is required')
  if(checks.some((check)=>check?.ok!==true)) throw new Error('all live verification checks must pass')
  const prepared={...job,release:{...job.release,status:'VERIFIED',verifiedAt:now,liveChecks:checks}}
  return transitionJob(prepared,'DONE',{now,event:'production-live-verified'})
}
