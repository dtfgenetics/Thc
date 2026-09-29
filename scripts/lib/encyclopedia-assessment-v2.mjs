export function buildLessonAssessmentV2(lesson){
  const title=String(lesson?.title||'Untitled lesson');
  const objective=String(lesson?.objective||'apply the lesson objective').replace(/\.$/,'');
  const misconceptions=Array.isArray(lesson?.misconceptions)?lesson.misconceptions:[];
  const misconception=String(misconceptions[0]||'A common shortcut is reliable without context.');
  const relevance=String((Array.isArray(lesson?.cultivationRelevance)?lesson.cultivationRelevance:[lesson?.cultivationRelevance]).filter(Boolean)[0]||`Apply the principles of ${title} to a cultivation decision.`);
  const rawRecords=Array.isArray(lesson?.measureAndRecord)?lesson.measureAndRecord:[];
  const recordSummary=rawRecords.map(item=>typeof item==='string'?item:`${item?.field||'Record'}: ${item?.requirement||''}`).filter(Boolean).join('; ');
  const format=String(lesson?.primaryFormat||'Science lesson').toLowerCase();

  let first;
  if(format.includes('comparison')){
    first=`In "${title}", what measurements and records would you use to compare the alternatives fairly, and which outcome would count as meaningful rather than merely different?`;
  }else if(format.includes('procedure')){
    first=`For "${title}", put the decision in operational order: what must be verified before action, what evidence must be recorded during the work, and what condition would require a hold or escalation?`;
  }else if(format.includes('data')||format.includes('qa')){
    first=`For "${title}", which records are required to make the result traceable and decision-ready, and which missing field would most weaken the conclusion?`;
  }else{
    first=`For "${title}", explain the mechanism behind this objective: ${objective}. Which observation or measurement would best test whether that mechanism is operating in the real crop?`;
  }

  return {
    version:2,
    pattern:'mechanism_or_workflow + misconception_challenge + applied_verification',
    prompts:[
      first,
      `A learner claims, "${misconception}" Use the lesson's science and evidence limits to explain why that claim is unreliable, then name one observation or measurement that could separate the competing explanations.`,
      `Applied case — ${relevance} Build a verification plan using the lesson's record set (${recordSummary||'relevant measurements and records'}). What would you compare before and after the action, and what result would make you revise the original interpretation?`
    ],
    scoringIntent:'Require lesson-specific evidence, not memorized universal targets.'
  };
}

export function effectiveLessonAssessment(lesson){
  const existing=Array.isArray(lesson?.knowledgeCheck)?lesson.knowledgeCheck.filter(Boolean):[];
  if(existing.length>=3) return {
    version:Number(lesson?.assessmentDesign?.version||2),
    pattern:lesson?.assessmentDesign?.pattern||'stored_lesson_specific',
    prompts:existing,
    scoringIntent:lesson?.assessmentDesign?.scoringIntent||'Require lesson-specific evidence.'
  };
  return buildLessonAssessmentV2(lesson);
}
