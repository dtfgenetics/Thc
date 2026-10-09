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
for (const code of ['duplicate_id', 'duplicate_number', 'missing_title', 'invalid_route', 'id_number_mismatch']) {
  assert.ok(broken.issues.some(item => item.code === code), 'Missing: ' + code);
}
const routing = auditLessons([
  good,
  { ...good, id: 'THC-ENC-002', number: 2, route: '/encyclopedia/evidence-literacy', __path: 'fixture/second.json' },
  { ...good, id: 'THC-ENC-003', number: 3, route: '//external/path', __path: 'fixture/third.json' },
  { ...good, id: 'THC-ENC-004', number: 4, route: '/valid/?unexpected=1', __path: 'fixture/fourth.json' }
]);
assert.ok(routing.issues.some(item => item.code === 'duplicate_route'));
assert.equal(routing.issues.filter(item => item.code === 'invalid_route').length, 2);
assert.equal(broken.scope, 'repository_canonical_lessons_only');
console.log('Encyclopedia editorial audit tests passed');
