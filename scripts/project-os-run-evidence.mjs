import fs from 'node:fs';
import path from 'node:path';

const SHA=/^[a-f0-9]{40}$/i;
export async function inspectRunEvidence({repository,sha,runId,attempt,token,fetchImpl=fetch}) {
  if(!/^[-\w.]+\/[-\w.]+$/.test(repository)||!SHA.test(sha)||
     !Number.isSafeInteger(runId)||runId<1||!Number.isSafeInteger(attempt)||attempt<1||!token)
    throw new Error('Invalid run identity or missing token');
  const prefix=`https://api.github.com/repos/${repository}/actions/runs/${runId}`;
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function get(url){
    const response=await fetchImpl(url,{headers});
    if(!response.ok) throw new Error(`GitHub Actions API returned ${response.status}`);
    const payload=await response.json();
    if(!payload || typeof payload!=='object')throw Error('Invalid GitHub payload');
    return payload;
  }
  const run=await get(prefix);
  if(run.id!==runId||run.run_attempt!==attempt||run.head_sha!==sha||
     run.repository?.full_name!==repository||run.status!=='completed'||run.conclusion!=='success')
    throw Error('Run identity, exact revision, or success not verified');
  const jobs=await get(prefix+`/attempts/${attempt}/jobs?per_page=100`);
  const artifacts=await get(prefix+'/artifacts?per_page=100');
  if(!Array.isArray(jobs.jobs)||!Array.isArray(artifacts.artifacts))throw Error('Invalid jobs or artifacts response');
  // Fail closed instead of reporting potentially incomplete pagination.
  if(jobs.total_count>jobs.jobs.length||artifacts.total_count>artifacts.artifacts.length)
    throw Error('Run job or artifact pagination incomplete');
  return {
    schemaVersion:1,repository,sha,runId,attempt,
    jobs:jobs.jobs.map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,runId,runAttempt:attempt,headSha:sha})),
    artifacts:artifacts.artifacts.map(a=>({id:a.id,name:a.name,expired:a.expired,digest:a.digest??null,runId,
      // The run-level artifacts endpoint does not attest which retry attempt produced an artifact.
      runAttempt:null,headSha:sha,attemptAttribution:'unverified'})),
    applicationAttribution:'unverified',
    note:'Run-level artifacts are not attributed to a retry attempt or producer job. No appIds/jobId introduced; they cannot satisfy the application release gate.'
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 try{
  const result=await inspectRunEvidence({repository:process.env.GITHUB_REPOSITORY,
    sha:process.env.PROJECT_OS_TARGET_SHA||process.env.GITHUB_SHA,
    runId:Number(process.env.PROJECT_OS_RUN_ID),attempt:Number(process.env.PROJECT_OS_RUN_ATTEMPT),
    token:process.env.GITHUB_TOKEN});
  const output=process.env.PROJECT_OS_RUN_REPORT||'.artifacts/project-os/run-evidence.json';
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({jobs:result.jobs.length,artifacts:result.artifacts.length,applicationAttribution:result.applicationAttribution}));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
