import fs from 'node:fs';
import path from 'node:path';

const SHA=/^[a-f0-9]{40}$/i;
const ALLOWED_WORKFLOWS=Object.freeze({
  'Validate DTFSeeds Release Hardening':'build',
  'Responsive Layout CI':'responsive',
  'CodeQL Security':'security',
  'Publishability Contract CI':'content'
});
export function classifyRun(run, {sha, repository, now=Date.now()}){
  const category=ALLOWED_WORKFLOWS[run?.name];
  if(!category)return null;
  if(!SHA.test(sha)||run?.head_sha!==sha||run?.repository?.full_name!==repository)return null;
  if(run?.status!=='completed'||run?.conclusion!=='success'||!['push','pull_request','workflow_dispatch'].includes(run?.event))return null;
  const updated=Date.parse(run.updated_at);
  if(!Number.isFinite(updated)||updated>now||now-updated>30*86400000)return null;
  if(!Number.isSafeInteger(run.id)||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)return null;
  return {category,workflow:run.name,runId:run.id,attempt:run.run_attempt,sha,repository,
    url:`https://github.com/${repository}/actions/runs/${run.id}`,verifiedAt:new Date(updated).toISOString(),
    observation:'successful workflow run; job, artifact, and application coverage not attested'};
}
export async function collectWorkflowObservations({repository,sha,token,fetchImpl=fetch,now=Date.now()}){
  if(!/^[-\w.]+\/[-\w.]+$/.test(repository)||!SHA.test(sha))throw Error('Invalid repository or SHA');
  if(!token)throw Error('A GitHub token is required');
  const url=`https://api.github.com/repos/${repository}/actions/runs?head_sha=${sha}&per_page=100`;
  const response=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw Error(`GitHub Actions API failed: ${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body.workflow_runs))throw Error('Invalid workflow response');
  const observations=body.workflow_runs.map(run=>classifyRun(run,{sha,repository,now})).filter(Boolean);
  return {schemaVersion:1,repository,sha,generatedAt:new Date(now).toISOString(),
    interpretation:'observations only; do not promote into app-level passing evidence without job, artifact, route, and release validation',
    observations};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const repository=process.env.GITHUB_REPOSITORY;
  const sha=process.env.PROJECT_OS_TARGET_SHA||process.env.GITHUB_SHA;
  try{
    const report=await collectWorkflowObservations({repository,sha,token:process.env.GITHUB_TOKEN});
    const output=process.env.PROJECT_OS_WORKFLOW_REPORT||'.artifacts/project-os/workflow-observations.json';
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({repository,sha,observations:report.observations.length},null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
