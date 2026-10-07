#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  encyclopediaLessonId,
  encyclopediaLessonNumber,
  encyclopediaLessonRoute,
  encyclopediaLessonSlug,
  isCanonicalEncyclopediaLessonRoute
} from './lib/encyclopedia-routes.mjs';

assert.equal(encyclopediaLessonNumber('THC-ENC-001'),1);
assert.equal(encyclopediaLessonNumber(420),420);
assert.equal(encyclopediaLessonId(421),'THC-ENC-421');
assert.equal(encyclopediaLessonSlug('THC-ENC-041'),'thc-enc-041');
assert.equal(encyclopediaLessonRoute('THC-ENC-041'),'/learn/encyclopedia/thc-enc-041/');
assert.equal(isCanonicalEncyclopediaLessonRoute('/learn/encyclopedia/thc-enc-420/',420),true);
assert.equal(isCanonicalEncyclopediaLessonRoute('/encyclopedia/some-title',420),false);
assert.throws(()=>encyclopediaLessonNumber('not-an-encyclopedia-id'));

console.log('Encyclopedia permanent-route contract PASS.');
