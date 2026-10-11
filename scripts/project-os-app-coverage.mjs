// Explicit application attribution gate. Workflow names alone NEVER establish app coverage.
export function assessAppWorkflowCoverage(app, observation, {jobs=[],artifacts=[]}={}) {
  const reasons=[];
  if(!app?.id || !app?.repository || !observation?.sha || observation.repository!==app.repository) reasons.push('repository-or-app-mismatch');
  if(observation?.category!=='build') reasons.push('not-build-observation');
  const qualifying=jobs.filter(job=>job?.status==='completed' && job?.conclusion==='success' &&
    Array.isArray(job?.appIds) && job.appIds.includes(app?.id) && job?.headSha===observation?.sha &&
    job?.runId===observation?.runId && job?.runAttempt===observation?.attempt);
  if(qualifying.length===0) reasons.push('no-successful-app-scoped-job');
  const evidence=artifacts.filter(a=>a?.appId===app?.id && a?.headSha===observation?.sha &&
    a?.runId===observation?.runId && a?.runAttempt===observation?.attempt &&
    a?.expired===false && typeof a?.digest==='string' && /^sha256:[a-f0-9]{64}$/i.test(a.digest));
  if(evidence.length===0) reasons.push('no-matching-immutable-artifact');
  return {appId:app?.id??null,category:'build',verified:reasons.length===0,
    reasons,jobIds:qualifying.map(j=>j.id),artifactIds:evidence.map(a=>a.id)};
}
// GitHub job names and artifact names are intentionally not treated as trusted appIds.
// A separate, trusted attestation producer must establish the appId/commit/job/artifact binding.
