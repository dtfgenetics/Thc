#!/usr/bin/env node
/**
 * Read-only, reproducible editorial coverage report.
 * Uses the same canonical loader as the production encyclopedia pipeline.
 * Does not treat a manuscript count as evidence of live publication.
 */
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

export function auditLessons(lessons) {
  const issues = [];
  const seenIds = new Map();
  const seenNumbers = new Map();
  const seenRoutes = new Map();
  const counts = {
    lessons: lessons.length, withObjective: 0, withCoreScience: 0,
    withEvidenceLimits: 0, withSources: 0, withTerminology: 0,
    withCrossLinks: 0, withPracticalContext: 0, publicationAuthorized: 0
  };
  for (const lesson of lessons) {
    const id = lesson.id;
    const label = typeof id === 'string' ? id : '(missing ID)';
    const location = lesson.__path ?? '(unknown source)';
    const add = (code, detail) => issues.push({ code, id: label, path: location, detail });
    if (!/^THC-ENC-\d{3,}$/.test(label)) add('invalid_id', 'Expected THC-ENC-###');
    if (!Number.isInteger(lesson.number) || lesson.number < 1) add('invalid_number', 'Expected positive integer');
    if (seenIds.has(label)) add('duplicate_id', 'Also in ' + seenIds.get(label));
    else seenIds.set(label, location);
    if (Number.isInteger(lesson.number)) {
      if (seenNumbers.has(lesson.number)) add('duplicate_number', 'Also in ' + seenNumbers.get(lesson.number));
      else seenNumbers.set(lesson.number, location);
      if (label !== 'THC-ENC-' + String(lesson.number).padStart(3, '0')) add('id_number_mismatch', 'ID does not match number');
    }
    if (typeof lesson.title !== 'string' || !lesson.title.trim()) add('missing_title', 'Missing lesson title');
    if (typeof lesson.objective === 'string' && lesson.objective.trim()) counts.withObjective++;
    if (Array.isArray(lesson.coreScience) && lesson.coreScience.some(x => typeof x === 'string' && x.trim())) counts.withCoreScience++;
    if (Array.isArray(lesson.evidenceLimits) && lesson.evidenceLimits.length) counts.withEvidenceLimits++;
    if (Array.isArray(lesson.sourceNotes) && lesson.sourceNotes.length) counts.withSources++;
    if (Array.isArray(lesson.terms) && lesson.terms.length) counts.withTerminology++;
    if ((typeof lesson.crossLinks === 'string' && lesson.crossLinks.trim()) || (Array.isArray(lesson.crossLinks) && lesson.crossLinks.length)) counts.withCrossLinks++;
    if (Array.isArray(lesson.cultivationRelevance) && lesson.cultivationRelevance.length) counts.withPracticalContext++;
    if (lesson.publicationAuthorized === true) counts.publicationAuthorized++;
    if (typeof lesson.route === 'string' && lesson.route.trim()) {
      const route = lesson.route.trim();
      if (!route.startsWith('/') || route.startsWith('//') || /[?#]/.test(route)) {
        add('invalid_route', 'Expected root-relative pathname without query or fragment');
      } else {
        const normalizedRoute = route.replace(/\/+$/, '') || '/';
        if (seenRoutes.has(normalizedRoute)) add('duplicate_route', 'Also in ' + seenRoutes.get(normalizedRoute));
        else seenRoutes.set(normalizedRoute, location);
      }
    }
  }
  issues.sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
  return { generatedAt: new Date().toISOString(), scope: 'repository_canonical_lessons_only', counts, issues,
    disclaimer: 'This report does not verify deployed routes, factual accuracy, source validity, image availability, or human editorial approval.' };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const report = auditLessons(readCanonicalEncyclopediaLessons(process.cwd()));
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--strict') && report.issues.length) process.exitCode = 1;
}
