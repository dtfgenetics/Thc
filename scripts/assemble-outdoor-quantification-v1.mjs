import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const parentPath = 'site/wordpress/education/outdoor-quantification-v1.json';
const manifestPath = 'site/wordpress/education/outdoor-quantification/manifest.json';
const writeMerged = process.argv.includes('--write');

const fail = (message) => { throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'));

function validateChapter(chapter, spec) {
  if (!chapter || typeof chapter !== 'object') fail(`${spec.id}: missing chapter object`);
  if (chapter.chapterId !== spec.id) fail(`${spec.id}: chapterId mismatch (${chapter.chapterId})`);
  if (chapter.chapterNumber !== spec.number) fail(`${spec.id}: chapterNumber mismatch (${chapter.chapterNumber})`);
  if (!chapter.chapterTitle || !chapter.learnerQuestion) fail(`${spec.id}: incomplete chapter metadata`);
  if (!Array.isArray(chapter.sourceContext) || chapter.sourceContext.length < 1) fail(`${spec.id}: source context required`);
  if (!Array.isArray(chapter.subtopics) || chapter.subtopics.length !== 4) fail(`${spec.id}: expected exactly four subtopics`);
  if (!chapter.fieldWorksheet?.title || !Array.isArray(chapter.fieldWorksheet.fields) || chapter.fieldWorksheet.fields.length < 8) fail(`${spec.id}: incomplete field worksheet`);

  const ids = new Set();
  let metrics = 0;
  for (const topic of chapter.subtopics) {
    if (!topic.id || ids.has(topic.id)) fail(`${spec.id}: duplicate or missing subtopic id ${topic.id}`);
    ids.add(topic.id);
    for (const key of ['lessonTitle', 'goal', 'decisionRule', 'confidenceCheck']) if (!topic[key]) fail(`${spec.id}/${topic.id}: missing ${key}`);
    if (!Array.isArray(topic.measure) || topic.measure.length < 3) fail(`${spec.id}/${topic.id}: expected at least three measurements`);
    if (!Array.isArray(topic.record) || topic.record.length < 5) fail(`${spec.id}/${topic.id}: record list too thin`);
    if (!Array.isArray(topic.compare) || topic.compare.length < 2) fail(`${spec.id}/${topic.id}: compare list too thin`);
    if (!Array.isArray(topic.interpret) || topic.interpret.length < 2) fail(`${spec.id}/${topic.id}: interpretation list too thin`);
    for (const measurement of topic.measure) {
      metrics += 1;
      for (const key of ['metric', 'unit', 'method', 'frequency']) if (!measurement[key]) fail(`${spec.id}/${topic.id}: incomplete measurement row (${key})`);
    }
  }
  return metrics;
}

const parent = await readJson(parentPath);
const manifest = await readJson(manifestPath);

if (parent?.schemaVersion !== 1 || parent?.id !== 'outdoor-quantification-v1') fail('Invalid parent quantification dataset');
if (parent.route !== '/learn/outdoor/') fail(`Unexpected parent route ${parent.route}`);
if (manifest?.schemaVersion !== 1 || manifest?.id !== 'outdoor-quantification-chapter-manifest') fail('Invalid chapter manifest');
if (manifest.route !== parent.route) fail('Manifest route does not match parent route');
if (!Array.isArray(manifest.chapters) || manifest.chapters.length !== 8) fail('Expected exactly eight Outdoor quantification chapters');

const ordered = [...manifest.chapters].sort((a, b) => a.number - b.number);
for (let i = 0; i < ordered.length; i += 1) {
  if (ordered[i].number !== i + 1) fail(`Chapter numbering is not contiguous at ${ordered[i].id}`);
  if (ordered[i].status !== 'completed') fail(`${ordered[i].id}: chapter is not marked completed`);
}

const parentSectionMap = new Map((parent.sections || []).map((section) => [section.chapterId, section]));
const assembledSections = [];
let metrics = 0;
let sources = 0;
let visualTargets = 0;
let calculationHelpers = 0;

for (const spec of ordered) {
  let chapter;
  if (spec.storage === 'inline-parent') {
    chapter = parentSectionMap.get(spec.id);
    if (!chapter) fail(`${spec.id}: inline chapter missing from parent dataset`);
  } else if (spec.storage === 'chapter-file') {
    const document = await readJson(spec.path);
    if (document?.schemaVersion !== 1) fail(`${spec.id}: invalid chapter-file schema`);
    if (document.parentId !== parent.id) fail(`${spec.id}: parentId mismatch`);
    if (document.route !== parent.route) fail(`${spec.id}: route mismatch`);
    chapter = document.chapter;
  } else {
    fail(`${spec.id}: unsupported storage type ${spec.storage}`);
  }

  metrics += validateChapter(chapter, spec);
  sources += chapter.sourceContext?.length || 0;
  visualTargets += chapter.visualTargets?.length || 0;
  calculationHelpers += chapter.calculationHelpers?.length || 0;
  assembledSections.push(chapter);
}

const chapterIds = assembledSections.map((chapter) => chapter.chapterId);
const subtopics = assembledSections.reduce((sum, chapter) => sum + chapter.subtopics.length, 0);
if (assembledSections.length !== 8) fail(`Expected 8 assembled sections, got ${assembledSections.length}`);
if (subtopics !== 32) fail(`Expected 32 assembled subtopics, got ${subtopics}`);
if (metrics < 100) fail(`Outdoor measurement set unexpectedly thin (${metrics} metrics)`);

const assembled = {
  ...parent,
  updatedAt: new Date().toISOString().slice(0, 10),
  coverage: {
    completedChapters: chapterIds,
    plannedChapters: []
  },
  sections: assembledSections,
  assembly: {
    manifest: manifestPath,
    chapterCount: assembledSections.length,
    subtopicCount: subtopics,
    metricCount: metrics,
    sourceCount: sources,
    visualTargetCount: visualTargets,
    calculationHelperCount: calculationHelpers
  }
};

const raw = JSON.stringify(assembled).toLowerCase();
for (const pattern of [
  /universal safe (?:pollen )?(?:distance|radius)/,
  /guarantees? zero pollen/,
  /rain(?:fall)? (?:total|amount) (?:equals|is) root-zone recharge/,
  /hours? of (?:direct )?sun (?:equals|is) dli/
]) if (pattern.test(raw)) fail(`Forbidden overclaim matched ${pattern}`);

if (writeMerged) await writeFile(join(ROOT, parentPath), `${JSON.stringify(assembled, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  valid: true,
  wroteMerged: writeMerged,
  parentPath,
  manifestPath,
  sections: assembledSections.length,
  subtopics,
  metrics,
  sources,
  visualTargets,
  calculationHelpers,
  chapterIds
}, null, 2));
