#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const ENC=path.join(ROOT,'content','encyclopedia');
const contractPath=path.join(ROOT,'configuration','encyclopedia-lifecycle-contract.json');
const strict=process.argv.includes('--strict');
const writeReport=process.argv.includes('--write-report');
const errors=[];
const warnings=[];
const rows=[];

const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const canonicalRoute=n=>`/learn/encyclopedia/thc-enc-${String(n).padStart(3,'0')}/`;

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(file));
    else if(entry.isFile()&&/^thc-enc-\d+\.json$/i.test(entry.name))out.push(file);
  }
  return out;
}
function text(value){return String(value??'').toLowerCase();}
function addWarning(id,file,code,message){warnings.push({id,file:path.relative(ROOT,file),code,message});}
function addError(id,file,code,message){errors.push({id,file:path.relative(ROOT,file),code,message});}

for(const file of walk(ENC).sort()){
  let lesson;
  try{lesson=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){addError('<unknown>',file,'invalid_json',error.message);continue;}
  if(!/^THC-ENC-\d{3,}$/.test(lesson.id||'')){addError(lesson.id||'<missing>',file,'invalid_id','Lesson ID is missing or malformed.');continue;}
  const number=Number(lesson.number??String(lesson.id).match(/(\d+)$/)?.[1]);
  const expectedId=`THC-ENC-${String(number).padStart(3,'0')}`;
  if(lesson.id!==expectedId)addError(lesson.id,file,'id_number_mismatch',`Expected ${expectedId} from lesson number ${number}.`);

  const rc=lesson.reviewControl||{};
  if(typeof lesson.publicationAuthorized==='boolean'&&typeof rc.publicationAuthorized==='boolean'&&lesson.publicationAuthorized!==rc.publicationAuthorized){
    addError(lesson.id,file,'publication_flag_conflict','Top-level publicationAuthorized conflicts with reviewControl.publicationAuthorized.');
  }

  const publicationAuthorized=lesson.publicationAuthorized===true||rc.publicationAuthorized===true;
  const statusText=[lesson.assessmentStatus,lesson.status,rc.websiteAction,rc.externalReview,rc.releaseTimeReview].map(text).join(' | ');
  if(publicationAuthorized&&/(publication|publish|approval)[^.|\n]{0,28}(not authorized|unauthorized)/.test(statusText)){
    addWarning(lesson.id,file,'stale_status_text','Human-readable status text says publication/approval is not authorized while publicationAuthorized=true.');
  }
  if(publicationAuthorized&&/approval\/publication:\s*not authorized/.test(statusText)){
    addWarning(lesson.id,file,'stale_completion_record','Completion/status record still says approval/publication is not authorized.');
  }

  const expectedRoute=canonicalRoute(number);
  const legacyRoute=String(lesson.route||'').trim();
  if(legacyRoute&&legacyRoute!==expectedRoute){
    addWarning(lesson.id,file,'legacy_route_metadata',`Stored route "${legacyRoute}" differs from canonical public route "${expectedRoute}".`);
  }

  const independentApproval=rc.independentApproval===true;
  if(independentApproval&&/pending_not_recorded|not[_ -]?started/.test(text(rc.externalReview))){
    addError(lesson.id,file,'independent_review_conflict','independentApproval=true conflicts with an external review state that is still pending/not started.');
  }

  let scienceReview='in_review';
  if(independentApproval)scienceReview='independently_approved';
  else if(/complete|reviewed/.test(text(rc.secondaryEvidenceReview)||text(rc.evidenceControl)))scienceReview='reviewed_with_limitations';
  else if(/not_started/.test(text(rc.evidenceControl)))scienceReview='not_started';

  let assessment='not_started';
  if(lesson.assessmentDesign||Array.isArray(lesson.knowledgeCheck))assessment='draft';
  if(/rationale/.test(text(lesson.assessmentStatus))&&!/pending/.test(text(lesson.assessmentStatus)))assessment='rationale_complete';
  if(/independent.*pending|pending.*independent/.test(text(lesson.assessmentStatus))||/pending_independent_review/.test(text(lesson.assessmentDesign?.answerRationaleStatus)))assessment='independent_review_pending';

  rows.push({
    id:lesson.id,
    number,
    canonicalRoute:expectedRoute,
    legacyRoute:legacyRoute||null,
    publication:publicationAuthorized?'authorized':'not_authorized',
    scienceReview,
    assessment,
    independentApproval,
    issues:0
  });
}

const issueCounts=new Map();
for(const item of [...errors,...warnings])issueCounts.set(item.id,(issueCounts.get(item.id)||0)+1);
for(const row of rows)row.issues=issueCounts.get(row.id)||0;

const report={
  schemaVersion:1,
  contract:contract.id,
  generatedAt:new Date().toISOString(),
  lessonCount:rows.length,
  errorCount:errors.length,
  warningCount:warnings.length,
  cleanLessonCount:rows.filter(x=>x.issues===0).length,
  lifecycleCounts:{
    publication:Object.groupBy?Object.fromEntries(Object.entries(Object.groupBy(rows,x=>x.publication)).map(([k,v])=>[k,v.length])):{},
    scienceReview:Object.groupBy?Object.fromEntries(Object.entries(Object.groupBy(rows,x=>x.scienceReview)).map(([k,v])=>[k,v.length])):{},
    assessment:Object.groupBy?Object.fromEntries(Object.entries(Object.groupBy(rows,x=>x.assessment)).map(([k,v])=>[k,v.length])):{}
  },
  errors,
  warnings
};

if(writeReport){
  const out=path.join(ROOT,'data','encyclopedia-lifecycle-audit.json');
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(`Wrote ${path.relative(ROOT,out)}`);
}
for(const item of errors)console.error(`ERROR ${item.id} [${item.code}] ${item.message}`);
for(const item of warnings.slice(0,80))console.warn(`WARN ${item.id} [${item.code}] ${item.message}`);
if(warnings.length>80)console.warn(`WARN … ${warnings.length-80} additional lifecycle warning(s) omitted from console output.`);
console.log(`Encyclopedia lifecycle audit: ${rows.length} lessons · ${errors.length} error(s) · ${warnings.length} warning(s) · ${report.cleanLessonCount} clean.`);
if(errors.length||(strict&&warnings.length))process.exit(1);
