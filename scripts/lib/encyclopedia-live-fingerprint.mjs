import { createHash } from 'node:crypto';

export function encyclopediaFingerprintPayload(lesson){
  return {
    id:lesson?.id,
    title:lesson?.title,
    objective:lesson?.objective,
    terms:lesson?.terms||lesson?.termsToKnow||[],
    coreScience:lesson?.coreScience||[],
    cultivationRelevance:lesson?.cultivationRelevance||[],
    measureAndRecord:lesson?.measureAndRecord||lesson?.measurements||[],
    misconceptions:lesson?.misconceptions||[],
    evidenceLimits:lesson?.evidenceLimits||[],
    crossLinks:lesson?.crossLinks||[],
    sourceNotes:lesson?.sourceNotes||[]
  };
}

export function canonicalEncyclopediaFingerprint(lesson){
  return createHash('sha256')
    .update(JSON.stringify(encyclopediaFingerprintPayload(lesson)))
    .digest('hex');
}
