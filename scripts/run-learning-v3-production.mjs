import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const sourcePath = process.env.CANONICAL_TOPIC_LITERATURE_PATH || 'site/wordpress/education/topic-literature.json';
const normalizedPath = process.env.NORMALIZED_TOPIC_LITERATURE_PATH || '/tmp/dtf-topic-literature-v3-normalized.json';
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
if (!Array.isArray(source?.topics) || !source.topics.length) throw new Error('Canonical topic literature is empty');

const rules = [
  { id: 'plant-biology', terms: ['plant biology'] },
  { id: 'genetics-breeding', terms: ['genetics', 'breeding'] },
  { id: 'lifecycle-propagation', terms: ['lifecycle', 'propagation'] },
  { id: 'environment-vpd', terms: ['environment', 'vpd'] },
  { id: 'lighting', terms: ['lighting'] },
  { id: 'water-root-zone', terms: ['water', 'root zone'] },
  { id: 'nutrition-media', terms: ['nutrition', 'media'] },
  { id: 'training-canopy', terms: ['training', 'canopy'] },
  { id: 'plant-health-ipm', terms: ['plant health', 'ipm'] },
  { id: 'harvest-postharvest', terms: ['harvest', 'post-harvest'] },
  { id: 'outdoor-cultivation', terms: ['outdoor'] },
  { id: 'evidence-measurement', terms: ['evidence', 'measurement'] }
];

const used = new Set();
const topics = source.topics.map(topic => {
  const hay = `${topic.id || ''} ${topic.title || ''}`.toLowerCase();
  const rule = rules.find(candidate => !used.has(candidate.id) && candidate.terms.some(term => hay.includes(term)));
  if (!rule) return topic;
  used.add(rule.id);
  return { ...topic, id: rule.id, canonicalSourceId: topic.id };
});

const required = ['plant-biology','genetics-breeding','lifecycle-propagation','environment-vpd','lighting','water-root-zone','nutrition-media','training-canopy','plant-health-ipm','harvest-postharvest','outdoor-cultivation','evidence-measurement'];
const ids = new Set(topics.map(topic => topic.id));
const missing = required.filter(id => !ids.has(id));
if (missing.length) throw new Error(`Could not normalize required THC topics: ${missing.join(', ')}`);

await writeFile(normalizedPath, `${JSON.stringify({ ...source, normalizedFor: 'learning-v3', topics }, null, 2)}\n`);
process.env.TOPIC_LITERATURE_PATH = normalizedPath;
await import('./rebuild-wordpress-learning-experience-v3.mjs');
