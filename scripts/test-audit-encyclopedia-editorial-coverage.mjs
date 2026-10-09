import assert from 'node:assert/strict';
import { auditLessons } from './audit-encyclopedia-editorial-coverage.mjs';

const good = {
  id: 'THC-ENC-001', number: 1, title: 'Evidence literacy',
  objective: 'Evaluate claims', coreScience: ['Explain mechanism'],
  evidenceLimits: ['Study context matters'], sourceNotes: ['Primary citation'],
  terms: [{ term: 'Bias', definition: 'Systematic error' }],
  crossLinks: '/learn/', cultivationRelevance: ['Record observations'],
  route: '/encyclopedia/evidence-literacy/', publicationAuthorized: true,
  __path: 'fixture/one.json'
};
const clean = auditLessons([good]);
assert.equal(clean.counts.lessons, 1);
assert.equal(clean.counts.withSources, 1);
assert.equal(clean.counts.publicationAuthorized, 1);
assert.deepEqual(clean.issues, []);

const broken = auditLessons([
  good,
  { ...good, __path: 'fixture/two.json', title: '', route: 'relative' },
  { ...good, id: 'THC-ENC-003', number: 2, __path: 'fixture/three.json' }
]);
for (const code of ['duplicate_id', 'duplicate_number', 'missing_title', 'route_not_absolute', 'id_number_mismatch']) {
  assert.ok(broken.issues.some(item => item.code === code), 'Missing: ' + code);
}
assert.equal(broken.scope, 'repository_canonical_lessons_only');
console.log('Encyclopedia editorial audit tests passed');
