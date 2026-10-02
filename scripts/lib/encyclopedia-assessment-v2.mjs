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


export function buildLessonRubricV1(lesson){
  const assessment=effectiveLessonAssessment(lesson);
  const objective=String(lesson?.objective||'').trim();
  const relevance=(Array.isArray(lesson?.cultivationRelevance)?lesson.cultivationRelevance:[lesson?.cultivationRelevance]).filter(Boolean);
  const records=(Array.isArray(lesson?.measureAndRecord)?lesson.measureAndRecord:[]).map(item=>typeof item==='string'?item:`${item?.field||'Record'}: ${item?.requirement||''}`).filter(Boolean);
  const misconceptions=(Array.isArray(lesson?.misconceptions)?lesson.misconceptions:[]).filter(Boolean);
  const limits=(Array.isArray(lesson?.evidenceLimits)?lesson.evidenceLimits:[lesson?.evidenceLimits]).filter(Boolean);
  const science=(Array.isArray(lesson?.coreScience)?lesson.coreScience:[]).filter(Boolean);
  const sources=(Array.isArray(lesson?.sourceNotes)?lesson.sourceNotes:[]).filter(Boolean);

  return {
    schemaVersion:1,
    lessonId:lesson?.id,
    assessmentVersion:assessment.version,
    reviewStatus:'pending_independent_review',
    publicationStatus:'internal_grading_support_not_public_answer_key',
    scoringScale:{
      totalPoints:12,
      criteria:[
        {id:'mechanism',points:3,label:'Mechanism or workflow accuracy',standard:`Answer addresses the lesson objective without contradicting the controlled science: ${objective}`},
        {id:'evidence',points:3,label:'Evidence and measurement selection',standard:`Answer selects relevant observations, measurements, samples, or records from the lesson rather than relying on appearance or memory alone. Expected evidence includes: ${records.slice(0,5).join(' | ')||'lesson-specific records'}`},
        {id:'misconception',points:2,label:'Misconception control',standard:`Answer identifies why the shortcut or misconception is unreliable. Representative misconception: ${String(misconceptions[0]||'unsupported certainty')}`},
        {id:'limits',points:2,label:'Uncertainty and applicability',standard:`Answer states at least one relevant evidence or transfer limit. Lesson limits include: ${limits.slice(0,2).join(' | ')||'context and measurement limitations'}`},
        {id:'verification',points:2,label:'Verification and revision logic',standard:`Answer defines what would be compared or re-measured after action and what finding would cause the interpretation to be revised. Practical context: ${relevance.slice(0,2).join(' | ')||'lesson-specific application'}`}
      ]
    },
    strongAnswerMustInclude:[
      objective,
      ...records.slice(0,3),
      limits[0]||'An explicit statement of uncertainty or applicability limits.',
      'A verification step with a measurable or observable endpoint.'
    ].filter(Boolean),
    commonReasoningErrors:[
      ...misconceptions.slice(0,3),
      'Treating one observation, one sample, or one reading as universal proof.',
      'Changing multiple variables without preserving a way to test which change mattered.',
      'Ignoring contradictory evidence or applicability limits.'
    ],
    reviewerEvidence:{
      coreScienceAnchors:science.slice(0,3),
      sourceAnchors:sources.slice(0,4)
    },
    prompts:assessment.prompts
  };
}


export function buildLessonAnswerRationalesV1(lesson){
  const assessment=effectiveLessonAssessment(lesson);
  const objective=String(lesson?.objective||'').trim();
  const science=(Array.isArray(lesson?.coreScience)?lesson.coreScience:[]).filter(Boolean);
  const relevance=(Array.isArray(lesson?.cultivationRelevance)?lesson.cultivationRelevance:[lesson?.cultivationRelevance]).filter(Boolean);
  const records=(Array.isArray(lesson?.measureAndRecord)?lesson.measureAndRecord:[]).map(item=>typeof item==='string'?item:`${item?.field||'Record'}: ${item?.requirement||''}`).filter(Boolean);
  const misconceptions=(Array.isArray(lesson?.misconceptions)?lesson.misconceptions:[]).filter(Boolean);
  const limits=(Array.isArray(lesson?.evidenceLimits)?lesson.evidenceLimits:[lesson?.evidenceLimits]).filter(Boolean);
  const normalizePoints=points=>points.map(point=>{
    const text=String(point||'').trim();
    if(text.length>=40) return text;
    return `${text} Treat this as a required evidence field with timing, method, and reviewer context so the learner's answer remains verifiable.`;
  });

  const mechanism=normalizePoints([
    `A strong answer should connect the response to the lesson objective: ${objective}`,
    science[0]||'Use the lesson mechanism rather than a memorized target.',
    science[1]||'Use a second lesson-specific science statement to support the explanation.',
    records[0]?`The most useful verification evidence includes ${records[0]}.`:'Choose an observation or measurement that directly tests the proposed mechanism.',
    limits[0]?`Keep this limit explicit: ${limits[0]}`:'State the conditions under which the conclusion may not transfer.'
  ].filter(Boolean));

  const misconception=normalizePoints([
    `The shortcut is unreliable because the lesson explicitly teaches a more conditional explanation.`,
    misconceptions[0]?`Representative misconception: ${String(misconceptions[0])}`:'Identify the unsupported shortcut in the claim.',
    science[0]||'Use the lesson science to explain why the shortcut can fail.',
    records[1]?`A useful discriminator is ${records[1]}.`:(records[0]?`A useful discriminator is ${records[0]}.`:'Name evidence that separates competing explanations.'),
    limits[0]?`Do not overextend the conclusion beyond this limit: ${limits[0]}`:'Preserve uncertainty when the evidence does not distinguish causes.'
  ].filter(Boolean));

  const applied=normalizePoints([
    relevance[0]?`In practice: ${relevance[0]}`:`Apply the lesson to a real cultivation decision without changing multiple variables at once.`,
    records[0]?`Record before action: ${records[0]}.`:'Record the baseline condition before acting.',
    records[1]?`Also record: ${records[1]}.`:'Record a second independent observation or measurement.',
    `After the action, repeat the same measurement or observation so the comparison is valid.`,
    limits[0]?`Revise the interpretation if the result conflicts with the lesson limit or the expected response: ${limits[0]}`:'Revise the interpretation when follow-up evidence contradicts the original hypothesis.'
  ].filter(Boolean));

  return {
    schemaVersion:1,
    lessonId:lesson?.id,
    assessmentVersion:assessment.version,
    status:'source-grounded-learner-facing',
    rationales:[
      {promptIndex:0,title:'Mechanism / workflow rationale',points:mechanism},
      {promptIndex:1,title:'Misconception rationale',points:misconception},
      {promptIndex:2,title:'Applied verification rationale',points:applied}
    ]
  };
}
