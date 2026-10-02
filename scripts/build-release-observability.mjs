import fs from 'node:fs';
import path from 'node:path';

const args=Object.fromEntries(process.argv.slice(2).map((arg)=>{
  const [key,...rest]=arg.replace(/^--/,'').split('=');
  return [key,rest.join('=')||true];
}));

const sha=String(process.env.RELEASE_SOURCE_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
const runId=String(process.env.RELEASE_RUN_ID||process.env.GITHUB_RUN_ID||'').trim();
const runAttempt=String(process.env.RELEASE_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT||'').trim();
const eventName=String(process.env.RELEASE_EVENT_NAME||process.env.GITHUB_EVENT_NAME||'').trim();
const mode=String(process.env.RELEASE_MODE||'auto').trim();
const checkpointTag=String(process.env.RELEASE_CHECKPOINT_TAG||'dtfseeds-production').trim();
const site=String(process.env.RELEASE_SITE||'https://dtfseeds.com').replace(/\/+$/,'');
const checkpointOutcome=String(process.env.RELEASE_CHECKPOINT_OUTCOME||'skipped').trim();
const enforceOutcome=String(process.env.RELEASE_ENFORCE_OUTCOME||'skipped').trim();
const freshness=String(process.env.RELEASE_FRESHNESS||'unknown').trim();
const verifyFreshness=String(process.env.RELEASE_VERIFY_FRESHNESS||'unknown').trim();

if(!/^[0-9a-f]{40}$/.test(sha)) throw new Error('RELEASE_SOURCE_SHA/GITHUB_SHA must be a full 40-character Git SHA.');

const parseBool=(value)=>String(value||'false').toLowerCase()==='true';
const normOutcome=(value)=>{
  const normalized=String(value||'skipped').trim().toLowerCase();
  return ['success','failure','cancelled','skipped'].includes(normalized)?normalized:'unknown';
};

const laneDefs=[
  ['wordpress','RELEASE_WANT_WORDPRESS','RELEASE_WP_PUBLISH','RELEASE_WP_VERIFY'],
  ['education','RELEASE_WANT_EDUCATION','RELEASE_EDU_PUBLISH','RELEASE_EDU_VERIFY'],
  ['harvestOutdoor','RELEASE_WANT_HARVEST_OUTDOOR','RELEASE_HARVEST_OUTDOOR_PUBLISH','RELEASE_HARVEST_OUTDOOR_VERIFY'],
  ['publicSuite','RELEASE_WANT_PUBLIC','RELEASE_PUBLIC_PUBLISH','RELEASE_PUBLIC_VERIFY']
];

function phase(state,evidence,detail=''){
  return {state,evidence,detail};
}

const lanes={};
for(const [id,wantKey,publishKey,verifyKey] of laneDefs){
  const selected=parseBool(process.env[wantKey]);
  const publishOutcome=normOutcome(process.env[publishKey]);
  const verifyOutcome=normOutcome(process.env[verifyKey]);

  let deployed=phase('skipped',publishOutcome,'Lane was not selected.');
  let liveVerified=phase('skipped',verifyOutcome,'Lane was not selected.');
  let tested=phase('skipped','not-observed','Lane was not selected.');
  let packaged=phase('skipped','not-observed','Lane was not selected.');

  if(selected){
    tested=publishOutcome==='success'
      ? phase('observed','workflow-aggregate','Successful child/publish workflow owns its candidate validation evidence.')
      : phase(publishOutcome==='failure'?'failed':'pending','not-observed','No successful aggregate validation evidence observed by the gateway.');
    packaged=publishOutcome==='success'
      ? phase('observed','workflow-aggregate','Successful child/publish workflow owns its package assembly evidence.')
      : phase(publishOutcome==='failure'?'failed':'pending','not-observed','No successful package evidence observed by the gateway.');
    deployed=publishOutcome==='success'
      ? phase('verified','success','Production publication step succeeded.')
      : phase(publishOutcome==='failure'?'failed':publishOutcome,publishOutcome,'Production publication did not complete successfully.');
    liveVerified=verifyOutcome==='success'
      ? phase('verified','success','Post-deploy visitor/runtime verification succeeded.')
      : phase(verifyOutcome==='failure'?'failed':verifyOutcome,verifyOutcome,'Post-deploy verification did not complete successfully.');
  }

  const state=!selected?'not-selected'
    : publishOutcome!=='success'?'publication-incomplete'
    : verifyOutcome!=='success'?'verification-incomplete'
    :'live-verified';

  lanes[id]={
    selected,
    state,
    source:phase('verified',sha,'Gateway source revision.'),
    tested,
    packaged,
    deployed,
    liveVerified,
    publishOutcome,
    verifyOutcome
  };
}

const selected=Object.values(lanes).filter((lane)=>lane.selected);
const selectedAllLive=selected.length>0&&selected.every((lane)=>lane.liveVerified.state==='verified');
const superseded=freshness==='false'||verifyFreshness==='false';
const checkpointVerified=checkpointOutcome==='success'&&enforceOutcome==='success'&&selectedAllLive&&!superseded;

const overallState=superseded?'superseded'
  : selected.length===0?'no-production-lanes'
  : checkpointVerified?'live-verified-checkpointed'
  : selectedAllLive?'live-verified'
  : selected.some((lane)=>lane.deployed.state==='failed'||lane.liveVerified.state==='failed')?'failed'
  :'incomplete';

let releasePlan=null;
const rawPlan=String(process.env.RELEASE_PLAN_JSON||'').trim();
if(rawPlan){
  try{releasePlan=JSON.parse(rawPlan);}catch{releasePlan={unparsed:rawPlan};}
}

const report={
  schemaVersion:1,
  contract:'configuration/release-observability-contract.json',
  generatedAt:new Date().toISOString(),
  site,
  run:{
    repository:String(process.env.GITHUB_REPOSITORY||'dtfgenetics/Thc'),
    sourceSha:sha,
    id:runId||null,
    attempt:runAttempt||null,
    event:eventName||null,
    mode,
    url:runId?('https://github.com/'+String(process.env.GITHUB_REPOSITORY||'dtfgenetics/Thc')+'/actions/runs/'+runId):null
  },
  freshness:{beforePublish:freshness,beforeVerification:verifyFreshness,superseded},
  lanes,
  enforcement:{outcome:enforceOutcome},
  checkpoint:{
    tag:checkpointTag,
    outcome:checkpointOutcome,
    sourceSha:checkpointVerified?sha:null,
    verified:checkpointVerified
  },
  releasePlan,
  overallState,
  semantics:{
    productionSuccessRequiresLiveVerification:true,
    mergeSuccessIsProductionSuccess:false,
    aggregateChildEvidenceIsExactStageProof:false
  }
};

const output=String(args.output||process.env.RELEASE_OBSERVABILITY_OUTPUT||'').trim();
if(output){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));

if(args.check){
  if(selected.some((lane)=>lane.liveVerified.state==='verified'&&lane.deployed.state!=='verified')){
    throw new Error('Invalid release evidence: live verification cannot be verified without a verified deployment.');
  }
  if(report.checkpoint.verified&&!selectedAllLive){
    throw new Error('Invalid release evidence: checkpoint cannot advance without all selected lanes live-verified.');
  }
}
