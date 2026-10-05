#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectPublicLessonIds } from './lib/academy-public-scope.mjs';
import { lessonAssetBlocks, lessonPrimaryVisuals, assetIdFromBlock } from './lib/academy-public-assets.mjs';

const moduleIds = ['MOD-A', 'MOD-B', 'MOD-C', 'MOD-D'];
const modules = new Map(moduleIds.map((id, moduleIndex) => [id, {
  id,
  lessons: Array.from({ length: moduleIndex === 0 ? 4 : 3 }, (_, lessonIndex) => `LESSON-${moduleIndex + 1}-${lessonIndex + 1}`)
}]));
const lessonIds = [...modules.values()].flatMap(module => module.lessons);
const release = {
  courseId: 'COURSE-LH-TECH1-002',
  publicScope: {
    modules: moduleIds,
    releasedModuleCount: 4,
    releasedLessonCount: 13,
    studentSources: lessonIds.map(id => `content/lessons/${id}.json`)
  }
};

assert.deepEqual(collectPublicLessonIds(release, modules), lessonIds);

const duplicateModules = new Map(modules);
duplicateModules.set('MOD-D', { id: 'MOD-D', lessons: ['LESSON-1-1'] });
assert.throws(() => collectPublicLessonIds(release, duplicateModules), /duplicate public lesson/);

const incompleteRelease = structuredClone(release);
incompleteRelease.publicScope.studentSources.pop();
assert.throws(() => collectPublicLessonIds(incompleteRelease, modules), /not authorized by the public release/);

const wrongCountRelease = structuredClone(release);
wrongCountRelease.publicScope.releasedLessonCount = 4;
assert.throws(() => collectPublicLessonIds(wrongCountRelease, modules), /does not match manifest/);


const assetLesson = {
  content: {
    blocks: [
      { type: 'image', assetId: 'VIS-COURSE-001', src: '/assets/course3/course-owned.webp' },
      { type: 'resource', extensions: { assetId: 'JOB-AID-001' }, href: '/assets/course3/job-aid.webp' }
    ],
    extensions: {
      primaryVisuals: [
        { type: 'image', assetId: 'VIS-FOUNDATION-001', src: '/assets/course3/foundation.webp' },
        { type: 'image', assetId: 'VIS-COURSE-001', src: '/assets/course3/course-owned.webp' }
      ]
    }
  }
};
assert.deepEqual(lessonPrimaryVisuals(assetLesson).map(assetIdFromBlock), ['VIS-FOUNDATION-001']);
assert.deepEqual(lessonAssetBlocks(assetLesson).map(assetIdFromBlock), ['VIS-COURSE-001', 'JOB-AID-001', 'VIS-FOUNDATION-001']);

console.log('Technician I public source-scope regression checks passed.');
