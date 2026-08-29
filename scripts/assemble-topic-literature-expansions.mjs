import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--write');
const outputPath = outputIndex >= 0 && args[outputIndex + 1]
  ? resolve(args[outputIndex + 1])
  : '/tmp/dtf-topic-literature-expanded.json';
const basePath = resolve(process.env.TOPIC_LITERATURE_BASE || 'site/wordpress/education/topic-literature.json');
const expansionPath = resolve(process.env.TOPIC_LITERATURE_EXPANSIONS || 'site/wordpress/education/topic-literature-expansions.json');

const base = JSON.parse(await readFile(basePath, 'utf8'));
const expansionCatalog = JSON.parse(await readFile(expansionPath, 'utf8'));
if (!Array.isArray(base.topics) || base.topics.length < 10) throw new Error('Base topic literature is incomplete');
if (!Array.isArray(expansionCatalog.expansions) || !expansionCatalog.expansions.length) throw new Error('Topic literature expansion catalog is empty');

const result = structuredClone(base);
const topicById = new Map(result.topics.map((topic) => [topic.id, topic]));
const mergeReport = [];

for (const expansion of expansionCatalog.expansions) {
  const topic = topicById.get(expansion.topicId);
  if (!topic) throw new Error(`Expansion references unknown topic: ${expansion.topicId}`);
  if (!Array.isArray(expansion.sections) || !expansion.sections.length) throw new Error(`Expansion ${expansion.topicId} has no sections`);

  const existingHeadings = new Set((topic.sections || []).map((section) => String(section.heading || '').trim().toLowerCase()));
  let addedSections = 0;
  for (const section of expansion.sections) {
    const heading = String(section.heading || '').trim();
    if (!heading) throw new Error(`Expansion ${expansion.topicId} contains an untitled section`);
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length < 2) throw new Error(`Expansion section ${heading} needs at least two paragraphs`);
    if (!Array.isArray(section.checkpoints) || section.checkpoints.length < 3) throw new Error(`Expansion section ${heading} needs at least three checkpoints`);
    const key = heading.toLowerCase();
    if (existingHeadings.has(key)) continue;
    topic.sections.push(section);
    existingHeadings.add(key);
    addedSections += 1;
  }

  topic.keywords = [...new Set([...(topic.keywords || []), ...(expansion.keywords || [])])];
  if (Array.isArray(expansion.references) && expansion.references.length) {
    topic.references = [...(topic.references || []), ...expansion.references];
  }

  const minimum = Number(expansion.minimumSectionsAfterMerge || 0);
  if (minimum && topic.sections.length < minimum) {
    throw new Error(`Expanded topic ${topic.id} has ${topic.sections.length} sections; expected at least ${minimum}`);
  }

  mergeReport.push({
    topicId: topic.id,
    addedSections,
    totalSections: topic.sections.length,
    keywordCount: topic.keywords.length,
    referenceCount: (topic.references || []).length
  });
}

result.schemaVersion = Math.max(Number(result.schemaVersion || 1), 1);
result.expansionMetadata = {
  assembledAt: new Date().toISOString(),
  source: expansionPath,
  topicsExpanded: mergeReport.length
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, topics: result.topics.length, expansions: mergeReport }, null, 2));
