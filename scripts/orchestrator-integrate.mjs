#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { transitionJob, validateJob } from './orchestrator/state.mjs'

const MARKER_RE = /<!-- worker-orchestrator:(\{.*?\}) -->/s

function capture(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
}
function json(args) { const out = capture(args); return out ? JSON.parse(out) : null }
function options(argv) {
  return Object.fromEntries(argv.filter((x) => x.startsWith('--')).map((x) => {
    const raw=x.slice(2), at=raw.indexOf('='); return at < 0 ? [raw,'true'] : [raw.slice(0,at),raw.slice(at+1)]
  }))
}
function parse(body) { const m=String(body||'').match(MARKER_RE); return m ? JSON.parse(m[1]) : null }
function replace(body,payload) {
  const marker=`<!-- worker-orchestrator:${JSON.stringify(payload)} -->`
  return `${String(body||'').replace(/\n?<!-- worker-orchestrator:\{.*?\} -->/s,'').trim()}\n\n${marker}`.trim()
}
function repoName() {
  return process.env.GITHUB_REPOSITORY || capture(['repo','view','--json','nameWithOwner','--jq','.nameWithOwner'])
}

const opt=options(process.argv.slice(2)), controlRepo=repoName(), issueNumber=Number(opt.issue)
if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  console.error('Usage: node scripts/orchestrator-integrate.mjs --issue=N [--apply=true]')
  process.exit(2)
}
try {
  const issue=json(['api',`repos/${controlRepo}/issues/${issueNumber}`])
  const job=parse(issue.body); if(!job) throw new Error(`Issue #${issueNumber} has no orchestrator marker`)
  validateJob(job)
  if(job.state !== 'INTEGRATION_READY') throw new Error(`Job must be INTEGRATION_READY; found ${job.state}`)
  if(!job.prNumber || !job.verification?.headSha) throw new Error('Job requires prNumber and exact-head verification evidence')
  const targetRepo=job.repository || controlRepo
  const pr=json(['pr','view',String(job.prNumber),'--repo',targetRepo,'--json','number,state,mergedAt,mergeCommit,headRefOid,url'])
  if(pr.state !== 'MERGED' || !pr.mergedAt || !pr.mergeCommit?.oid) throw new Error(`PR #${pr.number} is not merged`)
  if(pr.headRefOid !== job.verification.headSha) throw new Error(`Merged PR head ${pr.headRefOid} does not match verified head ${job.verification.headSha}`)
  const now=new Date().toISOString()
  let next=transitionJob({...job,merge:{prNumber:pr.number,verifiedHeadSha:pr.headRefOid,mergeCommitSha:pr.mergeCommit.oid,mergedAt:pr.mergedAt,recordedAt:now}},'MERGED',{now,event:'verified-pr-merged'})
  if(!job.productionImpact) next=transitionJob(next,'DONE',{now,event:'non-production-work-complete'})
  else next=transitionJob(next,'PRODUCTION_READY',{now,event:'merge-ready-for-production'})
  if(opt.apply === 'true') {
    capture(['issue','edit',String(issueNumber),'--repo',controlRepo,'--body',replace(issue.body,next)])
  }
  console.log(JSON.stringify({ok:true,mode:opt.apply==='true'?'integrate-apply':'integrate-dry-run',controlRepo,targetRepo,issueNumber,pr:pr.number,verifiedHeadSha:pr.headRefOid,mergeCommitSha:pr.mergeCommit.oid,nextState:next.state,job:next},null,2))
} catch(error) {
  console.error(JSON.stringify({ok:false,issueNumber,error:error.message},null,2)); process.exit(1)
}
