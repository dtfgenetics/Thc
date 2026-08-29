import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--write');
const outputPath = outputIndex >= 0 && args[outputIndex + 1]
  ? resolve(args[outputIndex + 1])
  : '/tmp/dtf-topic-literature-expanded.json';
const basePath = resolve(process.env.TOPIC_LITERATURE_BASE || 'site/wordpress/education/topic-literature.json');
const primaryExpansionPath = resolve(process.env.TOPIC_LITERATURE_EXPANSIONS || 'site/wordpress/education/topic-literature-expansions.json');
const coreExpansionPath = resolve(process.env.TOPIC_LITERATURE_CORE_EXPANSIONS || 'site/wordpress/education/topic-literature-expansions-core-v1.json');

const base = JSON.parse(await readFile(basePath, 'utf8'));
if (!Array.isArray(base.topics) || base.topics.length < 10) throw new Error('Base topic literature is incomplete');

const expansionPaths = [primaryExpansionPath];
if (existsSync(coreExpansionPath)) expansionPaths.push(coreExpansionPath);
const expansionCatalogs = [];
for (const path of expansionPaths) {
  const catalog = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(catalog.expansions) || !catalog.expansions.length) {
    throw new Error(`Topic literature expansion catalog is empty: ${path}`);
  }
  expansionCatalogs.push({ path, catalog });
}

const result = structuredClone(base);
const topicById = new Map(result.topics.map((topic) => [topic.id, topic]));
const mergeReport = [];
const seenExpansionTopics = new Set();
const referenceKey = (reference) => typeof reference === 'string'
  ? `string:${reference.trim()}`
  : `json:${JSON.stringify(reference)}`;

for (const { path, catalog } of expansionCatalogs) {
  for (const expansion of catalog.expansions) {
    if (seenExpansionTopics.has(expansion.topicId)) {
      throw new Error(`Duplicate expansion ownership for topic ${expansion.topicId} across catalogs`);
    }
    seenExpansionTopics.add(expansion.topicId);
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
      const references = [...(topic.references || [])];
      const seenReferences = new Set(references.map(referenceKey));
      for (const reference of expansion.references) {
        const key = referenceKey(reference);
        if (seenReferences.has(key)) continue;
        references.push(reference);
        seenReferences.add(key);
      }
      topic.references = references;
    }

    const minimum = Number(expansion.minimumSectionsAfterMerge || 0);
    if (minimum && topic.sections.length < minimum) {
      throw new Error(`Expanded topic ${topic.id} has ${topic.sections.length} sections; expected at least ${minimum}`);
    }

    mergeReport.push({
      topicId: topic.id,
      catalog: path,
      addedSections,
      totalSections: topic.sections.length,
      keywordCount: topic.keywords.length,
      referenceCount: (topic.references || []).length
    });
  }
}

const requiredTopicIds = result.topics.map((topic) => topic.id);
const missing = requiredTopicIds.filter((id) => !seenExpansionTopics.has(id));
if (missing.length) {
  throw new Error(`Every canonical topic must have an explicit depth expansion; missing: ${missing.join(', ')}`);
}
for (const topic of result.topics) {
  if (!Array.isArray(topic.sections) || topic.sections.length < 8) {
    throw new Error(`Expanded topic ${topic.id} has only ${topic.sections?.length || 0} sections; expected at least 8`);
  }
}

result.schemaVersion = Math.max(Number(result.schemaVersion || 1), 1);
result.expansionMetadata = {
  assembledAt: new Date().toISOString(),
  sources: expansionPaths,
  topicsExpanded: mergeReport.length,
  minimumSectionsPerTopic: 8
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  topics: result.topics.length,
  expansionCatalogs: expansionPaths,
  minimumSectionsPerTopic: 8,
  expansions: mergeReport
}, null, 2));