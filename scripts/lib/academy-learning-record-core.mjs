// Pure Academy learning-record core. This does not issue credentials or trust client completion.
export const RECORD_VERSION = 1;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
const eventKinds = new Set(['lesson_viewed','lesson_self_completed','lesson_reopened','practice_attempted']);
export function newLearningRecord(learnerId) {
  if (!id(learnerId)) throw new TypeError('Invalid learner identifier');
  return {version:RECORD_VERSION, learnerId, events:[]};
}
export function appendLearningEvent(record, event) {
  if (!record || record.version !== RECORD_VERSION || !id(record.learnerId) || !Array.isArray(record.events)) throw new TypeError('Invalid learning record');
  if (!event || !eventKinds.has(event.type) || !id(event.courseId) || !id(event.lessonId) || !id(event.eventId)) throw new TypeError('Invalid learning event');
  if (record.events.some(existing => existing.eventId === event.eventId)) return record;
  if (typeof event.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(event.at) || !Number.isFinite(Date.parse(event.at))) throw new TypeError('Invalid event timestamp');
  const safe={eventId:event.eventId,type:event.type,courseId:event.courseId,lessonId:event.lessonId,at:event.at};
  if (event.type === 'practice_attempted') {
    if (!Number.isInteger(event.score) || event.score<0 || !Number.isInteger(event.total) || event.total<1 || event.score>event.total) throw new TypeError('Invalid practice score');
    safe.score=event.score;safe.total=event.total;
  }
  return {...record,events:[...record.events,safe]};
}
export function lessonSummary(record, courseId, lessonId) {
  if (!id(courseId) || !id(lessonId)) throw new TypeError('Invalid lesson key');
  const events=(record?.events||[]).filter(e=>e.courseId===courseId&&e.lessonId===lessonId);
  let viewed=false,selfCompleted=false,latestPractice=null;
  for (const e of events) {
    if (e.type==='lesson_viewed') viewed=true;
    if (e.type==='lesson_self_completed') selfCompleted=true;
    if (e.type==='lesson_reopened') selfCompleted=false;
    if (e.type==='practice_attempted') latestPractice={score:e.score,total:e.total,at:e.at};
  }
  return {viewed,selfCompleted,latestPractice,credentialEligible:false};
}
// Only an authenticated server-side assessment/credential authority may determine credential eligibility.
